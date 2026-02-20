import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Database } from "../_shared/database.ts";

// Types for notification processing
interface NotificationPayload {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  ios?: {
    categoryIdentifier?: string;
  };
}

interface PushNotificationResult {
  success: boolean;
  receipt?: string;
  error?: string;
}

console.log("Starting notification processing function");

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Debug: Test AnonymousUser table access
    console.log("Testing AnonymousUser table access...");
    const testQuery = await supabase.from("AnonymousUser").select("*").limit(5);
    console.log("Test query result:", {
      count: testQuery.data?.length,
      error: testQuery.error,
      sample: testQuery.data?.[0],
    });

    // Check if a specific notification ID was provided
    const body = req.method === "POST" ? await req.json() : {};
    const specificNotificationId = body.notification_id;

    // Get current time
    const now = new Date().toISOString();
    console.log(`Processing notifications at: ${now}`);

    // Fetch pending notifications that are due
    let query = supabase
      .from("scheduled_notifications")
      .select("*")
      .eq("status", "pending");

    // If specific notification ID provided, only process that one
    if (specificNotificationId) {
      console.log(
        `Processing specific notification: ${specificNotificationId}`,
      );
      query = query.eq("id", specificNotificationId);
    } else {
      // Otherwise, process all due notifications
      query = query.lte("scheduled_for", now);
    }

    const { data: pendingNotifications, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching notifications:", fetchError);
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
    }

    console.log("Query result:", {
      specificNotificationId,
      found: pendingNotifications?.length || 0,
      notifications: pendingNotifications,
    });

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log("No pending notifications found, checking triggers...");

      // If no scheduled notifications, evaluate triggers
      const triggerResult = await evaluateAndProcessTriggers(supabase, now);

      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          triggers_processed: triggerResult.processed,
          triggers_executed: triggerResult.executed,
          message: `No scheduled notifications. Processed ${triggerResult.processed} triggers, executed ${triggerResult.executed}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `Found ${pendingNotifications.length} notifications to process`,
    );

    let successCount = 0;
    let errorCount = 0;

    // Process each notification
    for (const notification of pendingNotifications) {
      try {
        console.log(`Processing notification: ${notification.id}`);

        // Get target users based on audience type
        const targetUsers = await getTargetUsers(
          supabase,
          notification.target_audience,
        );

        if (targetUsers.length === 0) {
          console.log(
            `No target users found for notification: ${notification.id}`,
          );
          await markNotificationAsCompleted(
            supabase,
            notification.id,
            "sent",
            "No target users found",
          );
          continue;
        }

        // Get push tokens for the target users and deduplicate
        const allTokens = targetUsers
          .filter((user) => user.pushToken && user.notificationsEnabled)
          .map((user) => user.pushToken)
          .filter(Boolean) as string[];

        // Remove duplicates using Set
        const pushTokens = Array.from(new Set(allTokens));

        console.log(
          `Total tokens: ${allTokens.length}, Unique tokens: ${pushTokens.length}`,
        );

        if (pushTokens.length === 0) {
          console.log(
            `No valid push tokens for notification: ${notification.id}`,
          );
          await markNotificationAsCompleted(
            supabase,
            notification.id,
            "sent",
            "No valid push tokens",
          );
          continue;
        }

        console.log(
          `Sending to ${pushTokens.length} devices for notification: ${notification.id}`,
        );

        // Send the push notification
        const result = await sendPushNotification({
          to: pushTokens,
          title: notification.title,
          body: notification.body,
          data: {
            notification_id: notification.id,
            ...((notification.data as Record<string, any>) || {}),
          },
          ios: {
            categoryIdentifier: "dismissable_notification",
          },
        });

        if (result.success) {
          await markNotificationAsCompleted(supabase, notification.id, "sent");

          // Record analytics event for sent notification
          await recordAnalyticsEvent(
            supabase,
            notification.id,
            "sent",
            pushTokens.length,
          );

          successCount++;
          console.log(`Successfully sent notification: ${notification.id}`);
        } else {
          await markNotificationAsCompleted(
            supabase,
            notification.id,
            "failed",
            result.error,
          );

          // Record analytics event for failed notification
          await recordAnalyticsEvent(
            supabase,
            notification.id,
            "failed",
            pushTokens.length,
            {
              error: result.error,
            },
          );

          errorCount++;
          console.error(
            `Failed to send notification ${notification.id}:`,
            result.error,
          );
        }
      } catch (error) {
        console.error(
          `Error processing notification ${notification.id}:`,
          error,
        );
        await markNotificationAsCompleted(
          supabase,
          notification.id,
          "failed",
          error instanceof Error ? error.message : "Unknown error",
        );
        errorCount++;
      }
    }

    const response = {
      success: true,
      processed: pendingNotifications.length,
      successful: successCount,
      failed: errorCount,
      timestamp: now,
    };

    console.log("Processing complete:", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function getTargetUsers(supabase: any, targetAudience: any) {
  const audience =
    typeof targetAudience === "string"
      ? JSON.parse(targetAudience)
      : targetAudience;

  if (!audience || !audience.type) {
    console.log("Invalid audience format, defaulting to all users");
    const { data } = await supabase
      .from("AppUser")
      .select("authUserID, pushToken, notificationsEnabled")
      .eq("notificationsEnabled", true);
    return data || [];
  }

  switch (audience.type) {
    case "all": // Legacy: all registered users
      const { data: allUsers } = await supabase
        .from("AppUser")
        .select("authUserID, pushToken, notificationsEnabled")
        .not("pushToken", "is", null);
      return allUsers || [];

    case "all_users": // New: both registered and anonymous users
      const { data: registeredUsers } = await supabase
        .from("AppUser")
        .select("authUserID, pushToken, notificationsEnabled")
        .not("pushToken", "is", null);

      const { data: anonUsers, error: anonError } = await supabase
        .from("AnonymousUser")
        .select("deviceId, pushToken, notificationsEnabled")
        .eq("notificationsEnabled", true)
        .not("pushToken", "is", null);

      if (anonError) {
        console.error("Error fetching anonymous users:", anonError);
      }

      console.log("Fetched registered users:", registeredUsers?.length || 0);
      console.log("Fetched anonymous users:", anonUsers?.length || 0);

      // Combine both arrays, normalizing the structure
      const allRegistered = (registeredUsers || []).map((u: any) => ({
        pushToken: u.pushToken,
        notificationsEnabled: u.notificationsEnabled,
      }));

      const allAnon = (anonUsers || []).map((u: any) => ({
        pushToken: u.pushToken,
        notificationsEnabled: u.notificationsEnabled,
      }));

      return [...allRegistered, ...allAnon];

    case "registered_only": // New: only registered users
      const { data: onlyRegistered } = await supabase
        .from("AppUser")
        .select("authUserID, pushToken, notificationsEnabled")
        .not("pushToken", "is", null);
      return onlyRegistered || [];

    case "anonymous_only": // New: only anonymous users
      const { data: onlyAnon, error: onlyAnonError } = await supabase
        .from("AnonymousUser")
        .select("deviceId, pushToken, notificationsEnabled")
        .eq("notificationsEnabled", true)
        .not("pushToken", "is", null);

      if (onlyAnonError) {
        console.error("Error fetching anonymous users:", onlyAnonError);
      }

      console.log("Raw anonymous data:", JSON.stringify(onlyAnon));
      console.log("Fetched anonymous only users:", onlyAnon?.length || 0);

      // Normalize structure to match expected format
      const mapped = (onlyAnon || []).map((u: any) => ({
        pushToken: u.pushToken,
        notificationsEnabled: u.notificationsEnabled,
      }));
      console.log("Mapped anonymous users:", JSON.stringify(mapped));
      return mapped;

    case "admins":
      const { data: adminUsers } = await supabase
        .from("AppUser")
        .select("authUserID, pushToken, notificationsEnabled, role")
        .in("role", ["admin", "super_admin"])
        .not("pushToken", "is", null);
      return adminUsers || [];

    case "users":
      if (!audience.userIds || !Array.isArray(audience.userIds)) {
        return [];
      }
      const { data: specificUsers } = await supabase
        .from("AppUser")
        .select("authUserID, pushToken, notificationsEnabled")
        .in("authUserID", audience.userIds)
        .not("pushToken", "is", null);
      return specificUsers || [];

    case "segment":
      // For now, just return all users. In the future, implement segment filtering
      // based on audience.filter criteria
      const { data: segmentUsers } = await supabase
        .from("AppUser")
        .select("authUserID, pushToken, notificationsEnabled")
        .not("pushToken", "is", null);
      return segmentUsers || [];

    default:
      return [];
  }
}

async function markNotificationAsCompleted(
  supabase: any,
  notificationId: string,
  status: "sent" | "failed" | "cancelled",
  errorMessage?: string,
) {
  const updateData: any = {
    status,
    sent_at: new Date().toISOString(),
  };

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const { error } = await supabase
    .from("scheduled_notifications")
    .update(updateData)
    .eq("id", notificationId);

  if (error) {
    console.error(`Error updating notification ${notificationId}:`, error);
  }
}

async function sendPushNotification(
  payload: NotificationPayload,
): Promise<PushNotificationResult> {
  try {
    // For development, we'll use Expo Push API
    // In production, you might want to use FCM directly or another service

    const messages = Array.isArray(payload.to)
      ? payload.to.map((token) => ({
          to: token,
          sound: "default",
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          priority: "high",
          channelId: "default",
        }))
      : [
          {
            to: payload.to,
            sound: "default",
            title: payload.title,
            body: payload.body,
            data: payload.data || {},
            priority: "high",
            channelId: "default",
          },
        ];

    console.log(`Sending ${messages.length} push notifications`);

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Push notification result:", result);

    // Check for any errors in the response
    if (result.data) {
      const hasErrors = result.data.some(
        (ticket: any) => ticket.status === "error",
      );
      if (hasErrors) {
        const errors = result.data
          .filter((ticket: any) => ticket.status === "error")
          .map((ticket: any) => ticket.message || "Unknown error");
        return { success: false, error: errors.join(", ") };
      }
    }

    return { success: true, receipt: JSON.stringify(result) };
  } catch (error) {
    console.error("Error sending push notification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Function to evaluate triggers and process them
async function evaluateAndProcessTriggers(supabase: any, currentTime: string) {
  console.log("Evaluating triggers...");

  try {
    // Fetch all active triggers
    const { data: triggers, error: triggerError } = await supabase
      .from("notification_triggers")
      .select("*")
      .eq("is_active", true);

    if (triggerError) {
      console.error("Error fetching triggers:", triggerError);
      return { processed: 0, executed: 0, error: triggerError.message };
    }

    if (!triggers || triggers.length === 0) {
      console.log("No active triggers found");
      return { processed: 0, executed: 0 };
    }

    console.log(`Found ${triggers.length} active triggers`);

    let totalExecuted = 0;

    // Process each trigger
    for (const trigger of triggers) {
      try {
        console.log(
          `Processing trigger: ${trigger.name} (${trigger.trigger_type})`,
        );

        const executionResult = await evaluateTriggerConditions(
          supabase,
          trigger,
          currentTime,
        );

        if (executionResult.matchingUsers > 0) {
          console.log(
            `Trigger ${trigger.name} matched ${executionResult.matchingUsers} users`,
          );
          totalExecuted += executionResult.matchingUsers;
        }
      } catch (error) {
        console.error(`Error processing trigger ${trigger.name}:`, error);
      }
    }

    return {
      processed: triggers.length,
      executed: totalExecuted,
    };
  } catch (error) {
    console.error("Error in evaluateAndProcessTriggers:", error);
    return { processed: 0, executed: 0, error: error.message };
  }
}

// Function to evaluate specific trigger conditions
async function evaluateTriggerConditions(
  supabase: any,
  trigger: any,
  currentTime: string,
) {
  const conditionConfig =
    typeof trigger.condition_config === "string"
      ? JSON.parse(trigger.condition_config)
      : trigger.condition_config;

  console.log(
    `Evaluating ${trigger.trigger_type} trigger with config:`,
    conditionConfig,
  );

  let matchingUsers: any[] = [];

  switch (trigger.trigger_type) {
    case "user_inactive":
      matchingUsers = await evaluateUserInactive(
        supabase,
        conditionConfig,
        currentTime,
      );
      break;

    case "signup_incomplete":
      matchingUsers = await evaluateSignupIncomplete(
        supabase,
        conditionConfig,
        currentTime,
      );
      break;

    case "video_abandoned":
      matchingUsers = await evaluateVideoAbandoned(
        supabase,
        conditionConfig,
        currentTime,
      );
      break;

    default:
      console.log(`Trigger type ${trigger.trigger_type} not yet implemented`);
      return { matchingUsers: 0 };
  }

  // Create trigger executions and send notifications
  for (const user of matchingUsers) {
    await createTriggerExecution(supabase, trigger.id, user, true);
    // TODO: Create scheduled notification for this user
  }

  return { matchingUsers: matchingUsers.length };
}

// User inactive trigger evaluation
async function evaluateUserInactive(
  supabase: any,
  config: any,
  currentTime: string,
) {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - (config.days_inactive || 3));

  console.log(`Checking for users inactive since: ${daysAgo.toISOString()}`);

  const { data: inactiveUsers } = await supabase
    .from("AppUser")
    .select("authUserID, firstName, pushToken, notificationsEnabled")
    .lt("createdAt", daysAgo.toISOString());

  // Filter users with push tokens and notifications enabled
  return (inactiveUsers || []).filter(
    (user: any) => user.pushToken && user.notificationsEnabled,
  );
}

// Signup incomplete trigger evaluation
async function evaluateSignupIncomplete(
  supabase: any,
  config: any,
  currentTime: string,
) {
  const hoursAgo = new Date();
  hoursAgo.setHours(hoursAgo.getHours() - (config.hours_since_signup || 24));

  console.log(
    `Checking for incomplete signups since: ${hoursAgo.toISOString()}`,
  );

  const { data: incompleteUsers } = await supabase
    .from("AppUser")
    .select("authUserID, firstName, lastName, pushToken, notificationsEnabled")
    .gt("createdAt", hoursAgo.toISOString())
    .or("firstName.is.null,lastName.is.null");

  return (incompleteUsers || []).filter(
    (user: any) => user.pushToken && user.notificationsEnabled,
  );
}

// Video abandoned trigger evaluation
async function evaluateVideoAbandoned(
  supabase: any,
  config: any,
  currentTime: string,
) {
  const hoursAgo = new Date();
  hoursAgo.setHours(
    hoursAgo.getHours() - (config.hours_since_abandonment || 2),
  );

  console.log(`Checking for abandoned videos since: ${hoursAgo.toISOString()}`);

  const watchThreshold = config.watch_percentage_threshold || 50;

  const { data: abandonedViews } = await supabase
    .from("VideoProgress")
    .select(
      `
      "userID",
      "videoID", 
      progress,
      "updatedAt",
      Video!inner(duration, title)
    `,
    )
    .lt("updatedAt", hoursAgo.toISOString());

  // Filter for abandoned videos (watched some but not completed)
  const abandonedUsers = (abandonedViews || []).filter((view: any) => {
    const watchPercentage = (view.progress / view.Video.duration) * 100;
    return watchPercentage >= 10 && watchPercentage <= watchThreshold;
  });

  // Get user details for push tokens
  const userIDs = [...new Set(abandonedUsers.map((view: any) => view.userID))];

  if (userIDs.length === 0) return [];

  const { data: users } = await supabase
    .from("AppUser")
    .select("authUserID, pushToken, notificationsEnabled")
    .in("authUserID", userIDs);

  return (users || []).filter(
    (user: any) => user.pushToken && user.notificationsEnabled,
  );
}

// Create trigger execution record
async function createTriggerExecution(
  supabase: any,
  triggerId: string,
  user: any,
  success: boolean,
) {
  const { error } = await supabase.from("trigger_executions").insert({
    trigger_id: triggerId,
    user_id: user.authUserID,
    notification_sent: success,
    condition_met_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error creating trigger execution:", error);
  }
}

// Record analytics event for notifications
async function recordAnalyticsEvent(
  supabase: any,
  notificationId: string,
  eventType: string,
  deviceCount: number,
  metadata?: Record<string, any>,
) {
  const { error } = await supabase.from("notification_analytics").insert({
    notification_id: notificationId,
    event_type: eventType,
    device_count: deviceCount,
    timestamp: new Date().toISOString(),
    metadata: metadata || null,
  });

  if (error) {
    console.error(`Error recording ${eventType} analytics:`, error);
  }
}
