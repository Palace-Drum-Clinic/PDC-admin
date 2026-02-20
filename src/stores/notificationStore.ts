import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { ScheduledNotification, NotificationTemplate } from "@/types";
import type {
  ScheduledNotificationInput,
  NotificationTemplateInput,
} from "@/types/schemas";

interface NotificationState {
  notifications: ScheduledNotification[];
  templates: NotificationTemplate[];
  isLoading: boolean;
  error: string | null;

  // Notifications
  fetchNotifications: () => Promise<void>;
  createNotification: (
    input: ScheduledNotificationInput
  ) => Promise<{ success: boolean; error?: string }>;
  updateNotification: (
    id: string,
    input: Partial<ScheduledNotificationInput>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteNotification: (
    id: string
  ) => Promise<{ success: boolean; error?: string }>;
  cancelNotification: (
    id: string
  ) => Promise<{ success: boolean; error?: string }>;
  sendInstantNotification: (input: {
    title: string;
    body: string;
    audience_type: "all" | "all_users" | "registered_only" | "anonymous_only" | "admins" | "segment" | "users";
  }) => Promise<{
    success: boolean;
    error?: string;
    data?: ScheduledNotification;
  }>;

  // Process scheduled notifications
  processScheduledNotifications: () => Promise<{
    success: boolean;
    error?: string;
  }>;

  // Templates
  fetchTemplates: () => Promise<void>;
  createTemplate: (
    input: NotificationTemplateInput
  ) => Promise<{ success: boolean; error?: string }>;
  updateTemplate: (
    id: string,
    input: Partial<NotificationTemplateInput>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteTemplate: (id: string) => Promise<{ success: boolean; error?: string }>;

  clearError: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  templates: [],
  isLoading: false,
  error: null,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("scheduled_notifications")
        .select("*")
        .order("sent_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      set({ notifications: data || [] });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch notifications",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  createNotification: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("scheduled_notifications")
        .insert(input as never)
        .select()
        .single();

      if (error) throw error;

      set({
        notifications: [data as ScheduledNotification, ...get().notifications],
      });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create notification";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  updateNotification: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("scheduled_notifications")
        .update(input as never)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      set({
        notifications: get().notifications.map((n) =>
          n.id === id ? (data as ScheduledNotification) : n
        ),
      });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update notification";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  deleteNotification: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from("scheduled_notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;

      set({ notifications: get().notifications.filter((n) => n.id !== id) });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete notification";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  cancelNotification: async (id) => {
    return get().updateNotification(id, {
      status: "cancelled",
    } as Partial<ScheduledNotificationInput>);
  },

  sendInstantNotification: async (input) => {
    set({ isLoading: true, error: null });
    try {
      // Build target audience object
      const targetAudience =
        input.audience_type === "all"
          ? { type: "all" }
          : input.audience_type === "all_users"
          ? { type: "all_users" }
          : input.audience_type === "registered_only"
          ? { type: "registered_only" }
          : input.audience_type === "anonymous_only"
          ? { type: "anonymous_only" }
          : input.audience_type === "admins"
          ? { type: "admins" }
          : input.audience_type === "segment"
          ? { type: "segment", filter: {} }
          : { type: "users", userIds: [] };

      // Save to database first (so it appears on dashboard)
      const { data: notification, error: dbError } = await supabase
        .from("scheduled_notifications")
        .insert({
          title: input.title,
          body: input.body,
          scheduled_for: new Date().toISOString(), // Send immediately
          target_audience: targetAudience,
          status: "pending",
        } as never)
        .select()
        .single();

      if (dbError) throw dbError;

      // Update local state to include the new notification
      const currentNotifications = get().notifications;
      set({
        notifications: [
          ...currentNotifications,
          notification as ScheduledNotification,
        ],
      });

      // Process the notification immediately by passing its ID
      const { error: functionError } = await supabase.functions.invoke(
        "process-notifications",
        {
          body: { notification_id: (notification as ScheduledNotification).id },
        }
      );

      if (functionError) {
        console.warn("Edge function error:", functionError);
        // Don't throw here - notification is saved and will be processed by cron
      }

      return { success: true, data: notification as ScheduledNotification };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to send instant notification";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("notification_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      set({ templates: data || [] });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch templates",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  createTemplate: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("notification_templates")
        .insert(input as never)
        .select()
        .single();

      if (error) throw error;

      set({ templates: [data as NotificationTemplate, ...get().templates] });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create template";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  updateTemplate: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("notification_templates")
        .update(input as never)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      set({
        templates: get().templates.map((t) =>
          t.id === id ? (data as NotificationTemplate) : t
        ),
      });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update template";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  deleteTemplate: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from("notification_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      set({ templates: get().templates.filter((t) => t.id !== id) });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete template";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  // Manual processing function for scheduled notifications
  processScheduledNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      // Call the Edge Function to process all pending notifications
      const { error } = await supabase.functions.invoke(
        "process-notifications"
      );

      if (error) throw error;

      // Refresh the notifications list to see updated statuses
      await get().fetchNotifications();

      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to process scheduled notifications";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
