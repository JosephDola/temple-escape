#!/bin/bash
cd "$(dirname "$0")" || exit 1
if [ ! -x node_modules/.bin/vite ]; then
  echo "Preparing Temple Escape for first launch..."
  npm install || { echo; echo "Setup failed. Press any key to close."; read -n 1; exit 1; }
fi
npm run dev -- --host 127.0.0.1 &
PID=$!
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; then
    open http://127.0.0.1:5173/
    break
  fi
  sleep 0.25
done
wait "$PID"
