// Simplified database types for Edge Functions
export interface Database {
  public: {
    Tables: {
      AppUser: {
        Row: {
          id: string;
          authUserID: string;
          firstName: string | null;
          lastName: string | null;
          pushToken: string | null;
          notificationsEnabled: boolean | null;
          email: string | null;
          role: "user" | "admin" | "super_admin";
        };
      };
      AnonymousUser: {
        Row: {
          id: string;
          deviceId: string;
          pushToken: string | null;
          notificationsEnabled: boolean;
          deviceInfo: any;
          createdAt: string;
          updatedAt: string;
          lastActiveAt: string | null;
        };
      };
      scheduled_notifications: {
        Row: {
          id: string;
          title: string;
          body: string;
          scheduled_for: string;
          status: "pending" | "sent" | "failed" | "cancelled";
          target_audience: any;
          data: any;
          created_at: string;
          updated_at: string;
          sent_at: string | null;
          created_by: string | null;
          error_message: string | null;
        };
      };
      notification_triggers: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          trigger_type: string;
          condition_config: any;
          template_id: string | null;
          title: string;
          body: string;
          target_audience: any;
          is_active: boolean;
          priority: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
      };
      trigger_executions: {
        Row: {
          id: string;
          trigger_id: string;
          user_id: string;
          executed_at: string;
          notification_id: string | null;
          success: boolean;
          error_message: string | null;
          condition_values: any;
        };
      };
      user_notification_history: {
        Row: {
          id: string;
          user_id: string;
          notification_id: string;
          trigger_id: string | null;
          sent_at: string;
          category: string;
          throttle_key: string | null;
        };
      };
      notification_throttle_settings: {
        Row: {
          id: string;
          enabled: boolean;
          max_notifications_per_day: number;
          cooldown_hours_between_campaigns: number;
          priority_override_threshold: number;
          respect_user_preferences: boolean;
          updated_at: string;
        };
      };
    };
  };
}
