#!/usr/bin/env bash
set -e

CYAN="\033[0;36m"
YELLOW="\033[0;33m"
GREEN="\033[0;32m"
RESET="\033[0m"

BIN=$PWD/bin
SRC=$PWD/src
ENV=${1:-environment.html}
TEMPLATES=$(find "$SRC/templates" -iname '*.html')

echo
echo -e "Making \"bin\" directory"
mkdir -p $BIN

echo
echo -e "Linking assets"

rm -f $BIN/fonts
ln -s $SRC/fonts       $BIN/fonts

rm -f $BIN/img
ln -s $SRC/img         $BIN/img

rm -f $BIN/css
ln -s $SRC/css         $BIN/css

rm -f $BIN/js
ln -s $SRC/js          $BIN/js

rm -f $BIN/favicon.ico
ln -s $SRC/favicon.ico $BIN/favicon.ico

rm -f $BIN/manifest.json
ln -s $SRC/manifest.json $BIN/manifest.json

echo
echo -e "${YELLOW}HTML${RESET}"
echo -e "Combining all HTML and Templates..."

gawk -v root=src -f $PWD/scripts/stamp-qs.awk < $SRC/index.html > tmp.html
cat $SRC/env-$ENV.html $TEMPLATES >> tmp.html
mv tmp.html $BIN/index.html

echo
echo "Done."
