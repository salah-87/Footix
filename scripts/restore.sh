#!/usr/bin/env bash
# Restore a backup into a database. WARNING: existing objects are replaced.
# Usage: DATABASE_URL=postgres://owner:pass@host:5432/footix ./scripts/restore.sh backups/footix_xxx.dump
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL (the owner account)}"
FILE="${1:?Usage: restore.sh <backup file>}"
[ -f "$FILE" ] || { echo "File not found: $FILE"; exit 1; }
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$FILE"
echo "Restore finished from $FILE"
