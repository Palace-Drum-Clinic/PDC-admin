import { z } from "zod";

// Notification schemas
export const targetAudienceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }), // Legacy: all registered users
  z.object({ type: z.literal("all_users") }), // New: all registered + anonymous users
  z.object({ type: z.literal("registered_only") }), // New: only registered users
  z.object({ type: z.literal("anonymous_only") }), // New: only anonymous users
  z.object({ type: z.literal("admins") }),
  z.object({
    type: z.literal("segment"),
    filter: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("users"),
    userIds: z.array(z.string().uuid()),
  }),
]);

export const scheduledNotificationSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  body: z.string().min(1, "Body is required").max(500, "Body too long"),
  scheduled_for: z.string().datetime(),
  target_audience: targetAudienceSchema,
  data: z.record(z.string(), z.unknown()).optional(),
});

export const notificationTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  category: z
    .enum([
      "onboarding",
      "engagement",
      "content",
      "booking",
      "achievement",
      "admin",
      "general",
    ])
    .default("general"),
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  body: z.string().min(1, "Body is required").max(500, "Body too long"),
  target_audience: targetAudienceSchema,
  data: z.record(z.string(), z.unknown()).optional(),
  variables: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
});

// Video schemas
export const difficultyLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);

// Notification trigger schemas
export const triggerConditionSchema = z.discriminatedUnion("type", [
  // User inactivity trigger
  z.object({
    type: z.literal("user_inactive"),
    days_inactive: z.number().min(1).max(365),
    exclude_new_users: z.boolean().default(true),
    min_activity_threshold: z.number().min(1).default(1),
  }),
  // Signup incomplete trigger
  z.object({
    type: z.literal("signup_incomplete"),
    hours_since_signup: z.number().min(1).max(168), // Max 1 week
    require_push_token: z.boolean().default(true),
    exclude_completed: z.boolean().default(true),
  }),
  // Video abandoned trigger
  z.object({
    type: z.literal("video_abandoned"),
    watch_percentage_threshold: z.number().min(10).max(90).default(25),
    hours_since_abandonment: z.number().min(1).max(72),
    video_id: z.string().uuid().optional(),
    series_id: z.string().uuid().optional(),
  }),
  // Practice streak broken trigger
  z.object({
    type: z.literal("practice_streak_broken"),
    min_streak_length: z.number().min(2).default(3),
    days_since_break: z.number().min(1).max(14).default(2),
  }),
  // Milestone reached trigger
  z.object({
    type: z.literal("milestone_reached"),
    milestone_type: z.enum([
      "video_completed",
      "practice_hours",
      "streak_achieved",
    ]),
    threshold_value: z.number().min(1),
    celebration_window_hours: z.number().min(1).max(48).default(24),
  }),
]);

export const notificationTriggerSchema = z.object({
  name: z.string().min(1, "Trigger name is required"),
  description: z.string().optional(),
  trigger_type: z.enum([
    "user_inactive",
    "signup_incomplete",
    "video_abandoned",
    "practice_streak_broken",
    "milestone_reached",
  ]),
  condition_config: triggerConditionSchema,
  template_id: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  body: z.string().min(1, "Body is required").max(500, "Body too long"),
  target_audience: targetAudienceSchema,
  is_active: z.boolean().default(true),
  priority: z.number().min(1).max(10).default(5),
});

// Simplified form schema without discriminated unions for React Hook Form
export const triggerFormSchema = z.object({
  name: z.string().min(1, "Trigger name is required"),
  description: z.string().optional(),
  trigger_type: z.enum([
    "user_inactive",
    "signup_incomplete",
    "video_abandoned",
    "practice_streak_broken",
    "milestone_reached",
  ]),
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  body: z.string().min(1, "Body is required").max(500, "Body too long"),
  is_active: z.boolean(),
  priority: z.number().min(1).max(10),
  // All possible condition fields (optional)
  days_inactive: z.number().optional(),
  exclude_new_users: z.boolean().optional(),
  min_activity_threshold: z.number().optional(),
  hours_since_signup: z.number().optional(),
  require_push_token: z.boolean().optional(),
  exclude_completed: z.boolean().optional(),
  watch_percentage_threshold: z.number().optional(),
  min_watch_time_seconds: z.number().optional(),
  days_since_break: z.number().optional(),
  min_streak_length: z.number().optional(),
  milestone_type: z
    .enum(["video_completed", "practice_hours", "streak_achieved"])
    .optional(),
  threshold_value: z.number().optional(),
  celebration_window_hours: z.number().optional(),
});

// Throttle settings schema
export const throttleSettingsSchema = z.object({
  enabled: z.boolean(),
  max_notifications_per_day: z.number().min(1).max(20),
  cooldown_hours_between_campaigns: z.number().min(1).max(168),
  priority_override_threshold: z.number().min(1).max(10),
  respect_user_preferences: z.boolean(),
});

export const videoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  video_url: z.string().url("Must be a valid URL"),
  thumbnail_url: z.string().url().optional().or(z.literal("")),
  duration_seconds: z.number().int().positive().optional(),
  series_id: z.string().uuid().optional().nullable(),
  artist_id: z.string().uuid().optional().nullable(),
  difficulty_level: difficultyLevelSchema.optional().nullable(),
  tags: z.array(z.string()),
  pdf_url: z.string().url().optional().or(z.literal("")),
  is_published: z.boolean(),
  is_free: z.boolean(),
  display_order: z.number().int(),
});

export const videoSeriesSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  thumbnail_url: z.string().url().optional().or(z.literal("")),
  artist_id: z.string().uuid().optional().nullable(),
  difficulty_level: difficultyLevelSchema.optional().nullable(),
  is_published: z.boolean(),
  display_order: z.number().int(),
});

