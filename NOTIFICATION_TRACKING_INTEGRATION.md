# Palace Drum Clinic - Notification Analytics Tracking

Complete implementation guide for notification analytics tracking across the admin portal and React Native mobile app.

---

## Table of Contents

1. [Overview](#overview)
2. [Admin Portal Implementation](#admin-portal-implementation)
3. [Mobile App Integration](#mobile-app-integration)
4. [Database Schema](#database-schema)
5. [Edge Function Implementation](#edge-function-implementation)
6. [Analytics Queries](#analytics-queries)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)

---

## Overview

The notification system tracks user engagement through four key events:

| Event       | Description                    | When It Fires             | Typical Delay |
| ----------- | ------------------------------ | ------------------------- | ------------- |
| `delivered` | Notification arrives at device | When push received        | < 5 seconds   |
| `opened`    | User taps notification         | User interaction          | Immediate     |
| `clicked`   | User taps deep link/action     | After opened event        | Immediate     |
| `dismissed` | User swipes away notification  | User dismisses (iOS only) | Immediate     |

**Key Metrics:**

- **Delivery Rate**: (Delivered / Sent) × 100%
- **Open Rate**: (Opened / Delivered) × 100%
- **Click-Through Rate**: (Clicked / Opened) × 100%
- **Dismiss Rate**: (Dismissed / Delivered) × 100%

---

## Admin Portal Implementation

### 1. Sending Notifications with Tracking

✅ **ALREADY IMPLEMENTED** - The admin portal automatically includes all required fields:

- ✅ `notification_id` - Automatically generated and included in data payload
- ✅ `ios.categoryIdentifier` - Set to `"dismissable_notification"` for all notifications
- ✅ Analytics tracking - `sent` and `failed` events automatically recorded

**What the Edge Function sends:**

```typescript
// Automatically sent by process-notifications Edge Function
const pushPayload = {
  to: pushTokens,
  title: notification.title,
  body: notification.body,
  data: {
    notification_id: notification.id, // ✅ Auto-generated UUID
    ...customData, // Any additional data from admin portal
  },
  ios: {
    categoryIdentifier: "dismissable_notification", // ✅ Enables dismiss tracking
  },
};
```

No additional configuration needed in the admin portal - dismiss tracking is ready to use!

### 2. Deep Link URL Format

The mobile app supports `pdcapp://` URL scheme:

| Deep Link             | Destination      |
| --------------------- | ---------------- |
| `pdcapp://video/{id}` | Video player     |
| `pdcapp://practice`   | Practice section |
| `pdcapp://goals`      | Goals screen     |
| `pdcapp://profile`    | User profile     |
| `pdcapp://home`       | Home screen      |

### 3. iOS Notification Categories (For Dismiss Tracking)

✅ **ADMIN PORTAL SENDS THIS AUTOMATICALLY**

The mobile app just needs to configure the categories in `app.json`:

```json
{
  "expo": {
    "notification": {
      "iosNotificationCategories": [
        {
          "identifier": "dismissable_notification",
          "actions": [
            {
              "identifier": "dismiss",
              "buttonTitle": "Dismiss",
              "options": ["destructive"]
            }
          ]
        }
      ]
    }
  }
}
```

The admin portal already sends `ios.categoryIdentifier: "dismissable_notification"` with every notification.

---

## Mobile App Integration

---

## Mobile App Integration

### 1. Helper Function

Create `utils/notificationTracking.ts`:

```typescript
const SUPABASE_URL = "https://abtpozgrnhgcsmcfoiyo.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key-here";

export async function trackNotificationEvent(
  notificationId: string,
  eventType: "delivered" | "opened" | "clicked" | "dismissed",
  deviceId?: string,
) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/track-notification-event`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          notification_id: notificationId,
          event_type: eventType,
          device_id: deviceId,
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "Failed to track notification event:",
        await response.text(),
      );
    }
  } catch (error) {
    console.error("Error tracking notification event:", error);
    // Fail silently - don't block user experience
  }
}

// Helper to get device identifier
async function getDeviceId(): Promise<string> {
  const deviceName = await Device.modelName;
  const osVersion = await Device.osVersion;
  return `${deviceName}-${osVersion}`;
}
```

### 2. Track Delivered Events

```typescript
import * as Notifications from "expo-notifications";
import {
  trackNotificationEvent,
  getDeviceId,
} from "./utils/notificationTracking";

// Add notification received listener
Notifications.addNotificationReceivedListener(async (notification) => {
  const notificationId = notification.request.content.data?.notification_id;

  if (notificationId) {
    const deviceId = await getDeviceId();
    trackNotificationEvent(notificationId, "delivered", deviceId);
  }
});
```

### 3. Track Opened Events

```typescript
// Add notification response listener
Notifications.addNotificationResponseReceivedListener(async (response) => {
  const data = response.notification.request.content.data;
  const notificationId = data?.notification_id;

  if (notificationId) {
    const deviceId = await getDeviceId();
    trackNotificationEvent(notificationId, "opened", deviceId);

    // Handle deep link navigation
    const actionUrl = data?.action_url;
    if (actionUrl) {
      handleDeepLink(actionUrl);
    }
  }
});
```

### 4. Track Clicked Events

```typescript
// After handling notification action or deep link
function handleNotificationAction(notificationId: string, actionUrl: string) {
  trackNotificationEvent(notificationId, "clicked");

  // Then perform the action
  if (actionUrl.startsWith("pdcapp://video/")) {
    const videoId = actionUrl.split("/").pop();
    navigation.navigate("VideoDetail", { videoId });
  } else if (actionUrl === "pdcapp://practice") {
    navigation.navigate("Practice");
  }
  // ... handle other deep links
}
```

### 5. Track Dismissed Events (iOS)

**Method 1: Using Notification Categories**

```typescript
import * as Notifications from "expo-notifications";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
  handleSuccess: async (notificationId) => {
    console.log("Notification delivered:", notificationId);
  },
  handleError: async (notificationId, error) => {
    console.error("Notification error:", notificationId, error);
  },
});

