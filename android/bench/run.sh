#!/usr/bin/env bash
# Pousse le monolithe, les packs et la trace sur le téléphone, installe l'appli bench, lance, récupère les résultats.
# run.sh <packs_dir> <trace.json> [--no-push]
set -euo pipefail
cd "$(dirname "$0")"
PACKS=$1; TRACE=$2; PKG=fr.langswap.bench; TMP=/data/local/tmp/langswap
DB=$(cd ../.. && pwd)/data/langswap.sqlite
./gradlew -q installDebug
if [[ ${3:-} != --no-push ]]; then
  adb shell mkdir -p $TMP
  adb push "$DB" "$PACKS"/base.sqlite "$PACKS"/pack-*.sqlite "$PACKS"/bridges-{de,it,pt}.sqlite $TMP/
  adb shell "run-as $PKG sh -c 'rm -rf files/packs && mkdir -p files/packs && cp $TMP/*.sqlite files/packs/'"
  adb shell rm -rf $TMP
fi
adb push "$TRACE" /data/local/tmp/trace.json
adb shell "run-as $PKG sh -c 'cp /data/local/tmp/trace.json files/ && rm -f files/results.txt'"
adb shell am force-stop $PKG
adb shell am start -W -n $PKG/.MainActivity >/dev/null
until adb shell "run-as $PKG cat files/results.txt" 2>/dev/null | grep -q '^END'; do sleep 5; done
adb shell "run-as $PKG cat files/results.txt"
