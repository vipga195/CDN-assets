#!/usr/bin/env bash
# Upload images, fetch original/webp/avif variants at width W, print byte savings, then delete them.
# Usage: EMAIL=a@x.com PASSWORD=12345678 [W=512] ./scripts/measure.sh photo1.jpg photo2.png ...
set -uo pipefail
U=${BASE_URL:-http://localhost:8090}
W=${W:-512}
: "${EMAIL:?set EMAIL}" "${PASSWORD:?set PASSWORD}"

TOKEN=$(curl -s -X POST "$U/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/')
[ "${#TOKEN}" -eq 64 ] || { echo "login failed"; exit 1; }
A="Authorization: Bearer $TOKEN"

used() { curl -s "$U/me" -H "$A" | sed -E 's/.*"used_bytes":([0-9]+).*/\1/'; }
pct() { awk -v a="$1" -v b="$2" 'BEGIN { printf "%.1f", (1 - a / b) * 100 }'; }

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
before=$(used)
printf '%-24s %9s %9s %9s %9s %8s %8s %6s\n' file source "orig@$W" webp avif webp% avif% small

for f in "$@"; do
  res=$(curl -s -X POST "$U/upload" -H "$A" -F "file=@$f")
  id=$(echo "$res" | sed -nE 's/.*"id":"([^"]+)".*/\1/p')
  if [ -z "$id" ]; then echo "$f: upload failed: $res"; continue; fi

  sz() { curl -s -D "$tmp/h" -o "$tmp/b" "$U/i/$id?w=$W&fmt=$1"; wc -c < "$tmp/b" | tr -d ' '; }
  src=$(wc -c < "$f" | tr -d ' ')
  o=$(sz orig); small=$(grep -i '^x-small-image' "$tmp/h" | tr -d '\r' | awk '{print $2}')
  wp=$(sz webp); av=$(sz avif)

  printf '%-24s %9s %9s %9s %9s %7s%% %7s%% %6s\n' "$(basename "$f" | cut -c1-24)" \
    "$src" "$o" "$wp" "$av" "$(pct "$wp" "$src")" "$(pct "$av" "$src")" "$small"
  curl -s -o /dev/null -X DELETE "$U/images/$id" -H "$A"
done

echo "used_bytes before=$before after=$(used) (must be equal: every upload was deleted)"