// Add action handler for dismiss button
Notifications.addNotificationReceivedListener(async (notification) => {
  const data = notification.request.content.data;

  // iOS category actions
  if (Platform.OS === "ios") {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        if (response.actionIdentifier === "dismiss" && data?.notification_id) {
          await trackNotificationEvent(data.notification_id, "dismissed");
        }
        subscription.remove();
      },
    );
  }
});
```

**Method 2: Time-Based Tracking (Fallback)**

```typescript
import { AppState } from "react-native";

// Track dismissed notifications after 30 seconds if not opened
Notifications.addNotificationReceivedListener(async (notification) => {
  const notificationId = notification.request.content.data?.notification_id;

  if (notificationId) {
    const trackingTimeout = setTimeout(async () => {
      // Check if notification is still in tray
      const presented = await Notifications.getPresentedNotificationsAsync();
      const stillPresent = presented.some(
        (n) => n.request.content.data?.notification_id === notificationId,
      );

      if (!stillPresent) {
        // Notification was likely dismissed
        trackNotificationEvent(notificationId, "dismissed");
      }
    }, 30000); // 30 seconds

    // Clear timeout if app state changes (user opened it)
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        clearTimeout(trackingTimeout);
        subscription.remove();
      }
    });
  }
});
```

**Method 3: Background Task (Most Accurate)**

```typescript
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

const DISMISS_CHECK_TASK = "notification-dismiss-check";

// Define background task
TaskManager.defineTask(DISMISS_CHECK_TASK, async () => {
  const presented = await Notifications.getPresentedNotificationsAsync();
  const presentedIds = new Set(
    presented
      .map((n) => n.request.content.data?.notification_id)
      .filter(Boolean),
  );

  // Get previously tracked notifications from AsyncStorage
  const previouslyPresented = await AsyncStorage.getItem(
    "presented_notifications",
  );
  const previousIds = previouslyPresented
    ? JSON.parse(previouslyPresented)
    : [];

  // Find dismissed notifications
  const dismissed = previousIds.filter((id) => !presentedIds.has(id));

  // Track dismiss events
  for (const notificationId of dismissed) {
    await trackNotificationEvent(notificationId, "dismissed");
  }

  // Update storage
  await AsyncStorage.setItem(
    "presented_notifications",
    JSON.stringify(Array.from(presentedIds)),
  );

  return BackgroundFetch.BackgroundFetchResult.NewData;
});

