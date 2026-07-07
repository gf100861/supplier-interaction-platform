#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
FRONTEND_BUILD="${PROJECT_ROOT}/supplier-platform-frontend/build"

if [[ ! -f "${FRONTEND_BUILD}/index.html" ]]; then
  echo "ERROR: frontend build not found: ${FRONTEND_BUILD}/index.html" >&2
  exit 1
fi

if [[ -z "${FRONTEND_ROOT:-}" ]]; then
  if [[ -d /var/www/supplier-frontend ]]; then
    FRONTEND_ROOT=/var/www/supplier-frontend
  elif [[ -d /var/www/sd-portal ]]; then
    FRONTEND_ROOT=/var/www/sd-portal
  else
    echo "ERROR: cannot detect Nginx frontend root." >&2
    echo "Run again with FRONTEND_ROOT=/your/nginx/root bash apply-notice-hotfix.sh" >&2
    exit 1
  fi
fi

echo "Deploying frontend to ${FRONTEND_ROOT} ..."
mkdir -p "${FRONTEND_ROOT}"
rsync -a --delete "${FRONTEND_BUILD}/" "${FRONTEND_ROOT}/"

if command -v pm2 >/dev/null 2>&1; then
  echo "Restarting backend process sd-backend ..."
  pm2 restart sd-backend
else
  echo "WARNING: pm2 was not found. Restart the backend service manually." >&2
fi

echo "Hotfix applied successfully."
