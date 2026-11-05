#!/bin/bash
cd "$(dirname "$0")"
DST="/Library/Application Support/Adobe/UXP/Plugins/External/com.mectracker.v2"
INFO="/Library/Application Support/Adobe/UXP/PluginsInfo/v1/PremierePro.json"
sudo mkdir -p "$(dirname "$DST")" "$(dirname "$INFO")" && sudo rm -rf "$DST" "$(dirname "$DST")/com.mectracker.v2_"* && sudo cp -R com.mectracker.v2 "$DST" || exit 1
sudo python3 - "$INFO" <<'PY'
import json, os, shutil, sys
f = sys.argv[1]
if os.path.exists(f): shutil.copy(f, f + '.bak'); j = json.load(open(f))
else: j = {"plugins": []}
j["plugins"] = [p for p in j.get("plugins", []) if p.get("pluginId") != "com.mectracker.v2"]
j["plugins"].append({"hostMinVersion": "25.6.0", "name": "Mec Tracker", "path": "$extension/Plugins/External/com.mectracker.v2", "pluginId": "com.mectracker.v2", "status": "enabled", "type": "uxp", "versionString": "3.3.3"})
json.dump(j, open(f, "w"), indent=2)
PY
echo "Done. Restart Premiere Pro: Window > UXP Plugins > Mec Tracker"
