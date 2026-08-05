-- LemmaDeck database schema — SSOT for the project's Postgres tables.
--
-- Generated from the live schema "lemmadeck-schema" (shared Supabase project, reached through
-- LEMMADECK_DATABASE_URL) on 2026-08-06 by STEMROBIN-124. It replaces the former
-- stemrobin.sql, which described the retired Azure easy-app schema "stemrobin-schema"
-- and had drifted seven tables and several columns away from what actually runs.
--
-- This file DESCRIBES the live schema; it is not a migration. Do not apply it to the
-- shared database. A change here without a matching, deliberate change to the live
-- schema is drift, and the reverse is drift too.

create schema if not exists "lemmadeck-schema";
set search_path to "lemmadeck-schema";

create table if not exists ld_user_emails (
  id bigint not null,
  email text not null,
  created_at timestamp with time zone default now() not null,
  primary key (id)
);

create table if not exists sr_answer_events (
  id bigint not null,
  user_id bigint not null,
  question_id bigint not null,
  is_correct boolean,
  chosen integer,
  answer_blob_id text,
  answered_at timestamp with time zone default now() not null,
  answer_text text,
  attempt_id bigint,
  primary key (id)
);

create table if not exists sr_content_answer_events (
  id bigint not null,
  user_id bigint not null,
  lesson_id text not null,
  kind text not null,
  node_id text not null,
  is_correct boolean,
  chosen integer,
  answer_text text,
  locale text,
  created_at timestamp with time zone default now() not null,
  primary key (id)
);

create table if not exists sr_content_ledger (
  subject text not null,
  stage integer not null,
  ledger jsonb not null,
  src_rev bigint default 1 not null,
  updated_at timestamp with time zone default now() not null,
  primary key (subject, stage)
);

create table if not exists sr_lesson_audio (
  lesson_id text not null,
  node_id text not null,
  mime text default 'audio/mpeg'::text not null,
  bytes bytea not null,
  voice text,
  updated_at timestamp with time zone default now() not null,
  primary key (lesson_id, node_id)
);

create table if not exists sr_lesson_i18n (
  lesson_id text not null,
  locale text not null,
  overlay jsonb not null,
  updated_at timestamp with time zone default now() not null,
  primary key (lesson_id, locale)
);

create table if not exists sr_lessons (
  id text not null,
  subject text not null,
  stage integer not null,
  lesson_order integer not null,
  title text not null,
  concept text not null,
  html text,
  pdf bytea,
  status text default 'draft'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  content jsonb,
  exercises jsonb,
  primary key (id)
);

create table if not exists sr_practice_attempts (
  id bigint not null,
  user_id bigint not null,
  lesson_id text not null,
  score numeric not null,
  submitted_at timestamp with time zone default now() not null,
  primary key (id)
);

create table if not exists sr_questions (
  id bigint not null,
  lesson_id text not null,
  ord integer not null,
  type text not null,
  prompt text not null,
  answer_mode text not null,
  options jsonb,
  correct_index integer,
  answer text not null,
  accept jsonb,
  layer text,
  review_of text,
  figure text,
  primary key (id)
);

create table if not exists sr_quiz_attempts (
  id bigint not null,
  user_id bigint not null,
  lesson_id text not null,
  started_at timestamp with time zone default now() not null,
  ended_at timestamp with time zone,
  primary key (id)
);

create table if not exists sr_recite_attempts (
  id bigint not null,
  user_id bigint not null,
  lesson_id text not null,
  level integer not null,
  node_id text,
  is_correct boolean not null,
  assisted boolean default false not null,
  created_at timestamp with time zone default now() not null,
  primary key (id)
);

create table if not exists sr_stories (
  id text not null,
  title text not null,
  person text not null,
  era text,
  source_url text not null,
  status text default 'draft'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  primary key (id)
);

create table if not exists sr_story_answer_events (
  id bigint not null,
  user_id bigint not null,
  question_id bigint not null,
  is_correct boolean,
  chosen integer,
  answer_blob_id text,
  answered_at timestamp with time zone default now() not null,
  primary key (id)
);

