-- Schéma initial.
--
-- Conventions de dates :
--   next_due_on  TEXT 'YYYY-MM-DD', dans le fuseau du foyer (Europe/Paris),
--                calculé côté Worker et jamais par SQLite (qui ne connaît que l'UTC).
--   done_at      TEXT ISO 8601 en UTC ('YYYY-MM-DDTHH:MM:SSZ'), converti à l'affichage.
--   created_at   idem.

CREATE TABLE people (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  color TEXT NOT NULL          -- hex, lisible sur le thème clair comme sur le thème nuit
);

CREATE TABLE household (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),   -- foyer unique : pas de multi-foyers
  display_token         TEXT NOT NULL UNIQUE,
  weekly_review_weekday INTEGER NOT NULL                       -- 0 = dimanche … 6 = samedi (convention strftime('%w'))
    CHECK (weekly_review_weekday BETWEEN 0 AND 6)
);

CREATE TABLE domains (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  owner_id         INTEGER NOT NULL REFERENCES people(id),
  minimum_standard TEXT NOT NULL,     -- une phrase, décidée à deux, qui définit « fait »
  active           INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE tasks (
  id                INTEGER PRIMARY KEY,
  domain_id         INTEGER NOT NULL REFERENCES domains(id),
  title             TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('recurring', 'oneoff')),
  trigger_cue       TEXT,
  interval_days     INTEGER,
  next_due_on       TEXT NOT NULL,
  estimated_minutes INTEGER,
  effort            TEXT NOT NULL CHECK (effort IN ('low', 'high')),
  active            INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at        TEXT NOT NULL,

  -- Une récurrence sans déclencheur contextuel est une alarme : la base la refuse.
  CHECK (kind <> 'recurring' OR (
    trigger_cue IS NOT NULL AND trim(trigger_cue) <> ''
    AND interval_days IS NOT NULL AND interval_days > 0
  )),
  CHECK (kind <> 'oneoff' OR interval_days IS NULL)
);

CREATE TABLE completions (
  id        INTEGER PRIMARY KEY,
  task_id   INTEGER NOT NULL REFERENCES tasks(id),
  person_id INTEGER NOT NULL REFERENCES people(id),
  done_at   TEXT NOT NULL,
  skipped   INTEGER NOT NULL DEFAULT 0 CHECK (skipped IN (0, 1))
);

-- Le mur interroge /api/today toutes les 60 s : cet index est ce qui garde
-- la lecture à quelques dizaines de lignes lues, très loin du quota D1.
CREATE INDEX idx_tasks_due       ON tasks (active, next_due_on);
CREATE INDEX idx_tasks_domain    ON tasks (domain_id);
CREATE INDEX idx_completions_at  ON completions (done_at);
CREATE INDEX idx_completions_task ON completions (task_id, done_at);