// Register background fetch
async function registerBackgroundDismissTracking() {
  await BackgroundFetch.registerTaskAsync(DISMISS_CHECK_TASK, {
    minimumInterval: 60 * 5, // 5 minutes
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
```

### 6. Complete Integration Example

```typescript
// App.tsx or notification setup file
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { trackNotificationEvent } from "./utils/notificationTracking";

async function setupNotificationTracking() {
  const deviceId = `${await Device.modelName}-${await Device.osVersion}`;

  // 1. Track delivered
  Notifications.addNotificationReceivedListener((notification) => {
    const notificationId = notification.request.content.data?.notification_id;
    if (notificationId) {
      trackNotificationEvent(notificationId, "delivered", deviceId);
    }
  });

  // 2. Track opened & clicked
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    const notificationId = data?.notification_id;

    if (notificationId) {
      // Track opened
      trackNotificationEvent(notificationId, "opened", deviceId);

      // Track clicked if there's a deep link
      if (data?.action_url) {
        trackNotificationEvent(notificationId, "clicked", deviceId);
        handleDeepLink(data.action_url);
      }

      // Track dismissed if dismiss action
      if (response.actionIdentifier === "dismiss") {
        trackNotificationEvent(notificationId, "dismissed", deviceId);
      }
    }
  });
}

// Call on app startup
useEffect(() => {
  setupNotificationTracking();
}, []);
```

---

## Database Schema

### Scheduled Notifications Table

```sql
-- Already exists in your database
CREATE TABLE scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  target_audience JSONB NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Notification Analytics Table

```sql
-- Grant service_role access (REQUIRED)
GRANT ALL ON notification_analytics TO service_role;

-- Table structure
CREATE TABLE IF NOT EXISTS notification_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('sent', 'delivered', 'opened', 'clicked', 'dismissed', 'failed')
  ),
  device_count INTEGER DEFAULT 1,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB,

  -- Foreign key
  CONSTRAINT fk_notification
    FOREIGN KEY (notification_id)
    REFERENCES scheduled_notifications(id)
    ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_notification_analytics_notification_id
  ON notification_analytics(notification_id);

CREATE INDEX idx_notification_analytics_event_type
  ON notification_analytics(event_type);

CREATE INDEX idx_notification_analytics_timestamp
  ON notification_analytics(timestamp);

CREATE INDEX idx_notification_analytics_composite
  ON notification_analytics(notification_id, event_type);
```

### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_analytics ENABLE ROW LEVEL SECURITY;

-- Admins can manage everything
CREATE POLICY "Admins can manage scheduled_notifications"
  ON scheduled_notifications
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Service role can insert analytics (from Edge Function)
CREATE POLICY "Service role can insert analytics"
  ON notification_analytics
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Mobile app can insert analytics (using anon key)
CREATE POLICY "Apps can insert notification analytics"
  ON notification_analytics
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins can view all analytics
CREATE POLICY "Admins can view notification analytics"
  ON notification_analytics
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');
```

---

## Edge Function Implementation

The `track-notification-event` Edge Function is already deployed. Here's what it does:

### Request Schema

```typescript
{
  "notification_id": "uuid",
  "event_type": "delivered" | "opened" | "clicked" | "dismissed",
  "device_id": "optional-string"
}
```

### Response Schema

```typescript
{
  "success": boolean,
  "notification_id": "uuid",
  "event_type": "string"
}
```

### Behavior

1. **Validates** input (notification_id, event_type)
2. **Checks** if event already exists for this notification + event type
3. **If exists**: Increments `device_count` by 1
4. **If new**: Creates new analytics record with `device_count = 1`
5. **Returns** success response

This means multiple users opening the same notification will show `device_count: 10` for the "opened" event.

---

## Analytics Queries

### Get Notification Performance

```sql
SELECT
  n.id,
  n.title,
  n.scheduled_for,
  MAX(CASE WHEN a.event_type = 'sent' THEN a.device_count ELSE 0 END) as sent_count,
  MAX(CASE WHEN a.event_type = 'delivered' THEN a.device_count ELSE 0 END) as delivered_count,
  MAX(CASE WHEN a.event_type = 'opened' THEN a.device_count ELSE 0 END) as opened_count,
  MAX(CASE WHEN a.event_type = 'clicked' THEN a.device_count ELSE 0 END) as clicked_count,
  MAX(CASE WHEN a.event_type = 'dismissed' THEN a.device_count ELSE 0 END) as dismissed_count,
  ROUND(
    MAX(CASE WHEN a.event_type = 'opened' THEN a.device_count ELSE 0 END)::numeric /
    NULLIF(MAX(CASE WHEN a.event_type = 'delivered' THEN a.device_count ELSE 0 END), 0) * 100,
    2
  ) as open_rate,
  ROUND(
    MAX(CASE WHEN a.event_type = 'clicked' THEN a.device_count ELSE 0 END)::numeric /
    NULLIF(MAX(CASE WHEN a.event_type = 'opened' THEN a.device_count ELSE 0 END), 0) * 100,
    2
  ) as click_rate
FROM scheduled_notifications n
LEFT JOIN notification_analytics a ON a.notification_id = n.id
WHERE n.id = $1
GROUP BY n.id, n.title, n.scheduled_for;
```

### Campaign Performance Dashboard

```sql
SELECT
  n.id,
  n.title,
  n.scheduled_for,
  n.status,
  COUNT(DISTINCT a.id) as total_events,
  SUM(CASE WHEN a.event_type = 'sent' THEN a.device_count ELSE 0 END) as sent,
  SUM(CASE WHEN a.event_type = 'delivered' THEN a.device_count ELSE 0 END) as delivered,
  SUM(CASE WHEN a.event_type = 'opened' THEN a.device_count ELSE 0 END) as opened,
  ROUND(
    SUM(CASE WHEN a.event_type = 'opened' THEN a.device_count ELSE 0 END)::numeric /
    NULLIF(SUM(CASE WHEN a.event_type = 'delivered' THEN a.device_count ELSE 0 END), 0) * 100,
    2
  ) as open_rate
FROM scheduled_notifications n
LEFT JOIN notification_analytics a ON a.notification_id = n.id
WHERE n.scheduled_for BETWEEN $1 AND $2
  AND n.status = 'sent'
GROUP BY n.id, n.title, n.scheduled_for, n.status
ORDER BY n.scheduled_for DESC;
```

### Real-Time Event Stream

```sql
SELECT
  a.id,
  a.event_type,
  a.device_count,
  a.timestamp,
  a.metadata,
  n.title,
  n.data->>'type' as notification_type
FROM notification_analytics a
JOIN scheduled_notifications n ON n.id = a.notification_id
ORDER BY a.timestamp DESC
LIMIT 100;
```

---

## Testing

### 1. Send Test Notification

From admin portal:

```typescript
const notificationId = crypto.randomUUID();

// Send push
await sendPushNotification({
  to: "ExponentPushToken[...]",
  title: "Test Analytics",
  body: "Testing notification tracking",
  data: {
    notification_id: notificationId,
    action_url: "pdcapp://home",
  },
  ios: {
    categoryId: "default_with_dismiss",
  },
});
```

### 2. Verify Events

Check Supabase table:

```sql
SELECT * FROM notification_analytics
WHERE notification_id = 'your-test-id'
ORDER BY timestamp DESC;
```

Expected results:

- ✅ `sent` event appears immediately (from Edge Function)
- ✅ `delivered` event within 5 seconds (from mobile app)
- ✅ `opened` event when you tap notification
- ✅ `clicked` event if you have deep link
- ✅ `dismissed` event if you swipe away (iOS only)

### 3. Check Edge Function Logs

```bash
npx supabase functions logs track-notification-event --project-ref abtpozgrnhgcsmcfoiyo
```

Should see:

```
Created delivered event for notification abc-123
Incremented opened count for notification abc-123
```

---

## Troubleshooting

### No Events Being Tracked

**Check:**

1. ✅ Is `notification_id` in notification data?
2. ✅ Is Edge Function deployed? (`npx supabase functions list`)
3. ✅ Does service_role have access? (`GRANT ALL ON notification_analytics TO service_role`)
4. ✅ Are RLS policies correct?
5. ✅ Check Edge Function logs for errors

### Dismiss Events Not Working

**iOS:**

1. ✅ Notification categories configured in `app.json`?
2. ✅ `categoryId` included in iOS payload?
3. ✅ Action listener implemented?

**Android:**

- Dismiss tracking not natively supported
- Use time-based or background task method

### Duplicate Events

**Expected**: If a user opens the notification multiple times, you'll see incremented `device_count`.

**Unexpected**: If you see completely separate records, add deduplication:

```typescript
// In Edge Function, check for recent duplicate
const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();

const { data: recent } = await supabase
  .from("notification_analytics")
  .select("id")
  .eq("notification_id", notification_id)
  .eq("event_type", event_type)
  .gte("timestamp", fiveSecondsAgo)
  .single();

if (recent) {
  return new Response(
    JSON.stringify({ success: true, message: "Duplicate prevented" }),
    { status: 200, headers: corsHeaders },
  );
}
```

### Events Missing in Dashboard

**Check:**

1. ✅ Is `fetchAnalyticsEvents()` being called?
2. ✅ Are you filtering by correct `notification_id`?
3. ✅ Does the admin user have SELECT permissions?
4. ✅ Refresh the page to clear stale data

---

## Security Considerations

### 1. Authentication

Mobile app uses Supabase anon key. RLS policies ensure:

- ✅ Apps can only INSERT analytics (not update/delete)
- ✅ Only admins can view analytics
- ✅ Service role can insert from Edge Function

### 2. Rate Limiting

Consider adding rate limiting to prevent abuse:

```typescript
// In Edge Function (using Upstash Redis or similar)
const identifier =
  device_id || req.headers.get("x-forwarded-for") || "anonymous";
const { success } = await ratelimit.limit(identifier);

if (!success) {
  return new Response("Rate limit exceeded", {
    status: 429,
    headers: corsHeaders,
  });
}
```

### 3. Data Validation

Always validate UUIDs server-side:

```typescript
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!uuidRegex.test(notification_id)) {
  return new Response("Invalid notification_id", { status: 400 });
}
```

### 4. Privacy

Device IDs are non-personal:

- ✅ Format: `"iPhone 15 Pro-17.4"` (model + OS version)
- ✅ No UDID, IDFA, or user identifiers
- ✅ Optional field - can be omitted

---

## Next Steps

### Admin Portal

- [x] Include `notification_id` in push payloads ✅
- [x] Add `ios.categoryIdentifier` to enable dismiss tracking ✅
- [x] Deploy `track-notification-event` Edge Function ✅
- [x] Grant service_role access to tables ✅
- [x] Configure RLS policies ✅
- [x] Build analytics dashboard (NotificationDetailPage) ✅
- [x] Display dismiss metrics in dashboard ✅

### Mobile App

- [ ] Add `trackNotificationEvent` helper function
- [ ] Implement delivered event tracking
- [ ] Implement opened event tracking
- [ ] Implement clicked event tracking
- [ ] (Optional) Implement dismissed event tracking
- [ ] Configure iOS notification categories
- [ ] Test end-to-end on real devices

### Monitoring

- [ ] Set up alerts for Edge Function errors
- [ ] Monitor analytics data completeness
- [ ] Track delivery rates over time

---

## Support & Documentation

**Admin Portal:** `/Users/josh/coding/projects/PDC-admin`

**Edge Functions:**

- `process-notifications` - Sends notifications, records `sent`/`failed` events
- `track-notification-event` - Receives analytics from mobile app

**Supabase Project:** `abtpozgrnhgcsmcfoiyo`

**Tables:**

- `scheduled_notifications` - Notification queue
- `notification_analytics` - Event tracking data
- `AnonymousUser` - Anonymous user push tokens

**Useful Commands:**

```bash
# Deploy Edge Functions
npx supabase functions deploy process-notifications --project-ref abtpozgrnhgcsmcfoiyo
npx supabase functions deploy track-notification-event --project-ref abtpozgrnhgcsmcfoiyo

# View logs
npx supabase functions logs track-notification-event --project-ref abtpozgrnhgcsmcfoiyo

# Check database
npx supabase db dump --table notification_analytics

# Grant permissions
GRANT ALL ON notification_analytics TO service_role;
GRANT ALL ON AnonymousUser TO service_role;
```
