-- Shared state of todo-app (see worker/index.ts).
--
-- `data` holds the whole Todo exactly as the app sends it, so a new field on
-- `Todo` needs no migration. `zone`, `due_at` and `done` are copies of it,
-- kept as real columns so the server can query tasks (e.g. future due-date
-- notifications) without parsing JSON.
CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  zone TEXT NOT NULL,
  due_at INTEGER,
  done INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  -- Tombstone: a deleted task is kept (and never resurrected) rather than removed.
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_todos_open_due ON todos (due_at) WHERE deleted = 0 AND done = 0;

-- Append-only: XP/streak credit of completed tasks that were deleted.
CREATE TABLE archived_completions (
  id TEXT PRIMARY KEY,
  zone TEXT NOT NULL,
  data TEXT NOT NULL
);
