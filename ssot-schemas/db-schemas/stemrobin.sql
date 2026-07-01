-- StemRobin database schema — SSOT for the `stemrobin` Postgres schema.
-- This project shares HouseRobin's Supabase database but works ONLY inside this
-- schema; it never touches the `public` (r_*) tables. The database follows this
-- file via migrations.
--
-- After applying, expose the schema to the REST API:
--   Supabase → Project Settings → API → "Exposed schemas" → add `stemrobin`.

CREATE SCHEMA IF NOT EXISTS stemrobin;

-- ---------------------------------------------------------------------------
-- sr_lessons — one row per generated lesson (structured-JSON course unit).
-- Mirrors docs/course-gen-guide-*.md: standard middle-school concept, slowed
-- entry ramp, typed exercise set. The four body sections and the exercises live
-- in jsonb so the generation contract and the renderer share one shape.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stemrobin.sr_lessons (
  id             TEXT PRIMARY KEY,            -- e.g. 'math-s1-01'
  subject        TEXT NOT NULL CHECK (subject IN ('math', 'physics')),
  stage          INT  NOT NULL,              -- 阶段 (1..6)
  lesson_order   INT  NOT NULL,              -- order within the stage
  title          TEXT NOT NULL,
  concept        TEXT NOT NULL,              -- the single core concept of the lesson

  -- Content: a lesson keeps exactly three content columns.
  html           TEXT,                                -- 课程 html：full self-contained lesson HTML (KaTeX + inline SVG + DESIGN tokens); the frontend loads it from public/lessons/<id>.html
  knowledge      JSONB NOT NULL DEFAULT '{}'::jsonb,  -- 课程知识 json：structured knowledge extracted from the html (extraction is future work)
  exercises      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- 练习：practice items; answers hidden by default, unlocked by user state

  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),

  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),

  UNIQUE (subject, stage, lesson_order)
);

CREATE INDEX IF NOT EXISTS sr_lessons_subject_idx
  ON stemrobin.sr_lessons (subject, stage, lesson_order);

-- ---------------------------------------------------------------------------
-- sr_progress — per-learner mastery record. No Clerk/auth yet, so the learner
-- is a plain text id chosen by the app (single-child use this stage).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stemrobin.sr_progress (
  learner_id   TEXT NOT NULL,
  lesson_id    TEXT NOT NULL REFERENCES stemrobin.sr_lessons (id) ON DELETE CASCADE,
  mastered     BOOLEAN NOT NULL DEFAULT false,
  attempts     INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (learner_id, lesson_id)
);

-- Lesson content is public (read-only) for the unauthenticated app; expose
-- published rows to the anon role. Tighten when an auth layer is added.
ALTER TABLE stemrobin.sr_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published lessons" ON stemrobin.sr_lessons;
CREATE POLICY "Anyone can read published lessons"
ON stemrobin.sr_lessons FOR SELECT
TO anon, authenticated
USING (status = 'published');
