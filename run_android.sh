#!/usr/bin/env bash
# Boot the torq emulator (if needed) and start the app in Expo Go.
set -euo pipefail

export ANDROID_AVD_HOME="$HOME/.config/.android/avd"
SDK="$HOME/Android/Sdk"
ADB="$SDK/platform-tools/adb"
AVD="torq"

booted() {
  [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]
}

if booted; then
  echo "Emulator already running."
else
  echo "Starting emulator ($AVD)..."
  nohup "$SDK/emulator/emulator" -avd "$AVD" -gpu host \
    >/tmp/torq-emulator.log 2>&1 &
  echo "Waiting for boot..."
  "$ADB" wait-for-device
  until booted; do sleep 1; done
  echo "Booted."
fi

exec npx expo start --android
