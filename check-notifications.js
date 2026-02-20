console.log("Checking notification data...");

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://abtpozgrnhgcsmcfoiyo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHBvenYybmhnY3NtY2ZvaXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjcyNDMxNzgsImV4cCI6MjA0MjgxOTE3OH0.8gfrD4oJhYrKJU7PKI9K5SfWjKLGdLZbhd_wqI5YhKU",
);

async function checkData() {
  console.log("\n=== ANONYMOUS USERS ===");
  const { data: anonUsers, error: anonError } = await supabase
    .from("AnonymousUser")
    .select("*")
    .limit(10);

  if (anonError) {
    console.error("Error fetching anonymous users:", anonError);
  } else {
    console.log("Total anonymous users (sample):", anonUsers.length);
    const withTokens = anonUsers.filter((u) => u.pushToken);
    const enabled = anonUsers.filter(
      (u) => u.pushToken && u.notificationsEnabled,
    );
    console.log("  - With push tokens:", withTokens.length);
    console.log("  - With tokens & enabled:", enabled.length);
    if (enabled.length > 0) {
      console.log(
        "  - Sample token:",
        enabled[0].pushToken?.substring(0, 30) + "...",
      );
    }
  }

  console.log("\n=== LATEST NOTIFICATION ===");
  const { data: notifications, error: notifError } = await supabase
    .from("scheduled_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (notifError) {
    console.error("Error fetching notifications:", notifError);
  } else if (notifications.length > 0) {
    const notif = notifications[0];
    console.log("ID:", notif.id);
    console.log("Title:", notif.title);
    console.log("Status:", notif.status);
    console.log("Target Audience:", JSON.stringify(notif.target_audience));
    console.log("Error:", notif.error_message || "None");
    console.log("Sent At:", notif.sent_at);

    console.log("\n=== ANALYTICS FOR THIS NOTIFICATION ===");
    const { data: analytics, error: analyticsError } = await supabase
      .from("notification_analytics")
      .select("*")
      .eq("notification_id", notif.id)
      .order("timestamp", { ascending: false });

    if (analyticsError) {
      console.error("Error fetching analytics:", analyticsError);
    } else {
      console.log("Analytics events found:", analytics.length);
      analytics.forEach((a) => {
        console.log(
          `  - ${a.event_type}: ${a.device_count} devices at ${a.timestamp}`,
        );
      });
    }
  }
}

checkData().catch(console.error);
