#!/bin/bash
cd "$(dirname "$0")"
DST="/Library/Application Support/Adobe/UXP/Plugins/External/com.mectracker"
INFO="/Library/Application Support/Adobe/UXP/PluginsInfo/v1/PremierePro.json"
sudo mkdir -p "$(dirname "$DST")" "$(dirname "$INFO")" && sudo rm -rf "$DST" "$(dirname "$DST")/com.mectracker.v2" "$(dirname "$DST")/com.mectracker.v2_"* "$(dirname "$DST")/com.mectracker_"* && sudo cp -R com.mectracker "$DST" || exit 1
sudo python3 - "$INFO" <<'PY'
import json, os, shutil, sys
f = sys.argv[1]
if os.path.exists(f): shutil.copy(f, f + '.bak'); j = json.load(open(f))
else: j = {"plugins": []}
j["plugins"] = [p for p in j.get("plugins", []) if p.get("pluginId") not in ("com.mectracker", "com.mectracker.v2")]
j["plugins"].append({"hostMinVersion": "25.6.0", "name": "Mec Tracker", "path": "$extension/Plugins/External/com.mectracker", "pluginId": "com.mectracker", "status": "enabled", "type": "uxp", "versionString": "3.3.5"})
json.dump(j, open(f, "w"), indent=2)
PY
echo "Done. Restart Premiere Pro: Window > UXP Plugins > Mec Tracker"
