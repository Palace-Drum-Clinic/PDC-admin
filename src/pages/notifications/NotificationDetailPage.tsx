import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Bell, Users, Send, CheckCircle2, XCircle, Eye, MousePointerClick, AlertCircle, RefreshCw } from "lucide-react";
import { useNotificationStore, useNotificationAnalyticsStore } from "@/stores";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  LoadingState,
  Alert,
  Badge,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import type { ScheduledNotification, TargetAudience } from "@/types";

const statusConfig = {
  pending: { label: "Pending", variant: "secondary" as const, icon: AlertCircle, color: "text-gray-500" },
  sent: { label: "Sent", variant: "success" as const, icon: CheckCircle2, color: "text-green-500" },
  failed: { label: "Failed", variant: "destructive" as const, icon: XCircle, color: "text-red-500" },
  cancelled: { label: "Cancelled", variant: "outline" as const, icon: XCircle, color: "text-gray-400" },
};

export function NotificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { notifications, fetchNotifications, isLoading: notificationLoading } = useNotificationStore();
  const { analytics, fetchAnalyticsEvents } = useNotificationAnalyticsStore();
  const [notification, setNotification] = useState<ScheduledNotification | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
    if (id) {
      fetchAnalyticsEvents(id);
    }
  }, [id, fetchNotifications, fetchAnalyticsEvents]);

  useEffect(() => {
    if (notifications.length > 0 && id) {
      const found = notifications.find((n) => n.id === id);
      setNotification(found || null);
    }
  }, [notifications, id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    if (id) {
      await fetchAnalyticsEvents(id);
    }
    setRefreshing(false);
  };

  if (notificationLoading && !notification) {
    return <LoadingState message="Loading notification details..." />;
  }

  if (!notification) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          Notification not found. It may have been deleted.
        </Alert>
        <Button variant="outline" asChild>
          <Link to="/notifications">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Notifications
          </Link>
        </Button>
      </div>
    );
  }

  // Calculate analytics metrics
  const sentEvent = analytics.find((a) => a.event_type === "sent");
  const deliveredEvent = analytics.find((a) => a.event_type === "delivered");
  const openedEvent = analytics.find((a) => a.event_type === "opened");
  const clickedEvent = analytics.find((a) => a.event_type === "clicked");
  const dismissedEvent = analytics.find((a) => a.event_type === "dismissed");
  const failedEvent = analytics.find((a) => a.event_type === "failed");

  const totalSent = sentEvent?.device_count || 0;
  const totalDelivered = deliveredEvent?.device_count || 0;
  const totalOpened = openedEvent?.device_count || 0;
  const totalClicked = clickedEvent?.device_count || 0;
  const totalDismissed = dismissedEvent?.device_count || 0;
  const totalFailed = failedEvent?.device_count || 0;

  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const openRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0;
  const clickRate = totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100) : 0;
  const dismissRate = totalDelivered > 0 ? Math.round((totalDismissed / totalDelivered) * 100) : 0;

  // Parse target audience
  const targetAudience = notification.target_audience as TargetAudience;
  const audienceLabel = targetAudience?.type === "all"
    ? "All Registered Users"
    : targetAudience?.type === "all_users"
    ? "All Users (Registered + Anon)"
    : targetAudience?.type === "registered_only"
    ? "Registered Users Only"
    : targetAudience?.type === "anonymous_only"
    ? "Anonymous Users Only"
    : targetAudience?.type === "admins"
    ? "Admins Only"
    : targetAudience?.type === "segment"
    ? "Custom Segment"
    : targetAudience?.type === "users"
    ? `${targetAudience.userIds?.length || 0} Specific Users`
    : "Unknown";

  const statusInfo = statusConfig[notification.status];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
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
              Notification Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Detailed performance metrics and delivery status
            </p>
          </div>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Notification Details Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl">{notification.title}</CardTitle>
              <CardDescription className="mt-2 text-base">
                {notification.body}
              </CardDescription>
            </div>
            <Badge variant={statusInfo.variant} className="gap-1">
              <StatusIcon className="h-4 w-4" />
              {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Target Audience</p>
              <p className="font-medium flex items-center gap-2 mt-1">
                <Users className="h-4 w-4" />
                {audienceLabel}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Scheduled For</p>
              <p className="font-medium mt-1">
                {formatDateTime(notification.scheduled_for)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sent At</p>
              <p className="font-medium mt-1">
                {notification.sent_at
                  ? formatDateTime(notification.sent_at)
                  : "Not sent yet"}
              </p>
            </div>
          </div>
          {notification.error_message && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <div>
                <p className="font-medium">Error</p>
                <p className="text-sm">{notification.error_message}</p>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Analytics Metrics */}
      {notification.status === "sent" && (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Sent */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Sent</p>
                    <p className="text-3xl font-bold mt-2">{totalSent.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Push notifications sent
                    </p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Send className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivered */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Delivered</p>
                    <p className="text-3xl font-bold mt-2">{totalDelivered.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {deliveryRate}% delivery rate
                    </p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Opened */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Opened</p>
                    <p className="text-3xl font-bold mt-2">{totalOpened.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {openRate}% open rate
                    </p>
                  </div>
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Eye className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clicked */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Clicked</p>
                    <p className="text-3xl font-bold mt-2">{totalClicked.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {clickRate}% click rate
                    </p>
                  </div>
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <MousePointerClick className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dismissed Metric (if any) */}
          {totalDismissed > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-gray-500" />
                  Dismissed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">
                      {totalDismissed.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {dismissRate}% dismiss rate (iOS only)
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground max-w-md">
                    <p>Users who swiped away the notification without opening it.</p>
                    <p className="mt-1 text-xs">Note: Dismiss tracking only works on iOS with configured notification categories.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Failed Notifications */}
          {totalFailed > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  Failed Deliveries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-red-500">
                      {totalFailed.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Notifications failed to deliver
                    </p>
                  </div>
                  {failedEvent?.metadata && (
                    <div className="text-sm text-muted-foreground">
                      <p>Failure reasons may include:</p>
                      <ul className="list-disc list-inside mt-1">
                        <li>Invalid push token</li>
                        <li>Device offline</li>
                        <li>App uninstalled</li>
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Performance Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Summary</CardTitle>
              <CardDescription>
                How well this notification performed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Delivery Rate Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Delivery Rate</span>
                    <span className="font-medium">{deliveryRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${deliveryRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {deliveryRate >= 95
                      ? "Excellent delivery rate!"
                      : deliveryRate >= 85
                      ? "Good delivery rate"
                      : "Delivery rate could be improved"}
                  </p>
                </div>

                {/* Open Rate Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Open Rate</span>
                    <span className="font-medium">{openRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${openRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {openRate >= 20
                      ? "Great engagement!"
                      : openRate >= 10
                      ? "Average engagement"
                      : openRate > 0
                      ? "Low engagement - consider improving your message"
                      : "No opens yet - data may still be processing"}
                  </p>
                </div>

                {/* Click Rate Bar */}
                {totalClicked > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Click Rate</span>
                      <span className="font-medium">{clickRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all"
                        style={{ width: `${clickRate}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {clickRate >= 50
                        ? "Outstanding click-through rate!"
                        : clickRate >= 25
                        ? "Good click-through rate"
                        : "Consider adding a stronger call-to-action"}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Analytics Events Table */}
          {analytics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Event Log</CardTitle>
                <CardDescription>
                  Detailed timeline of notification events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{event.event_type}</Badge>
                        <span className="text-sm">
                          {event.device_count} device{event.device_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(event.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* No Analytics Yet */}
      {notification.status === "sent" && analytics.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Analytics Data Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Analytics data is still being collected. This can take a few minutes after sending.
              Try refreshing this page in a moment.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pending/Not Sent */}
      {notification.status !== "sent" && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {notification.status === "pending"
                ? "Notification Not Sent Yet"
                : notification.status === "cancelled"
                ? "Notification Cancelled"
                : "Notification Failed"}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {notification.status === "pending"
                ? "Analytics will be available once this notification has been sent."
                : notification.status === "cancelled"
                ? "This notification was cancelled before sending."
                : "This notification failed to send. Check the error message above."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
