#!/bin/sh
set -e

# Fix ownership of /app/data so appuser can write after docker cp / volume mounts.
# Runs as root, then drops to appuser via exec gosu/su-exec.
if [ "$(id -u)" = "0" ]; then
    chown -R appuser:appuser /app/data
    exec su -s /bin/sh appuser -c "python run.py"
fi

# Already running as appuser (e.g. local dev without root)
exec python run.py
