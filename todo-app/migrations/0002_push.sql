-- Push notifications (see worker/notifications.ts).
--
-- One row per phone that turned notifications on. `person` decides which zones
-- it hears about (its own + commun); `time_zone` is where "today", "8 h" and
-- due times are computed for it.
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  person TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  -- Local YYYY-MM-DD of the last morning summary handled for this phone.
  last_summary_date TEXT,
  created_at INTEGER NOT NULL
);

-- The due_at a reminder was already sent for. Moving a task's due date makes it
-- differ again, so the new date gets its own reminder. The upsert in
-- applyChanges never touches this column, so syncing keeps it.
ALTER TABLE todos ADD COLUMN reminded_due_at INTEGER;
