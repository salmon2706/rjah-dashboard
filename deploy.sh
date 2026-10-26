#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

TOKEN="$(date +%s)"
sed -i '' -E "s/(\\?v=)[0-9]+/\\1${TOKEN}/g" index.html

git add index.html scripts styles static README.md deploy.sh .gitignore
git commit -m "Update the RJAH Gobowen tablet."
git push
echo "Pushed. Live after Pages rebuild: https://salmon2706.github.io/rjah-dashboard/"
