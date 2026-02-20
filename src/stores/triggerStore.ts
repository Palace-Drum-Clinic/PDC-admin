import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";
import type {
  NotificationTrigger,
  TriggerExecution,
  UserNotificationHistory,
  NotificationTriggerInput,
  ThrottleSettings,
  NotificationThrottleSettings,
} from "@/types";

interface TriggerState {
  triggers: NotificationTrigger[];
  executions: TriggerExecution[];
  throttleSettings: ThrottleSettings;
  isLoading: boolean;
  error: string | null;

  // Trigger management
  fetchTriggers: () => Promise<void>;
  createTrigger: (input: NotificationTriggerInput) => Promise<{
    success: boolean;
    error?: string;
    data?: NotificationTrigger;
  }>;
  updateTrigger: (
    id: string,
    input: Partial<NotificationTriggerInput>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteTrigger: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleTrigger: (
    id: string,
    isActive: boolean
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;

  // Trigger execution tracking
  fetchExecutions: (triggerId?: string) => Promise<void>;
  getExecutionHistory: (
    userId: string,
    days?: number
  ) => Promise<{
    success: boolean;
    data?: UserNotificationHistory[];
    error?: string;
  }>;

  // Throttle management
  fetchThrottleSettings: () => Promise<void>;
  updateThrottleSettings: (settings: Partial<ThrottleSettings>) => Promise<{
    success: boolean;
    error?: string;
  }>;

  // User notification frequency check
  checkNotificationFrequency: (
    userId: string,
    category: string
  ) => Promise<{
    canSend: boolean;
    reason?: string;
    nextAvailable?: string;
  }>;

  // Trigger processing
  processTriggers: () => Promise<{ success: boolean; error?: string }>;

  // Analytics
  getTriggerPerformance: (
    triggerId: string,
    days?: number
  ) => Promise<{
    success: boolean;
    data?: {
      executions: number;
      successful_deliveries: number;
      open_rate: number;
      click_rate: number;
    };
    error?: string;
  }>;
}

export const useTriggerStore = create<TriggerState>()(
  persist(
    (set, get) => ({
      triggers: [],
      executions: [],
      throttleSettings: {
        enabled: true,
        max_notifications_per_day: 3,
        cooldown_hours_between_campaigns: 24,
        priority_override_threshold: 8,
        respect_user_preferences: true,
      },
      isLoading: false,
      error: null,

      fetchTriggers: async () => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase
            .from("notification_triggers")
            .select("*")
            .order("created_at", { ascending: false });

          if (error) throw error;

          set({ triggers: data as NotificationTrigger[], isLoading: false });
        } catch (error) {
          console.error("Error fetching triggers:", error);
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to fetch triggers",
            isLoading: false,
          });
        }
      },

      createTrigger: async (input) => {
        try {
          const { data, error } = await supabase
            .from("notification_triggers")
            .insert(input as never)
            .select()
            .single();

          if (error) throw error;

          const newTrigger = data as NotificationTrigger;
          set({
            triggers: [newTrigger, ...get().triggers],
          });

          return { success: true, data: newTrigger };
        } catch (error) {
          console.error("Error creating trigger:", error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to create trigger",
          };
        }
      },

      updateTrigger: async (id, input) => {
        try {
          const { data, error } = await supabase
            .from("notification_triggers")
            .update(input as never)
            .eq("id", id)
            .select()
            .single();

          if (error) throw error;

          const updatedTrigger = data as NotificationTrigger;
          set({
            triggers: get().triggers.map((t) =>
              t.id === id ? updatedTrigger : t
            ),
          });

          return { success: true };
        } catch (error) {
          console.error("Error updating trigger:", error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to update trigger",
          };
        }
      },

      deleteTrigger: async (id) => {
        try {
          const { error } = await supabase
            .from("notification_triggers")
            .delete()
            .eq("id", id);

          if (error) throw error;

          set({
            triggers: get().triggers.filter((t) => t.id !== id),
          });

          return { success: true };
        } catch (error) {
          console.error("Error deleting trigger:", error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to delete trigger",
          };
        }
      },

      toggleTrigger: async (id, isActive) => {
        try {
          const { data, error } = await supabase
            .from("notification_triggers")
            .update({ is_active: isActive } as never)
            .eq("id", id)
            .select()
            .single();

          if (error) throw error;

          const updatedTrigger = data as NotificationTrigger;
          set({
            triggers: get().triggers.map((t) =>
              t.id === id ? updatedTrigger : t
            ),
          });

          return { success: true };
        } catch (error) {
          console.error("Error toggling trigger:", error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to toggle trigger",
          };
        }
      },

      fetchExecutions: async (triggerId) => {
        set({ isLoading: true, error: null });
        try {
          let query = supabase
            .from("trigger_executions")
            .select("*")
            .order("executed_at", { ascending: false });

          if (triggerId) {
            query = query.eq("trigger_id", triggerId);
          }

          const { data, error } = await query;
          if (error) throw error;

          set({ executions: data as TriggerExecution[], isLoading: false });
        } catch (error) {
          console.error("Error fetching executions:", error);
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to fetch executions",
            isLoading: false,
          });
        }
      },

      getExecutionHistory: async (userId, days = 30) => {
        try {
          const since = new Date();
          since.setDate(since.getDate() - days);

          const { data, error } = await supabase
            .from("user_notification_history")
            .select("*")
            .eq("user_id", userId)
            .gte("sent_at", since.toISOString())
            .order("sent_at", { ascending: false });

          if (error) throw error;

          return {
            success: true,
            data: data as UserNotificationHistory[],
          };
        } catch (error) {
          console.error("Error fetching execution history:", error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to fetch history",
          };
        }
      },

      fetchThrottleSettings: async () => {
        try {
          const { data, error } = await supabase
            .from("notification_throttle_settings")
            .select("*")
            .limit(1)
            .single() as unknown as {
              data: NotificationThrottleSettings | null;
              error: Error | null;
            };

          if (error) throw error;

          if (data) {
            set({
              throttleSettings: {
                enabled: data.enabled,
                max_notifications_per_day: data.max_notifications_per_day,
                cooldown_hours_between_campaigns:
                  data.cooldown_hours_between_campaigns,
                priority_override_threshold: data.priority_override_threshold,
                respect_user_preferences: data.respect_user_preferences,
              },
            });
          }
        } catch (error) {
          console.error("Error fetching throttle settings:", error);
        }
      },

      updateThrottleSettings: async (settings) => {
        try {
          const newSettings = { ...get().throttleSettings, ...settings };

          // Persist to DB — fetch the row id first, then upsert
          const { data: existing } = await supabase
            .from("notification_throttle_settings")
            .select("id")
            .limit(1)
            .single() as unknown as {
              data: Pick<NotificationThrottleSettings, "id"> | null;
              error: Error | null;
            };

          if (existing) {
            const { error } = await supabase
              .from("notification_throttle_settings")
              .update({
                enabled: newSettings.enabled,
                max_notifications_per_day:
                  newSettings.max_notifications_per_day,
                cooldown_hours_between_campaigns:
                  newSettings.cooldown_hours_between_campaigns,
                priority_override_threshold:
                  newSettings.priority_override_threshold,
                respect_user_preferences: newSettings.respect_user_preferences,
                updated_at: new Date().toISOString(),
              } as never)
              .eq("id", existing.id);

            if (error) throw error;
          }

          set({ throttleSettings: newSettings });
          return { success: true };
        } catch (error) {
          console.error("Error updating throttle settings:", error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to update settings",
          };
        }
      },

      checkNotificationFrequency: async (userId) => {
        try {
          const { throttleSettings } = get();
          if (!throttleSettings.enabled) {
            return { canSend: true };
          }

          // Check daily limit
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const { data, error } = await supabase
            .from("user_notification_history")
            .select("*")
            .eq("user_id", userId)
            .gte("sent_at", today.toISOString());

          if (error) throw error;

          const todayCount = data?.length || 0;
          if (todayCount >= throttleSettings.max_notifications_per_day) {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return {
              canSend: false,
              reason: "Daily notification limit reached",
              nextAvailable: tomorrow.toISOString(),
            };
          }

          // Check cooldown between campaigns
          if (data && data.length > 0) {
            const lastNotification = new Date((data[0] as any).sent_at);
            const cooldownEnd = new Date(
              lastNotification.getTime() +
                throttleSettings.cooldown_hours_between_campaigns *
                  60 *
                  60 *
                  1000
            );

            if (new Date() < cooldownEnd) {
              return {
                canSend: false,
                reason: "Cooldown period active",
                nextAvailable: cooldownEnd.toISOString(),
              };
            }
          }

          return { canSend: true };
        } catch (error) {
          console.error("Error checking notification frequency:", error);
          return {
            canSend: false,
            reason: "Error checking frequency",
          };
        }
      },

      processTriggers: async () => {
        try {
          // Call the Edge Function to process triggers
          const { error } = await supabase.functions.invoke(
            "process-triggers",
            { body: {} }
          );

          if (error) throw error;

          return { success: true };
        } catch (error) {
          console.error("Error processing triggers:", error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to process triggers",
          };
        }
      },

      getTriggerPerformance: async (triggerId, days = 30) => {
        try {
          const since = new Date();
          since.setDate(since.getDate() - days);

          // Fetch executions for the trigger
          const { data: executions, error: execError } = await supabase
            .from("trigger_executions")
            .select("*")
            .eq("trigger_id", triggerId)
            .gte("executed_at", since.toISOString());

          if (execError) throw execError;

          // Fetch notification analytics for successful executions
          const notificationIds =
            executions
              ?.filter((e) => (e as any).success && (e as any).notification_id)
              .map((e) => (e as any).notification_id) || [];

          if (notificationIds.length === 0) {
            return {
              success: true,
              data: {
                executions: 0,
                successful_deliveries: 0,
                open_rate: 0,
                click_rate: 0,
              },
            };
          }

          const { data: analytics, error: analyticsError } = await supabase
            .from("notification_analytics")
            .select("*")
            .in("notification_id", notificationIds);

          if (analyticsError) throw analyticsError;

          // Calculate metrics
          const delivered =
            analytics
              ?.filter((a) => (a as any).event_type === "delivered")
              .reduce((sum, a) => sum + (a as any).device_count, 0) || 0;
          const opened =
            analytics
              ?.filter((a) => (a as any).event_type === "opened")
              .reduce((sum, a) => sum + (a as any).device_count, 0) || 0;
          const clicked =
            analytics
              ?.filter((a) => (a as any).event_type === "clicked")
              .reduce((sum, a) => sum + (a as any).device_count, 0) || 0;

          return {
            success: true,
            data: {
              executions: executions?.length || 0,
              successful_deliveries: delivered,
              open_rate:
                delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
              click_rate:
                delivered > 0 ? Math.round((clicked / delivered) * 100) : 0,
            },
          };
        } catch (error) {
          console.error("Error fetching trigger performance:", error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to fetch performance",
          };
        }
      },
    }),
    {
      name: "trigger-store",
      partialize: () => ({}), // Don't persist any data
    }
  )
);
