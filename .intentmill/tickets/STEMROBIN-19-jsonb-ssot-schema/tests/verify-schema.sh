#!/usr/bin/env bash
# STEMROBIN-19 — empirical verification of the JSONB content SSOT schema.
# Applies the SSOT DDL to the shared Postgres, proves the AC with psql, and cleans
# up its disposable demo rows. Re-runnable. Run from the ticket worktree root:
#   bash .intentmill/tickets/STEMROBIN-19-jsonb-ssot-schema/tests/verify-schema.sh
#
# AC proven:
#   1. ledger / per-lesson content+exercises / per-locale overlay / answer events are queryable
#   2. answer KEY is in the neutral base and ABSENT from every locale overlay
#   3. sr_users credential row(s) intact
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a
PSQL=(psql "$EASYAPP_DATABASE_URL" -v ON_ERROR_STOP=1 -X -q)
SP='SET search_path TO "stemrobin-schema";'
DEMO='zzz-schema-verify-19'
fail() { echo "FAIL: $*" >&2; exit 1; }
q() { "${PSQL[@]}" -At -c "$SP $1"; }

echo "== 0. sr_users baseline =="
USERS_BEFORE=$(q "SELECT count(*)||'|'||md5(coalesce(string_agg(user_id||email||password_hash, ',' ORDER BY user_id),'')) FROM sr_users;")
echo "  users(before) = $USERS_BEFORE"

echo "== 1. apply DDL (idempotent: twice) =="
"${PSQL[@]}" -f ssot-schemas/db-schemas/stemrobin.sql >/dev/null && echo "  apply #1 OK"
"${PSQL[@]}" -f ssot-schemas/db-schemas/stemrobin.sql >/dev/null && echo "  apply #2 OK (idempotent)"

echo "== 2. structure existence =="
[ "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema='stemrobin-schema' AND table_name='sr_lessons' AND column_name IN ('content','exercises');")" = "2" ] \
  && echo "  sr_lessons.content + .exercises columns present" || fail "sr_lessons JSONB columns missing (ALTER ADD COLUMN did not take)"
for t in sr_content_ledger sr_lesson_i18n sr_content_answer_events; do
  [ "$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema='stemrobin-schema' AND table_name='$t';")" = "1" ] \
    && echo "  table $t present" || fail "table $t missing"
done

echo "== 3. seed disposable demo (namespaced id=$DEMO) =="
"${PSQL[@]}" >/dev/null <<SQL
$SP
INSERT INTO sr_lessons (id, subject, stage, lesson_order, title, concept, content, exercises)
VALUES ('$DEMO','math',99,99,'schema-verify','schema-verify',
  '{"cards":[{"id":"c1","num":1,"anchor":"model","rev":3,
      "body":[{"node":"c1p1"},{"formula":"x+3=7"}],
      "read_check":[{"id":"c1q1","mode":"choice","key":{"correct_index":1},"rev":3}]}]}'::jsonb,
  '{"items":[
      {"id":"e1","ord":1,"type":"辨认","mode":"choice","layer":"指认","key":{"correct_index":2},"rev":3},
      {"id":"e2","ord":2,"type":"操作","mode":"input","layer":"操作","key":{"accept":["7","x=7"]},"rev":3},
      {"id":"e3","ord":3,"type":"说理","mode":"work","layer":"说理","key":{"answer":"reference reasoning"},"rev":3}]}'::jsonb)
ON CONFLICT (id) DO UPDATE SET content=excluded.content, exercises=excluded.exercises;

INSERT INTO sr_content_ledger (subject, stage, ledger, src_rev)
VALUES ('math',99,'{"subject":"math","stage":99,"theme":"verify","model":"m","assumed":[],"lessons":[{"id":"$DEMO","order":99}]}'::jsonb,1)
ON CONFLICT (subject,stage) DO UPDATE SET ledger=excluded.ledger;

-- overlays: prose ONLY, keyed by node_id, with src_rev. zh = source locale. NO KEY.
INSERT INTO sr_lesson_i18n (lesson_id, locale, overlay) VALUES
  ('$DEMO','zh','{"c1p1":{"t":"把两个代数式放在等号两边。","src_rev":3},"c1q1.prompt":{"t":"这句话在说什么？","src_rev":3},"c1q1.opt0":{"t":"选项一","src_rev":3},"e1.prompt":{"t":"下面哪个正确？","src_rev":3}}'::jsonb),
  ('$DEMO','en','{"c1p1":{"t":"Put the two expressions on each side of the equals sign.","src_rev":3},"c1q1.prompt":{"t":"What does this say?","src_rev":3},"c1q1.opt0":{"t":"Option one","src_rev":3},"e1.prompt":{"t":"Which one is correct?","src_rev":3}}'::jsonb)
