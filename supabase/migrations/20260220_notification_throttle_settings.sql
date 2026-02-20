-- Create notification_throttle_settings table (single-row config)
CREATE TABLE IF NOT EXISTS notification_throttle_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  max_notifications_per_day integer NOT NULL DEFAULT 3,
  cooldown_hours_between_campaigns integer NOT NULL DEFAULT 24,
  priority_override_threshold integer NOT NULL DEFAULT 8,
  respect_user_preferences boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO notification_throttle_settings DEFAULT VALUES;

-- RLS
ALTER TABLE notification_throttle_settings ENABLE ROW LEVEL SECURITY;

-- Admins can read
CREATE POLICY "Admins can read throttle settings"
  ON notification_throttle_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "AppUser"
      WHERE "authUserID" = auth.uid()::text
        AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can update
CREATE POLICY "Admins can update throttle settings"
  ON notification_throttle_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "AppUser"
      WHERE "authUserID" = auth.uid()::text
        AND role IN ('admin', 'super_admin')
    )
  );

-- Service role bypasses RLS automatically

-- RPC: find_video_abandoners
-- Returns users who started a video but didn't finish it
CREATE OR REPLACE FUNCTION find_video_abandoners(
  watch_threshold integer,
  hours_since integer,
  video_id uuid DEFAULT NULL,
  series_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  "authUserID" text,
  "firstName" text,
  "lastName" text,
  "pushToken" text,
  "notificationsEnabled" boolean
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  cutoff_time timestamptz := now() - (hours_since || ' hours')::interval;
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    u.id,
    u."authUserID",
    u."firstName",
    u."lastName",
    u."pushToken",
    u."notificationsEnabled"
  FROM video_views vv
  JOIN "AppUser" u ON u."authUserID" = vv.user_id
  JOIN videos v ON v.id = vv.video_id
  WHERE
    u."notificationsEnabled" = true
    AND u."pushToken" IS NOT NULL
    -- Watched between 10% and threshold%
    AND vv.watch_percentage >= 10
    AND vv.watch_percentage <= watch_threshold
    -- Not completed
    AND (vv.completed IS NULL OR vv.completed = false)
    -- Last activity older than hours_since
    AND vv.updated_at < cutoff_time
    -- Optional video filter
    AND (find_video_abandoners.video_id IS NULL OR vv.video_id = find_video_abandoners.video_id)
    -- Optional series filter
    AND (find_video_abandoners.series_id IS NULL OR v.series_id = find_video_abandoners.series_id);
END;
$$;

-- RPC: find_broken_streaks
-- Returns users whose practice streak broke recently
CREATE OR REPLACE FUNCTION find_broken_streaks(
  min_streak integer,
  days_since_break integer
)
RETURNS TABLE (
  id uuid,
  "authUserID" text,
  "firstName" text,
  "lastName" text,
  "pushToken" text,
  "notificationsEnabled" boolean
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  break_start date := (now() - ((days_since_break + 3) || ' days')::interval)::date;
  break_end date := (now() - (days_since_break || ' days')::interval)::date;
BEGIN
  RETURN QUERY
  WITH streak_data AS (
    SELECT
      pl.user_id,
      pl.practice_date,
      pl.practice_date - (ROW_NUMBER() OVER (PARTITION BY pl.user_id ORDER BY pl.practice_date))::integer AS streak_group
    FROM practice_logs pl
  ),
  streak_lengths AS (
    SELECT
      user_id,
      streak_group,
      COUNT(*) AS streak_length,
      MAX(practice_date) AS last_day
    FROM streak_data
    GROUP BY user_id, streak_group
  ),
  user_best AS (
    SELECT
      user_id,
      MAX(streak_length) AS best_streak,
      MAX(last_day) AS last_practice
    FROM streak_lengths
    GROUP BY user_id
  )
  SELECT DISTINCT
    u.id,
    u."authUserID",
    u."firstName",
    u."lastName",
    u."pushToken",
    u."notificationsEnabled"
  FROM user_best ub
  JOIN "AppUser" u ON u."authUserID" = ub.user_id
  WHERE
    u."notificationsEnabled" = true
    AND u."pushToken" IS NOT NULL
    AND ub.best_streak >= min_streak
    AND ub.last_practice BETWEEN break_start AND break_end;
END;
$$;

-- RPC: find_recent_milestones
-- Returns users who recently crossed a milestone threshold
CREATE OR REPLACE FUNCTION find_recent_milestones(
  milestone_type text,
  threshold_value integer,
  window_start timestamptz
)
RETURNS TABLE (
  id uuid,
  "authUserID" text,
  "firstName" text,
  "lastName" text,
  "pushToken" text,
  "notificationsEnabled" boolean
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF milestone_type = 'video_completed' THEN
    RETURN QUERY
    SELECT DISTINCT
      u.id,
      u."authUserID",
      u."firstName",
      u."lastName",
      u."pushToken",
      u."notificationsEnabled"
    FROM "AppUser" u
    WHERE
      u."notificationsEnabled" = true
      AND u."pushToken" IS NOT NULL
      AND (
        SELECT COUNT(*)
        FROM video_views vv
        WHERE vv.user_id = u."authUserID"
          AND vv.completed = true
      ) >= threshold_value
      AND EXISTS (
        SELECT 1
        FROM video_views vv
        WHERE vv.user_id = u."authUserID"
          AND vv.completed = true
          AND vv.updated_at >= window_start
      );

  ELSIF milestone_type = 'practice_hours' THEN
    RETURN QUERY
    SELECT DISTINCT
      u.id,
      u."authUserID",
      u."firstName",
      u."lastName",
      u."pushToken",
      u."notificationsEnabled"
    FROM "AppUser" u
    WHERE
      u."notificationsEnabled" = true
      AND u."pushToken" IS NOT NULL
      AND (
        SELECT COALESCE(SUM(pl.duration_minutes) / 60.0, 0)
        FROM practice_logs pl
        WHERE pl.user_id = u."authUserID"
      ) >= threshold_value
      AND EXISTS (
        SELECT 1
        FROM practice_logs pl
        WHERE pl.user_id = u."authUserID"
          AND pl.created_at >= window_start
      );
  END IF;
END;
$$;
