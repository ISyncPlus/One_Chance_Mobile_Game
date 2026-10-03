#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)
sdk=${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT to the SDK used by the emulator}
tools="$sdk/build-tools/37.0.0"
platform="$sdk/platforms/android-36/android.jar"
out="$root/artifacts/phase-1b/android-tests"
mkdir -p "$out/classes" "$out/dex"
javac --release 8 -cp "$platform" -d "$out/classes" "$root/scripts/acceptance/android/Acceptance.java"
jar cf "$out/classes.jar" -C "$out/classes" .
"$tools/d8" --lib "$platform" --output "$out/dex" "$out/classes.jar"
"$tools/aapt2" link -o "$out/unsigned.apk" -I "$platform" --manifest "$root/scripts/acceptance/android/AndroidManifest.xml"
(cd "$out/dex" && zip -q "$out/unsigned.apk" classes.dex)
"$tools/zipalign" -f 4 "$out/unsigned.apk" "$out/aligned.apk"
"$tools/apksigner" sign --ks "$root/android/app/debug.keystore" --ks-pass pass:android --out "$out/acceptance.apk" "$out/aligned.apk"