create table if not exists sr_story_chapters (
  id text not null,
  story_id text not null,
  ord integer not null,
  title text not null,
  md text,
  status text default 'draft'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  stage text,
  stage_ord integer,
  section_start integer,
  section_end integer,
  pdf bytea,
  primary key (id)
);

create table if not exists sr_story_questions (
  id bigint not null,
  chapter_id text not null,
  ord integer not null,
  type text not null,
  prompt text not null,
  answer_mode text not null,
  options jsonb,
  correct_index integer,
  answer text not null,
  primary key (id)
);

create table if not exists sr_textbook_mistakes (
  id bigint not null,
  user_id bigint not null,
  book_id text not null,
  lesson_id text not null,
  exercise_number text not null,
  occurred_at timestamp with time zone default now() not null,
  primary key (id)
);

create table if not exists sr_users (
  user_id bigint not null,
  email text not null,
  password_hash text not null,
  created_at timestamp with time zone default now() not null,
  primary key (user_id)
);

create table if not exists sr_word_audio (
  word text not null,
  mime text default 'audio/mpeg'::text not null,
  bytes bytea not null,
  voice text,
  updated_at timestamp with time zone default now() not null,
  primary key (word)
);

-- indexes
CREATE UNIQUE INDEX ld_user_emails_email_key on "lemmadeck-schema".ld_user_emails USING btree (email);
CREATE INDEX sr_answer_events_attempt_idx on "lemmadeck-schema".sr_answer_events USING btree (attempt_id);
CREATE INDEX sr_answer_events_user_idx on "lemmadeck-schema".sr_answer_events USING btree (user_id, question_id);
CREATE INDEX sr_content_answer_events_user_lesson_idx on "lemmadeck-schema".sr_content_answer_events USING btree (user_id, lesson_id);
CREATE UNIQUE INDEX sr_lessons_subject_stage_lesson_order_key on "lemmadeck-schema".sr_lessons USING btree (subject, stage, lesson_order);
CREATE INDEX sr_practice_attempts_user_lesson_idx on "lemmadeck-schema".sr_practice_attempts USING btree (user_id, lesson_id, submitted_at);
CREATE UNIQUE INDEX sr_questions_lesson_id_ord_key on "lemmadeck-schema".sr_questions USING btree (lesson_id, ord);
CREATE INDEX sr_questions_lesson_idx on "lemmadeck-schema".sr_questions USING btree (lesson_id, ord);
CREATE INDEX sr_quiz_attempts_user_lesson_idx on "lemmadeck-schema".sr_quiz_attempts USING btree (user_id, lesson_id, ended_at);
CREATE INDEX sr_recite_attempts_user_lesson_idx on "lemmadeck-schema".sr_recite_attempts USING btree (user_id, lesson_id, created_at);
CREATE INDEX sr_story_answer_events_user_idx on "lemmadeck-schema".sr_story_answer_events USING btree (user_id, question_id);
CREATE UNIQUE INDEX sr_story_chapters_story_id_ord_key on "lemmadeck-schema".sr_story_chapters USING btree (story_id, ord);
CREATE INDEX sr_story_chapters_story_idx on "lemmadeck-schema".sr_story_chapters USING btree (story_id, ord);
CREATE UNIQUE INDEX sr_story_questions_chapter_id_ord_key on "lemmadeck-schema".sr_story_questions USING btree (chapter_id, ord);
CREATE INDEX sr_story_questions_chapter_idx on "lemmadeck-schema".sr_story_questions USING btree (chapter_id, ord);
CREATE INDEX sr_textbook_mistakes_user_time_idx on "lemmadeck-schema".sr_textbook_mistakes USING btree (user_id, occurred_at DESC, id DESC);
CREATE UNIQUE INDEX sr_users_email_key on "lemmadeck-schema".sr_users USING btree (email);
