/**
 * Migraciones en orden. `PRAGMA user_version` guarda cuántas se han aplicado:
 * nunca se edita una ya publicada, se añade otra al final.
 */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE habits (
    id            TEXT PRIMARY KEY NOT NULL,
    name          TEXT NOT NULL,
    emoji         TEXT,
    color         TEXT NOT NULL,
    freq_type     TEXT NOT NULL CHECK (freq_type IN ('daily', 'weekdays', 'weekly_count')),
    weekdays      INTEGER NOT NULL DEFAULT 127,
    weekly_target INTEGER,
    start_date    TEXT NOT NULL,
    reminder_time TEXT,
    archived      INTEGER NOT NULL DEFAULT 0,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE checkins (
    habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    note       TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (habit_id, date)
  );

  CREATE TABLE days (
    date      TEXT PRIMARY KEY NOT NULL,
    mood      INTEGER CHECK (mood BETWEEN 1 AND 5),
    note      TEXT,
    closed_at TEXT
  );

  CREATE TABLE contexts (
    id         TEXT PRIMARY KEY NOT NULL,
    label      TEXT NOT NULL,
    emoji      TEXT NOT NULL,
    builtin    INTEGER NOT NULL DEFAULT 0,
    archived   INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE day_contexts (
    date       TEXT NOT NULL,
    context_id TEXT NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
    PRIMARY KEY (date, context_id)
  );

  CREATE TABLE habit_misses (
    habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    context_id TEXT NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
    PRIMARY KEY (habit_id, date)
  );

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );

  INSERT INTO contexts (id, label, emoji, builtin, sort_order) VALUES
    ('sleep',  'Dormí mal',    '😴', 1, 0),
    ('stress', 'Estrés',       '😣', 1, 1),
    ('tired',  'Cansancio',    '🪫', 1, 2),
    ('time',   'Sin tiempo',   '⏳', 1, 3),
    ('forgot', 'Se me olvidó', '🫥', 1, 4),
    ('meh',    'Sin ganas',    '😶', 1, 5),
    ('sick',   'Enfermo',      '🤒', 1, 6),
    ('travel', 'Viaje',        '🧳', 1, 7),
    ('social', 'Plan social',  '🎉', 1, 8),
    ('work',   'Trabajo',      '💼', 1, 9);
  `,
];
