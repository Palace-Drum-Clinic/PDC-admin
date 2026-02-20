import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Bell, Send, Save, Clock, FileText } from "lucide-react";
import { useNotificationStore } from "@/stores";
import type {
  ScheduledNotificationInput,
  TargetAudience,
} from "@/types/schemas";
import type { NotificationTemplate } from "@/types";
import {
  Button,
  Input,
  Textarea,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Alert,
  LoadingState,
  Select,
  Badge,
} from "@/components/ui";
import { Link } from "react-router-dom";

// Form validation schema
const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  body: z.string().min(1, "Body is required").max(500, "Body too long"),
  scheduled_for: z.string().optional(),
  audience_type: z.enum(["all", "all_users", "registered_only", "anonymous_only", "admins", "segment", "users"]),
  send_immediately: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export function NotificationFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const {
    notifications,
    templates,
    isLoading,
    error,
    createNotification,
    updateNotification,
    sendInstantNotification,
    fetchNotifications,
    fetchTemplates,
  } = useNotificationStore();

  const [isSaving, setIsSaving] = useState(false);
  const [sendType, setSendType] = useState<"schedule" | "instant">("schedule");
  const [selectedTemplate, setSelectedTemplate] =
    useState<NotificationTemplate | null>(null);

  const {
    register,
    handleSubmit,
    reset,

    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      body: "",
      scheduled_for: "",
      audience_type: "all",
      send_immediately: false,
    },
  });

  useEffect(() => {
    fetchTemplates(); // Load templates when component mounts
    if (isEditing) {
      fetchNotifications();
    }
  }, [isEditing, fetchNotifications, fetchTemplates]);

  useEffect(() => {
    if (isEditing && notifications.length > 0) {
      const notification = notifications.find((n) => n.id === id);
      if (notification) {
        // Parse target_audience from JSON
        const audienceData =
          notification.target_audience as TargetAudience | null;
        reset({
          title: notification.title,
          body: notification.body,
          scheduled_for: notification.scheduled_for.slice(0, 16), // Format for datetime-local
          audience_type: audienceData?.type || "all",
        });
      }
    }
  }, [isEditing, id, notifications, reset]);

  // Handle template selection
  const handleTemplateSelect = (template: NotificationTemplate) => {
    setSelectedTemplate(template);

    // Parse target audience
    const audienceData = template.target_audience as TargetAudience;
    const audienceType = audienceData?.type || "all";

    setValue("title", template.title);
    setValue("body", template.body);
    setValue("audience_type", audienceType as FormValues["audience_type"]);
  };

  // Replace variables in template content
  const replaceTemplateVariables = (content: string): string => {
    if (!selectedTemplate?.variables) return content;

    let result = content;
    selectedTemplate.variables.forEach((variable) => {
      // Replace with example values for preview
      const exampleValues: Record<string, string> = {
        user_name: "John Doe",
        app_name: "Palace Drum Clinic",
        artist_name: "Mike Johnston",
        content_type: "video lesson",
        site_name: "Downtown Studio",
        room_name: "Room A",
        booking_time: "2:00 PM",
        achievement_name: "Practice Streak",
      };

      const regex = new RegExp(`{${variable}}`, "g");
      result = result.replace(
        regex,
        exampleValues[variable] || `{${variable}}`
      );
    });

    return result;
  };

  const onSubmit = async (data: FormValues) => {
    setIsSaving(true);
    try {
      if (sendType === "instant") {
        // Send notification immediately
        const result = await sendInstantNotification({
          title: data.title,
          body: data.body,
          audience_type: data.audience_type,
        });

        if (!result.success) {
          throw new Error(
            result.error || "Failed to send instant notification"
          );
        }
      } else {
        // Schedule notification
        if (!data.scheduled_for) {
          throw new Error(
            "Schedule time is required for scheduled notifications"
          );
        }

        // Validate that scheduled time is in the future
        const scheduledDate = new Date(data.scheduled_for);
        const minDate = new Date(Date.now() + 30 * 1000); // 30 seconds

        if (scheduledDate < minDate) {
          throw new Error(
            "Scheduled time must be at least 30 seconds in the future"
          );
        }

        // Build the target_audience object based on type
        const targetAudience: TargetAudience =
          data.audience_type === "all"
            ? { type: "all" }
            : data.audience_type === "all_users"
            ? { type: "all_users" }
            : data.audience_type === "registered_only"
            ? { type: "registered_only" }
            : data.audience_type === "anonymous_only"
            ? { type: "anonymous_only" }
            : data.audience_type === "admins"
            ? { type: "admins" }
            : data.audience_type === "segment"
            ? { type: "segment", filter: {} }
            : { type: "users", userIds: [] };

        const notificationData: ScheduledNotificationInput = {
          title: data.title,
          body: data.body,
          scheduled_for: scheduledDate.toISOString(),
          target_audience: targetAudience,
        };

        if (isEditing && id) {
          const result = await updateNotification(id, notificationData);
          if (!result.success) {
            throw new Error(result.error || "Failed to update notification");
          }
        } else {
          const result = await createNotification(notificationData);
          if (!result.success) {
            throw new Error(result.error || "Failed to create notification");
          }
        }
      }
      navigate("/notifications");
    } catch (error) {
      console.error("Form submission error:", error);
      // Error will be set by the store, but we could add a toast here
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate min datetime (now + 30 seconds)
  const minDateTime = new Date(Date.now() + 30 * 1000)
    .toISOString()
    .slice(0, 16);

  if (isLoading && isEditing) {
    return <LoadingState message="Loading notification..." />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/notifications">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            {isEditing ? "Edit Notification" : "Schedule Notification"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditing
              ? "Update the notification details."
              : "Create a new push notification for your users."}
          </p>
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Notification Details</CardTitle>
            <CardDescription>
              Configure the content and timing of your push notification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template Selection */}
            {!isEditing && (
              <div className="space-y-2">
                <Label>Start from Template (Optional)</Label>
                <Select
                  value={selectedTemplate?.id || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const template = templates.find((t) => t.id === value);
                    if (template) {
                      handleTemplateSelect(template);
                    } else {
                      setSelectedTemplate(null);
                    }
                  }}
                  options={[
                    { value: "", label: "Create from scratch" },
                    ...templates
                      .filter((t) => t.is_active)
                      .map((template) => ({
                        value: template.id,
                        label: `${template.name} (${template.category})`,
                      })),
                  ]}
                />

                {selectedTemplate && (
                  <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium text-sm">
                        {selectedTemplate.name}
                      </span>
                      <Badge variant="secondary">
                        {selectedTemplate.category}
                      </Badge>
                    </div>

                    {selectedTemplate.variables &&
                      selectedTemplate.variables.length > 0 && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">
                            Variables to replace:{" "}
                          </span>
                          {selectedTemplate.variables.map((variable) => (
                            <Badge
                              key={variable}
                              variant="outline"
                              className="ml-1"
                            >
                              {variable}
                            </Badge>
                          ))}
                        </div>
                      )}

                    <div className="text-xs text-muted-foreground">
                      <div>
                        <strong>Preview Title:</strong>{" "}
                        {replaceTemplateVariables(selectedTemplate.title)}
                      </div>
                      <div>
                        <strong>Preview Body:</strong>{" "}
                        {replaceTemplateVariables(selectedTemplate.body)}
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Select a template to auto-fill the form fields, then customize
                  as needed.
                </p>
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="New lesson available!"
                {...register("title")}
              />
              {errors.title && (
                <p className="text-sm text-destructive">
                  {errors.title.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Keep it short and engaging. Max 50 characters recommended.
              </p>
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="body">Body *</Label>
              <Textarea
                id="body"
                placeholder="Check out the latest drumming techniques from our expert instructors..."
                rows={3}
                {...register("body")}
              />
              {errors.body && (
                <p className="text-sm text-destructive">
                  {errors.body.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                The main message of your notification. Max 150 characters
                recommended.
              </p>
            </div>

            {/* Send Type Selection */}
            <div className="space-y-2">
              <Label>Send Options</Label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="instant"
                    checked={sendType === "instant"}
                    onChange={(e) =>
                      setSendType(e.target.value as "instant" | "schedule")
                    }
                    className="text-primary focus:ring-primary"
                  />
                  <span>Send Now</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="schedule"
                    checked={sendType === "schedule"}
                    onChange={(e) =>
                      setSendType(e.target.value as "instant" | "schedule")
                    }
                    className="text-primary focus:ring-primary"
                  />
                  <span>Schedule for Later</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Send now will deliver the notification immediately. Schedule for
                later allows you to set a specific time.
              </p>
            </div>

            {/* Scheduled For - only show when scheduling */}
            {sendType === "schedule" && (
              <div className="space-y-2">
                <Label htmlFor="scheduled_for">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Schedule For *
                </Label>
                <Input
                  id="scheduled_for"
                  type="datetime-local"
                  min={minDateTime}
                  {...register("scheduled_for")}
                />
                {errors.scheduled_for && (
                  <p className="text-sm text-destructive">
                    {errors.scheduled_for.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  When should this notification be sent? Must be at least 30
                  seconds in the future.
                </p>
              </div>
            )}

            {/* Target Audience */}
            <div className="space-y-2">
              <Label htmlFor="audience_type">Target Audience *</Label>
              <select
                id="audience_type"
                {...register("audience_type")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="all_users">All Users (Registered + Anon)</option>
                <option value="registered_only">Registered Users (Non-Anon)</option>
                <option value="anonymous_only">Anon Users Only</option>
                <option value="all">All Registered Users (Legacy)</option>
                <option value="admins">Admins Only</option>
                <option value="segment">Custom Segment</option>
                <option value="users">Specific Users</option>
              </select>
              {errors.audience_type && (
                <p className="text-sm text-destructive">
                  {errors.audience_type.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Choose who should receive this notification. Anon users are app users who haven't signed up yet.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/notifications")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>Sending...</>
              ) : isEditing ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              ) : sendType === "instant" ? (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Now
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule Notification
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
