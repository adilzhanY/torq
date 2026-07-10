#!/usr/bin/env bash
# Boot a torq emulator (if needed) and start the app in Expo Go.
#
# Usage: ./run_android.sh [avd-name]     (default: torq)
#   PORT=8082 ./run_android.sh torq2     # explicit port / alternate AVD
#
# Safe with multiple emulators running: every adb call targets the chosen
# AVD's serial (ANDROID_SERIAL), so other emulators are never touched. If
# the default Metro port is busy (another project), the next free port is
# used automatically. Expo Go is installed from the local cache when the
# AVD doesn't have it yet (fresh AVDs).
set -euo pipefail

export ANDROID_AVD_HOME="$HOME/.config/.android/avd"
SDK="$HOME/Android/Sdk"
ADB="$SDK/platform-tools/adb"
AVD="${1:-torq}"

# Serial of the running emulator for $AVD, if any (each emulator knows its
# AVD name; `adb devices` alone can't tell them apart).
serial_for_avd() {
  local s name
  for s in $("$ADB" devices | awk '/^emulator-/{print $1}'); do
    name=$("$ADB" -s "$s" emu avd name 2>/dev/null | head -1 | tr -d '\r')
    if [ "$name" = "$AVD" ]; then
      echo "$s"
      return 0
    fi
  done
  return 1
}

SERIAL="$(serial_for_avd || true)"
if [ -n "$SERIAL" ]; then
  echo "Emulator for $AVD already running ($SERIAL)."
else
  echo "Starting emulator ($AVD)..."
  nohup "$SDK/emulator/emulator" -avd "$AVD" -gpu host \
    >"/tmp/torq-emulator-$AVD.log" 2>&1 &
  echo "Waiting for boot..."
  until SERIAL="$(serial_for_avd || true)" && [ -n "$SERIAL" ]; do sleep 1; done
  until [ "$("$ADB" -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    sleep 1
  done
  echo "Booted ($SERIAL)."
fi

# Pin every adb (and expo's device pick) to this emulator.
export ANDROID_SERIAL="$SERIAL"

# Fresh AVDs have no Expo Go — install it from expo-cli's apk cache.
if ! "$ADB" shell pm list packages 2>/dev/null | grep -q host.exp.exponent; then
  APK=$(ls -t "$HOME/.expo/android-apk-cache"/*.apk 2>/dev/null | head -1 || true)
  if [ -n "$APK" ]; then
    echo "Installing Expo Go ($(basename "$APK"))..."
    "$ADB" install -r "$APK" >/dev/null
  else
    echo "Expo Go not installed and no cached APK — expo will fetch it."
  fi
fi

# Default Metro port, skipping ports already serving something else.
if [ -z "${PORT:-}" ]; then
  PORT=8081
  while curl -s -m 1 "http://localhost:$PORT/status" >/dev/null 2>&1; do
    PORT=$((PORT + 1))
  done
fi

# Open the app on the target emulator once Metro is up (10.0.2.2 = host
# loopback from inside the emulator), then hand the terminal to Metro.
(
  until curl -s -m 1 "http://localhost:$PORT/status" >/dev/null 2>&1; do sleep 1; done
  sleep 1
  "$ADB" shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:$PORT" >/dev/null 2>&1
) &

echo "Starting Metro on port $PORT for $AVD ($SERIAL)..."
exec npx expo start --port "$PORT"
