import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log("Starting notification event tracking function");

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { notification_id, event_type, device_id } = await req.json();

    if (!notification_id || !event_type) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: notification_id, event_type",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate event type
    const validEventTypes = ["delivered", "opened", "clicked", "dismissed"];
    if (!validEventTypes.includes(event_type)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid event_type. Must be one of: ${validEventTypes.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if event already exists for this notification and event type
    const { data: existingEvent } = await supabase
      .from("notification_analytics")
      .select("id, device_count")
      .eq("notification_id", notification_id)
      .eq("event_type", event_type)
      .single();

    if (existingEvent) {
      // Increment the device count
      const { error: updateError } = await supabase
        .from("notification_analytics")
        .update({ device_count: existingEvent.device_count + 1 })
        .eq("id", existingEvent.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`Incremented ${event_type} count for notification ${notification_id}`);
    } else {
      // Create new analytics event
      const { error: insertError } = await supabase
        .from("notification_analytics")
        .insert({
          notification_id,
          event_type,
          device_count: 1,
          timestamp: new Date().toISOString(),
          metadata: device_id ? { device_id } : null,
        });

      if (insertError) {
        throw insertError;
      }

      console.log(`Created ${event_type} event for notification ${notification_id}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        notification_id,
        event_type,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
      }
    );
  }
});
