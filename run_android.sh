#!/usr/bin/env bash
# Boot a torq emulator (if needed) and start the app in Expo Go.
#
# Usage: ./run_android.sh [avd-name]     (default: torq)
#   PORT=8082 ./run_android.sh torq2     # explicit port / alternate AVD
#
# Safe with multiple emulators running: every adb call targets the chosen
# AVD's serial (ANDROID_SERIAL). Reuses an already-running Metro of THIS
# project instead of starting a duplicate; otherwise picks the first free
# port. Keeps Expo Go on the device in sync with the version the project's
# SDK requires (stale Go shows "Project is incompatible with this version
# of Expo Go" — hit after the gifted-charts upgrade).
set -euo pipefail

export ANDROID_AVD_HOME="$HOME/.config/.android/avd"
SDK="$HOME/Android/Sdk"
ADB="$SDK/platform-tools/adb"
AVD="${1:-torq}"
REPO="$(cd "$(dirname "$0")" && pwd -P)"
APK_CACHE="$HOME/.expo/android-apk-cache"

# ---------------------------------------------------------------- emulator --
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

# Pin every adb call to this emulator.
export ANDROID_SERIAL="$SERIAL"

# ----------------------------------------------------------------- expo go --
# Keep Expo Go in sync with what this project's SDK requires. Version and
# download URL come from Expo's versions API (the same source expo-cli
# uses); offline runs fall back to whatever is installed/cached.
ensure_expo_go() {
  local installed sdk out required url apk
  installed=$("$ADB" shell dumpsys package host.exp.exponent 2>/dev/null \
    | grep -m1 versionName | cut -d= -f2 | tr -d ' \r' || true)
  sdk=$(node -p "require('$REPO/node_modules/expo/package.json').version.split('.')[0] + '.0.0'" 2>/dev/null || true)
  required="" url=""
  if [ -n "$sdk" ]; then
    out=$(node -e "
      fetch('https://api.expo.dev/v2/versions')
        .then((r) => r.json())
        .then((v) => {
          const s = v.sdkVersions['$sdk'] || {};
          console.log((s.androidClientVersion || '') + ' ' + (s.androidClientUrl || ''));
        })
        .catch(() => console.log(''));
    " 2>/dev/null || true)
    required="${out%% *}"
    url="${out#* }"
  fi

  if [ -n "$installed" ] && { [ -z "$required" ] || [ "$installed" = "$required" ]; }; then
    return 0 # up to date (or offline — trust what's there)
  fi

  mkdir -p "$APK_CACHE"
  apk="$APK_CACHE/Expo-Go-${required:-unknown}.apk"
  if [ ! -f "$apk" ] && [ -n "$url" ] && [ "$url" != "$out" ]; then
    echo "Downloading Expo Go ${required}..."
    curl -sL -o "$apk" "$url" || rm -f "$apk"
  fi
  if [ ! -f "$apk" ]; then
    apk=$(ls -t "$APK_CACHE"/*.apk 2>/dev/null | head -1 || true)
  fi
  if [ -n "$apk" ] && [ -f "$apk" ]; then
    echo "Installing Expo Go $(basename "$apk" | sed 's/Expo-Go-//; s/.apk//') (device had: ${installed:-none})..."
    "$ADB" install -r "$apk" >/dev/null
  else
    echo "No Expo Go APK available — expo will handle it."
  fi
}
ensure_expo_go

# ------------------------------------------------------------------- metro --
# A Metro already serving THIS repo (e.g. from a previous run's terminal)?
# Reuse it instead of stacking a duplicate on another port.
metro_port_for_repo() {
  local pid cwd port
  for pid in $(pgrep -f "expo start" 2>/dev/null); do
    cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null) || continue
    [ "$cwd" = "$REPO" ] || continue
    port=$(tr '\0' ' ' <"/proc/$pid/cmdline" | grep -oE -- '--port [0-9]+' | awk '{print $2}' || true)
    port=${port:-8081}
    if curl -s -m 1 "http://localhost:$port/status" >/dev/null 2>&1; then
      echo "$port"
      return 0
    fi
  done
  return 1
}

EXISTING="$(metro_port_for_repo || true)"
if [ -n "${PORT:-}" ]; then
  : # explicit port wins
elif [ -n "$EXISTING" ]; then
  echo "Reusing this project's Metro on port $EXISTING."
  "$ADB" shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:$EXISTING" >/dev/null 2>&1
  echo "Opened Torq on $AVD ($SERIAL)."
  exit 0
else
  # First free port (8081 may belong to another project).
  PORT=8081
  while curl -s -m 1 "http://localhost:$PORT/status" >/dev/null 2>&1; do
    PORT=$((PORT + 1))
  done
fi

# Open the app once Metro is up (10.0.2.2 = host loopback from inside the
# emulator), then hand the terminal to Metro.
(
  until curl -s -m 1 "http://localhost:$PORT/status" >/dev/null 2>&1; do sleep 1; done
  sleep 1
  "$ADB" shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:$PORT" >/dev/null 2>&1
) &

echo "Starting Metro on port $PORT for $AVD ($SERIAL)..."
exec npx expo start --port "$PORT"
