#!/bin/sh
# Concurrency check for the public-function throttle (t6, hardened by t8).
# LOCAL STACK ONLY: it commits rows into api_rate_hits, so it refuses any
# database that isn't on 127.0.0.1 / localhost.
#
# Lowers request_appointment's limit to 5, then starts 20 signed-out "requests"
# at once from one IP. Each runs api_pre_request() and then holds its
# transaction open for 0.3 s, the way a real function call would. Exactly 5
# may pass. Without t8's per-caller lock, the counts race and more get through.
#
#   sh supabase/tests/t8_rate_limit_concurrency.sh postgresql://postgres:postgres@127.0.0.1:55322/postgres
set -eu
DB="${1:?usage: $0 <local database url>}"
case "$DB" in
  *@127.0.0.1:*|*@localhost:*) ;;
  *) echo "refusing: $DB is not a local database" >&2; exit 2 ;;
esac
LIMIT=5; N=20; KEY_IP=203.0.113.99
psql "$DB" -Xq -v ON_ERROR_STOP=1 <<SQL
delete from public.api_rate_hits where key = 'request_appointment:$KEY_IP';
update public.api_rate_limits set per_hour = $LIMIT where rpc = 'request_appointment';
SQL
OUT=$(mktemp -d)
i=0
while [ $i -lt $N ]; do
  psql "$DB" -XAtq >"$OUT/$i" 2>&1 <<SQL &
begin;
select set_config('request.jwt.claims', '{"role":"anon"}', true),
       set_config('request.method', 'POST', true),
       set_config('request.path', '/rpc/request_appointment', true),
       set_config('request.headers', '{"cf-connecting-ip":"$KEY_IP"}', true) \gset
select public.api_pre_request();
select pg_sleep(0.3);
commit;
SQL
  i=$((i + 1))
done
wait
PASSED=$(grep -L 'Too many requests' "$OUT"/* | wc -l | tr -d ' ')
REFUSED=$(grep -l 'Too many requests' "$OUT"/* | wc -l | tr -d ' ')
STORED=$(psql "$DB" -XAtc "select count(*) from public.api_rate_hits where key = 'request_appointment:$KEY_IP'")
psql "$DB" -Xq -v ON_ERROR_STOP=1 <<SQL
delete from public.api_rate_hits where key = 'request_appointment:$KEY_IP';
update public.api_rate_limits set per_hour = 30 where rpc = 'request_appointment';
SQL
rm -rf "$OUT"
echo "passed=$PASSED refused=$REFUSED stored=$STORED (limit $LIMIT, $N at once)"
if [ "$PASSED" -ne "$LIMIT" ] || [ "$STORED" -ne "$LIMIT" ]; then
  echo "FAIL: the limit did not hold under concurrent calls" >&2; exit 1
fi
echo "T8_CONCURRENCY_PASSED"
