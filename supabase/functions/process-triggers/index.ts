import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TriggerCondition {
  type:
    | "user_inactive"
    | "signup_incomplete"
    | "video_abandoned"
    | "practice_streak_broken"
    | "milestone_reached";
  [key: string]: any;
}

interface ThrottleSettings {
  id: string;
  enabled: boolean;
  max_notifications_per_day: number;
  cooldown_hours_between_campaigns: number;
  priority_override_threshold: number;
  respect_user_preferences: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Processing notification triggers...");

    // (a) Read throttle settings from DB
    const { data: settingsData, error: settingsError } = await supabase
      .from("notification_throttle_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError) {
      console.error("Error fetching throttle settings:", settingsError);
      // Fall back to defaults if settings can't be loaded
    }

    const settings: ThrottleSettings = settingsData ?? {
      id: "",
      enabled: true,
      max_notifications_per_day: 3,
      cooldown_hours_between_campaigns: 24,
      priority_override_threshold: 8,
      respect_user_preferences: true,
    };

    // Fetch active triggers
    const { data: triggers, error: triggerError } = await supabase
      .from("notification_triggers")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (triggerError) {
      console.error("Error fetching triggers:", triggerError);
      throw new Error(triggerError.message ?? JSON.stringify(triggerError));
    }

