#!/bin/zsh

project_dir="${0:A:h}"
inventory="$project_dir/local-archive/inventory/print-masters.csv"

if [ -f "$inventory" ]; then
  open "$inventory"
else
  echo "The local inventory has not been created yet. Run Resume Newspaper Downloads first."
  echo "Press Return to close this window."
  read -r
fi
