#!/bin/sh
# Render static-site build script for the MediQ Angular frontend.
#
# 1. Installs npm dependencies.
# 2. Substitutes Render-provided API_BASE_URL and BFF_BASE_URL into
#    src/environments/environment.prod.ts (Angular bakes environment values at build time).
# 3. Runs `ng build` to produce static output in dist/mediqapp-fe.
#
# Usage (set as the static-site buildCommand in render.yaml):
#   ./render-build.sh
set -e

echo ">> Installing npm dependencies"
npm install

echo ">> Substituting API URLs into environment.prod.ts"
if [ -n "$API_BASE_URL" ]; then
  sed -i "s#https://api\.mediq\.app#$API_BASE_URL#g" src/environments/environment.prod.ts
fi

echo ">> Building Angular application"
npm run build

echo ">> Build complete: dist/mediqapp-fe"