ON CONFLICT (lesson_id,locale) DO UPDATE SET overlay=excluded.overlay;

INSERT INTO sr_content_answer_events (user_id, lesson_id, kind, node_id, is_correct, chosen, locale) VALUES
  (1,'$DEMO','read_check','c1q1', true, 1, 'zh'),
  (1,'$DEMO','exercise','e2', true, NULL, 'en');
SQL
echo "  demo rows inserted"
# kind CHECK: with a VALID lesson_id, only the CHECK constraint can reject a bad kind
if "${PSQL[@]}" -c "$SP INSERT INTO sr_content_answer_events (user_id,lesson_id,kind,node_id) VALUES (1,'$DEMO','bogus','n');" >/dev/null 2>&1; then
  fail "kind CHECK did not reject invalid value"
else echo "  kind CHECK rejects invalid value 'bogus'"; fi

echo "== 4. AC-1 queryability =="
echo "  per-stage ledger:      $(q "SELECT ledger->>'theme' FROM sr_content_ledger WHERE subject='math' AND stage=99;")"
echo "  card-tree 编号:        $(q "SELECT string_agg((c->>'num'), ',') FROM sr_lessons, jsonb_array_elements(content->'cards') c WHERE id='$DEMO';")"
echo "  exercise deck items:   $(q "SELECT count(*) FROM sr_lessons, jsonb_array_elements(exercises->'items') i WHERE id='$DEMO';")"
echo "  locales with overlay:  $(q "SELECT string_agg(locale, ',' ORDER BY locale) FROM sr_lesson_i18n WHERE lesson_id='$DEMO';")"
echo "  answer events (kinds): $(q "SELECT string_agg(kind||':'||node_id, ',' ORDER BY node_id) FROM sr_content_answer_events WHERE lesson_id='$DEMO';")"

echo "== 5. AC-2 KEY isolation =="
BASE_KEY=$(q "SELECT (content->'cards'->0->'read_check'->0->'key' ? 'correct_index') FROM sr_lessons WHERE id='$DEMO';")
[ "$BASE_KEY" = "t" ] && echo "  KEY present in neutral base (content.read_check.key.correct_index)" || fail "KEY missing from neutral base"
BASE_EX=$(q "SELECT count(*) FROM sr_lessons, jsonb_array_elements(exercises->'items') i WHERE id='$DEMO' AND (i->'key' ? 'correct_index' OR i->'key' ? 'accept' OR i->'key' ? 'answer');")
[ "$BASE_EX" = "3" ] && echo "  KEY present on all 3 exercise items (neutral base)" || fail "exercise KEY not all in neutral base ($BASE_EX/3)"
# every overlay node must have ONLY {t,src_rev}; no correct_index/accept/answer anywhere
LEAK_NODES=$(q "SELECT count(*) FROM sr_lesson_i18n, jsonb_each(overlay) e WHERE lesson_id='$DEMO' AND (e.value ? 'correct_index' OR e.value ? 'accept' OR e.value ? 'answer');")
LEAK_TEXT=$(q "SELECT count(*) FROM sr_lesson_i18n WHERE lesson_id='$DEMO' AND (overlay::text LIKE '%correct_index%' OR overlay::text LIKE '%\"accept\"%' OR overlay::text LIKE '%\"answer\"%');")
{ [ "$LEAK_NODES" = "0" ] && [ "$LEAK_TEXT" = "0" ]; } \
  && echo "  NO KEY in any locale overlay (structural=$LEAK_NODES, textual=$LEAK_TEXT)" || fail "KEY leaked into overlay (structural=$LEAK_NODES textual=$LEAK_TEXT)"

echo "== 6. cleanup disposable demo =="
"${PSQL[@]}" >/dev/null <<SQL
$SP
DELETE FROM sr_content_answer_events WHERE lesson_id='$DEMO';
DELETE FROM sr_lesson_i18n WHERE lesson_id='$DEMO';
DELETE FROM sr_content_ledger WHERE subject='math' AND stage=99;
DELETE FROM sr_lessons WHERE id='$DEMO';
SQL
echo "  demo rows removed (cascade-clean)"

echo "== 7. AC-3 sr_users integrity =="
USERS_AFTER=$(q "SELECT count(*)||'|'||md5(coalesce(string_agg(user_id||email||password_hash, ',' ORDER BY user_id),'')) FROM sr_users;")
echo "  users(after)  = $USERS_AFTER"
[ "$USERS_BEFORE" = "$USERS_AFTER" ] && echo "  sr_users UNCHANGED" || fail "sr_users changed! before=$USERS_BEFORE after=$USERS_AFTER"

echo "ALL CHECKS PASSED"