    if (!triggers || triggers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active triggers found",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let totalProcessed = 0;
    let totalSent = 0;
    let errors: string[] = [];

    // Process each trigger
    for (const trigger of triggers) {
      try {
        const condition = trigger.condition_config as TriggerCondition;
        console.log(`Processing trigger: ${trigger.name} (${condition.type})`);

        const eligibleUsers = await findEligibleUsers(supabase, condition);
        console.log(
          `Found ${eligibleUsers.length} eligible users for trigger ${trigger.name}`
        );

        for (const user of eligibleUsers) {
          try {
            // (b/d) Check throttling with DB settings, using authUserID
            const canSend = await checkThrottling(
              supabase,
              user.authUserID,
              trigger,
              settings
            );
            if (!canSend) {
              console.log(
                `Throttled notification for user ${user.authUserID} on trigger ${trigger.name}`
              );
              continue;
            }

            // Create and send notification
            const notificationResult = await createAndSendNotification(
              supabase,
              trigger,
              user
            );

            if (notificationResult.success) {
              totalSent++;

              // (b) Use authUserID in record calls
              await recordExecution(
                supabase,
                trigger.id,
                user.authUserID,
                true,
                notificationResult.notificationId
              );

              await recordUserHistory(
                supabase,
                user.authUserID,
                notificationResult.notificationId!,
                trigger.id,
                trigger.trigger_type
              );
            } else {
              await recordExecution(
                supabase,
                trigger.id,
                user.authUserID,
                false,
                null,
                notificationResult.error
              );
              errors.push(
                `User ${user.authUserID}: ${notificationResult.error}`
              );
            }

            totalProcessed++;
          } catch (userError) {
            console.error(
              `Error processing user ${user.authUserID}:`,
              userError
            );
            await recordExecution(
              supabase,
              trigger.id,
              user.authUserID,
              false,
              null,
              userError instanceof Error ? userError.message : "Unknown error"
            );
            errors.push(
              `User ${user.authUserID}: ${
                userError instanceof Error ? userError.message : "Unknown error"
              }`
            );
          }
        }
      } catch (triggerError) {
        console.error(
          `Error processing trigger ${trigger.name}:`,
          triggerError
        );
        errors.push(
          `Trigger ${trigger.name}: ${
            triggerError instanceof Error
              ? triggerError.message
              : "Unknown error"
          }`
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        sent: totalSent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing triggers:", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
        ? String((error as any).message)
        : JSON.stringify(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        detail: typeof error === "object" ? JSON.stringify(error) : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function findEligibleUsers(supabase: any, condition: TriggerCondition) {
  const now = new Date();

  switch (condition.type) {
    case "user_inactive": {
      const cutoffDate = new Date(
        now.getTime() - condition.days_inactive * 24 * 60 * 60 * 1000
      );

      // (c) Include authUserID in select
      const { data, error } = await supabase
        .from("AppUser")
        .select(
          `
          id, authUserID, firstName, lastName, pushToken, notificationsEnabled,
          analytics_events!inner(timestamp)
        `
        )
        .eq("notificationsEnabled", true)
        .not("pushToken", "is", null)
        .lt("analytics_events.timestamp", cutoffDate.toISOString())
        .limit(100);

      if (error) throw error;
      return data || [];
    }

    case "signup_incomplete": {
      const cutoffDate = new Date(
        now.getTime() - condition.hours_since_signup * 60 * 60 * 1000
      );

      const { data, error } = await supabase
        .from("AppUser")
        .select("id, authUserID, firstName, lastName, pushToken, notificationsEnabled")
        .lt("createdAt", cutoffDate.toISOString())
        .or("firstName.is.null,lastName.is.null")
        .eq("notificationsEnabled", true)
        .not("pushToken", "is", null)
        .limit(50);

      if (error) throw error;
      return data || [];
    }

    case "video_abandoned": {
      const { data, error } = await supabase.rpc("find_video_abandoners", {
        watch_threshold: condition.watch_percentage_threshold,
        hours_since: condition.hours_since_abandonment,
        video_id: condition.video_id || null,
        series_id: condition.series_id || null,
      });

      if (error) throw error;
      return data || [];
    }

    case "practice_streak_broken": {
      const { data, error } = await supabase.rpc("find_broken_streaks", {
        min_streak: condition.min_streak_length,
        days_since_break: condition.days_since_break,
      });

      if (error) throw error;
      return data || [];
    }

    case "milestone_reached": {
      const windowStart = new Date(
        now.getTime() - condition.celebration_window_hours * 60 * 60 * 1000
      );

      const { data, error } = await supabase.rpc("find_recent_milestones", {
        milestone_type: condition.milestone_type,
        threshold_value: condition.threshold_value,
        window_start: windowStart.toISOString(),
      });

      if (error) throw error;
      return data || [];
    }

    default:
      return [];
  }
}

// (d) Accept settings as a parameter
async function checkThrottling(
  supabase: any,
  authUserID: string,
  trigger: any,
  settings: ThrottleSettings
): Promise<boolean> {
  if (!settings.enabled) {
    return true;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: dailyHistory, error } = await supabase
    .from("user_notification_history")
    .select("*")
    .eq("user_id", authUserID)
    .gte("sent_at", today.toISOString())
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("Error checking throttling:", error);
    return true; // Allow if can't check
  }

  const dailyCount = dailyHistory?.length || 0;
  if (dailyCount >= settings.max_notifications_per_day) {
    if (trigger.priority >= settings.priority_override_threshold) {
      console.log(
        `High priority trigger ${trigger.name} overriding daily limit for user ${authUserID}`
      );
      return true;
    }
    return false;
  }

  // Check cooldown between notifications
  if (dailyHistory && dailyHistory.length > 0) {
    const lastNotification = new Date(dailyHistory[0].sent_at);
    const cooldownEnd = new Date(
      lastNotification.getTime() +
        settings.cooldown_hours_between_campaigns * 60 * 60 * 1000
    );

    if (new Date() < cooldownEnd) {
      if (trigger.priority >= settings.priority_override_threshold) {
        console.log(
          `High priority trigger ${trigger.name} overriding cooldown for user ${authUserID}`
        );
        return true;
      }
      return false;
    }
  }

  return true;
}

async function createAndSendNotification(
  supabase: any,
  trigger: any,
  user: any
) {
  try {
    const personalizedTitle = personalizeContent(trigger.title, user);
    const personalizedBody = personalizeContent(trigger.body, user);

    // (b) Use authUserID for target_audience so process-notifications can match
    const { data: notification, error: createError } = await supabase
      .from("scheduled_notifications")
      .insert({
        title: personalizedTitle,
        body: personalizedBody,
        scheduled_for: new Date().toISOString(),
        status: "pending",
        target_audience: {
          type: "users",
          userIds: [user.authUserID],
        },
        data: {
          trigger_id: trigger.id,
          trigger_type: trigger.trigger_type,
          user_id: user.authUserID,
        },
      })
      .select()
      .single();

    if (createError) throw createError;

    const { error: processError } = await supabase.functions.invoke(
      "process-notifications",
      {
        body: { notification_id: notification.id },
      }
    );

    if (processError) throw processError;

    return {
      success: true,
      notificationId: notification.id,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create notification",
    };
  }
}

function personalizeContent(content: string, user: any): string {
  return content
    .replace(/{{firstName}}/g, user.firstName || "there")
    .replace(/{{lastName}}/g, user.lastName || "")
    .replace(
      /{{name}}/g,
      user.firstName
        ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
        : "there"
    );
}

async function recordExecution(
  supabase: any,
  triggerId: string,
  userId: string,
  success: boolean,
  notificationId: string | null,
  errorMessage?: string
) {
  await supabase.from("trigger_executions").insert({
    trigger_id: triggerId,
    user_id: userId,
    success,
    notification_id: notificationId,
    error_message: errorMessage,
    executed_at: new Date().toISOString(),
  });
}

async function recordUserHistory(
  supabase: any,
  userId: string,
  notificationId: string,
  triggerId: string,
  category: string
) {
  await supabase.from("user_notification_history").insert({
    user_id: userId,
    notification_id: notificationId,
    trigger_id: triggerId,
    category,
    sent_at: new Date().toISOString(),
    throttle_key: `${category}_${new Date().toDateString()}`,
  });
}
