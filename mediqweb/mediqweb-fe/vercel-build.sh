#!/bin/sh
# Vercel build script for MediQ Angular frontend.
# Runs ng build, then injects runtime env vars into dist/mediqapp-fe/index.html.
set -e

npm run build

API_BASE_URL="${API_BASE_URL:-http://localhost:8099}"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

sed -i "s|window.__env.API_BASE_URL = '[^']*'|window.__env.API_BASE_URL = '${API_BASE_URL}'|g" dist/mediqapp-fe/index.html
sed -i "s|window.__env.SUPABASE_URL = '[^']*'|window.__env.SUPABASE_URL = '${SUPABASE_URL}'|g" dist/mediqapp-fe/index.html
sed -i "s|window.__env.SUPABASE_ANON_KEY = '[^']*'|window.__env.SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}'|g" dist/mediqapp-fe/index.html

# Fail if localhost would be deployed
if grep -q 'localhost' dist/mediqapp-fe/index.html; then
    echo "ERROR: localhost detected in index.html - refusing to deploy" >&2
    exit 1
fi
