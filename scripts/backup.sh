#!/usr/bin/env bash
# Backup the PostgreSQL database to backups/footix_<date>.dump (compressed custom format).
# Usage: DATABASE_URL=postgres://user:pass@host:5432/footix ./scripts/backup.sh
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL (an account allowed to read every table)}"
mkdir -p backups
FILE="backups/footix_$(date +%Y%m%d_%H%M%S).dump"
pg_dump --format=custom --no-owner --file="$FILE" "$DATABASE_URL"
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"
