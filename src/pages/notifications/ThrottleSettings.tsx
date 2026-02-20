import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTriggerStore } from "@/stores/triggerStore";
import {
  throttleSettingsSchema,
  type ThrottleSettingsType,
} from "@/types/schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { X, Shield, Clock, Bell } from "lucide-react";

interface ThrottleSettingsProps {
  onClose: () => void;
}

export function ThrottleSettings({ onClose }: ThrottleSettingsProps) {
  const { throttleSettings, updateThrottleSettings, fetchThrottleSettings } = useTriggerStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchThrottleSettings();
  }, []);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ThrottleSettingsType>({
    resolver: zodResolver(throttleSettingsSchema),
    defaultValues: throttleSettings,
  });

  const watchedEnabled = watch("enabled");

  const onSubmit = async (values: ThrottleSettingsType) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateThrottleSettings(values);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000); // Hide success message after 3 seconds
      } else {
        setError(result.error || "Failed to update throttle settings");
      }
    } catch (err) {
      console.error("Error updating throttle settings:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Notification Throttling
          </h2>
          <p className="text-muted-foreground">
            Configure limits to prevent notification bombardment and improve
            user experience
          </p>
        </div>
        <Button variant="outline" onClick={onClose} className="gap-2">
          <X className="w-4 h-4" />
          Close
        </Button>
      </div>

      {success && (
        <Alert variant="success" className="mb-6">
          Throttle settings updated successfully!
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-6">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Master Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Throttling Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Enable Notification Throttling</h4>
                <p className="text-sm text-muted-foreground">
                  Protect users from receiving too many notifications
                </p>
              </div>
              <Switch
                id="enabled"
                checked={watchedEnabled}
                onCheckedChange={(checked) => setValue("enabled", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Throttle Configuration */}
        <Card
          className={!watchedEnabled ? "opacity-50 pointer-events-none" : ""}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Throttle Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Daily Limit */}
            <div>
              <Label htmlFor="max_notifications_per_day">
                Maximum Notifications Per Day
              </Label>
              <Input
                {...register("max_notifications_per_day", {
                  valueAsNumber: true,
                })}
                type="number"
                min={1}
                max={20}
                placeholder="3"
                disabled={!watchedEnabled}
              />
              {errors.max_notifications_per_day && (
                <p className="text-sm text-destructive mt-1">
                  {errors.max_notifications_per_day.message}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Recommended: 2-5 notifications per day to avoid overwhelming
                users
              </p>
            </div>

            {/* Cooldown Period */}
            <div>
              <Label htmlFor="cooldown_hours_between_campaigns">
                Cooldown Hours Between Campaigns
              </Label>
              <Input
                {...register("cooldown_hours_between_campaigns", {
                  valueAsNumber: true,
                })}
                type="number"
                min={1}
                max={168}
                placeholder="24"
                disabled={!watchedEnabled}
              />
              {errors.cooldown_hours_between_campaigns && (
                <p className="text-sm text-destructive mt-1">
                  {errors.cooldown_hours_between_campaigns.message}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Minimum time between notifications to the same user (1-168
                hours)
              </p>
            </div>

            {/* Priority Override */}
            <div>
              <Label htmlFor="priority_override_threshold">
                Priority Override Threshold
              </Label>
              <Input
                {...register("priority_override_threshold", {
                  valueAsNumber: true,
                })}
                type="number"
                min={1}
                max={10}
                placeholder="8"
                disabled={!watchedEnabled}
              />
              {errors.priority_override_threshold && (
                <p className="text-sm text-destructive mt-1">
                  {errors.priority_override_threshold.message}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Triggers with priority ≥ this value can bypass throttling limits
              </p>
            </div>

            {/* User Preferences */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <h4 className="font-medium">Respect User Preferences</h4>
                <p className="text-sm text-muted-foreground">
                  Honor user notification settings and opt-out preferences
                </p>
              </div>
              <Switch
                id="respect_user_preferences"
                checked={watch("respect_user_preferences")}
                onCheckedChange={(checked) =>
                  setValue("respect_user_preferences", checked)
                }
                disabled={!watchedEnabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Throttling Examples */}
        <Card>
          <CardHeader>
            <CardTitle>How Throttling Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="grid gap-2">
                <h4 className="font-medium">Daily Limit Protection</h4>
                <p className="text-muted-foreground">
                  If a user has already received{" "}
                  {watch("max_notifications_per_day")} notifications today,
                  additional triggers will be blocked unless they have high
                  priority (≥{watch("priority_override_threshold")}).
                </p>
              </div>

              <div className="grid gap-2">
                <h4 className="font-medium">Cooldown Protection</h4>
                <p className="text-muted-foreground">
                  After receiving a notification, users won't receive another
                  for {watch("cooldown_hours_between_campaigns")} hours, unless
                  the new notification has priority ≥
                  {watch("priority_override_threshold")}.
                </p>
              </div>

              <div className="grid gap-2">
                <h4 className="font-medium">User Preferences</h4>
                <p className="text-muted-foreground">
                  {watch("respect_user_preferences")
                    ? "Users who have disabled notifications will not receive triggered notifications."
                    : "Admin-triggered notifications will be sent regardless of user preferences (not recommended)."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 justify-end pt-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
