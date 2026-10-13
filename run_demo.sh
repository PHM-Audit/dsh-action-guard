#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
npm i -D vitest typescript @types/node --silent 2>/dev/null || npm i -D vitest typescript
npx vitest run
