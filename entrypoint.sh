#!/bin/sh
set -e

if [ "$(id -u)" = "0" ]; then
    chown -R appuser:appuser /app/data
    exec su -s /bin/sh appuser -c "$*"
fi

# Already running as appuser (e.g. local dev without root)
exec "$@"
