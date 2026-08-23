#!/bin/zsh

project_dir="${0:A:h}"
cd "$project_dir" || exit 1

echo "Resuming newspaper print-master downloads..."
npm run masters:download -- --only-missing --timeout-ms=600000 --chunk-kb=16 --concurrency=10
download_status=$?

echo
if [ "$download_status" -eq 0 ]; then
  echo "Every cataloged print master is now stored locally."
else
  echo "Some Library of Congress files are still pending. Double-click this file again later to continue them."
fi
echo "Press Return to close this window."
read -r
exit "$download_status"
