#!/usr/bin/env bash
# Développement : copie des packs (sortie de pipeline/packs.mjs, data/packs) dans files/packs de l'appli
# installée en debug (run-as), sans passer par le téléchargement (Config → Langues téléchargées).
# install-packs.sh <packs_dir> [langs=fr,en,es]
set -euo pipefail
PACKS=$1; LANGS=${2:-fr,en,es}; PKG=fr.langswap; TMP=/data/local/tmp/langswap-packs
files=("$PACKS/base.sqlite")
for l in fr en es de it pt; do
  if [[ ",$LANGS," == *",$l,"* ]]; then files+=("$PACKS/pack-$l.sqlite"); fi
done
adb shell rm -rf $TMP
adb shell mkdir -p $TMP
adb push "${files[@]}" $TMP/
adb shell "run-as $PKG sh -c 'rm -rf files/packs && mkdir -p files/packs && cp $TMP/*.sqlite files/packs/ && ls files/packs'"
adb shell rm -rf $TMP
adb shell am force-stop $PKG