// Artist schemas
export const artistSchema = z.object({
  name: z.string().min(1, "Name is required"),
  bio: z.string().optional(),
  profile_image_url: z.string().url().optional().or(z.literal("")),
  website_url: z.string().url().optional().or(z.literal("")),
  instagram_handle: z.string().optional(),
  is_active: z.boolean(),
});

// Goal schemas
export const goalTypeSchema = z.enum([
  "practice_time",
  "video_completion",
  "streak",
  "custom",
]);

export const goalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  goal_type: goalTypeSchema,
  target_value: z.number().int().positive("Target must be a positive number"),
  target_unit: z.string().optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  is_active: z.boolean(),
  is_featured: z.boolean(),
  badge_image_url: z.string().url().optional().or(z.literal("")),
});

// Drum Zone schemas
export const openingHoursSchema = z.object({
  monday: z.object({ open: z.string(), close: z.string() }).optional(),
  tuesday: z.object({ open: z.string(), close: z.string() }).optional(),
  wednesday: z.object({ open: z.string(), close: z.string() }).optional(),
  thursday: z.object({ open: z.string(), close: z.string() }).optional(),
  friday: z.object({ open: z.string(), close: z.string() }).optional(),
  saturday: z.object({ open: z.string(), close: z.string() }).optional(),
  sunday: z.object({ open: z.string(), close: z.string() }).optional(),
});

export const drumZoneSiteSchema = z.object({
  name: z.string().min(1, "Site name is required"),
  description: z.string().optional(),
  address: z.string().optional(),
  timezone: z.string(),
  is_active: z.boolean(),
  opening_hours: openingHoursSchema.optional(),
});

export const drumZoneRoomSchema = z.object({
  site_id: z.string().uuid("Site is required"),
  name: z.string().min(1, "Room name is required"),
  description: z.string().optional(),
  kit_description: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal("")),
  hourly_rate: z.number().positive().optional(),
  is_active: z.boolean(),
});

export const bookingStatusSchema = z.enum([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

export const drumZoneBookingSchema = z.object({
  room_id: z.string().uuid("Room is required"),
  user_id: z.string().uuid("User is required"),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  status: bookingStatusSchema.default("confirmed"),
  total_price: z.number().positive().optional(),
  notes: z.string().optional(),
});

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Type exports
export type ScheduledNotificationInput = z.infer<
  typeof scheduledNotificationSchema
>;
export type NotificationTemplateInput = z.infer<
  typeof notificationTemplateSchema
>;
export type NotificationTriggerInput = z.infer<
  typeof notificationTriggerSchema
>;
export type TriggerFormValues = z.infer<typeof triggerFormSchema>;
export type TriggerCondition = z.infer<typeof triggerConditionSchema>;
export type ThrottleSettings = z.infer<typeof throttleSettingsSchema>;
export type ThrottleSettingsType = z.infer<typeof throttleSettingsSchema>;
export type VideoInput = z.infer<typeof videoSchema>;
export type VideoSeriesInput = z.infer<typeof videoSeriesSchema>;
export type ArtistInput = z.infer<typeof artistSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type DrumZoneSiteInput = z.infer<typeof drumZoneSiteSchema>;
export type DrumZoneRoomInput = z.infer<typeof drumZoneRoomSchema>;
export type DrumZoneBookingInput = z.infer<typeof drumZoneBookingSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TargetAudience = z.infer<typeof targetAudienceSchema>;

// Feature Request schemas
export const featureRequestStatusSchema = z.enum([
  "submitted",
  "under_review",
  "accepted",
  "in_progress",
  "testing",
  "completed",
  "released",
  "rejected",
  "duplicate",
]);

export const featureRequestPrioritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const featureRequestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(5000, "Description too long"),
  status: featureRequestStatusSchema.optional().default("submitted"),
  priority: featureRequestPrioritySchema.optional().default("medium"),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  admin_notes: z.string().max(5000).optional(),
  estimated_effort: z.number().int().min(1).max(100).optional(),
  target_release: z.string().max(50).optional(),
  is_archived: z.boolean().optional().default(false),
  archive_reason: z.string().max(500).optional(),
});

export const featureRequestUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  status: featureRequestStatusSchema.optional(),
  priority: featureRequestPrioritySchema.optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  admin_notes: z.string().max(5000).optional(),
  estimated_effort: z.number().int().min(1).max(100).optional(),
  target_release: z.string().max(50).optional(),
  is_archived: z.boolean().optional(),
  archive_reason: z.string().max(500).optional(),
});

export const featureRequestCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment too long"),
  is_admin_comment: z.boolean().optional().default(true),
});

export const featureRequestFilterSchema = z.object({
  status: z.array(featureRequestStatusSchema).optional(),
  priority: z.array(featureRequestPrioritySchema).optional(),
  category: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  is_archived: z.boolean().optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
  min_votes: z.number().int().min(0).optional(),
});

export type FeatureRequestInput = z.infer<typeof featureRequestSchema>;
export type FeatureRequestUpdateInput = z.infer<
  typeof featureRequestUpdateSchema
>;
export type FeatureRequestCommentInput = z.infer<
  typeof featureRequestCommentSchema
>;
export type FeatureRequestFilter = z.infer<typeof featureRequestFilterSchema>;
export type FeatureRequestStatus = z.infer<typeof featureRequestStatusSchema>;
export type FeatureRequestPriority = z.infer<
  typeof featureRequestPrioritySchema
>;
