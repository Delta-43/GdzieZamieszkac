#!/usr/bin/env bash
# Runs the data API (port 8000) and the city service (port 8100) and starts either one again if it stops.
#
#   server/scripts/run_servers.sh start      run in the background (survives closing the terminal; not a reboot or WSL shutting down)
#   server/scripts/run_servers.sh stop       stop both
#   server/scripts/run_servers.sh restart    stop both (and anything else listening on 8000 or 8100), then start; use it after a code or data change
#   server/scripts/run_servers.sh status     health of both, and whether this script is running
#   server/scripts/run_servers.sh run        run in the foreground (Ctrl-C stops both); for tmux or a service manager
#
# Settings are read from server/config/.env by the apps themselves (database URL, OPENROUTER_LLM_KEY, ...). Extra browser origins that may call
# the servers, which are private addresses and so are never written in the repository, go in that file or in the environment:
#   CORS_ORIGINS=http://localhost:5173,http://<frontend-machine>:5173
#   CITY_SERVICE_CORS_ORIGINS=http://localhost:5173,http://<frontend-machine>:5173
# Both servers listen on 127.0.0.1 only. Tailscale serve (not this script) makes them reachable on the tailnet.
# Logs: server/run/api.log and server/run/city.log (one JSON line per request, no addresses, no bodies). Safe to delete.
set -u
cd "$(dirname "$0")/../.." || exit 1
RUN=server/run
PIDFILE=$RUN/supervisor.pid
API_PORT="${API_PORT:-8000}"
CITY_PORT="${CITY_PORT:-8100}"
mkdir -p "$RUN"

# Pick the origins from the environment, or from server/config/.env when it is not set there (an exported value wins).
env_value() { [ -n "${!1:-}" ] && { echo "${!1}"; return; }; grep -E "^$1=" server/config/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' ; }

supervise() {  # name, directory, command...
  local name=$1 dir=$2; shift 2
  while true; do
    (cd "$dir" && "$@") >>"$RUN/$name.log" 2>&1
    echo "$(date -Is) $name stopped, starting again in 3 s" >>"$RUN/$name.log"
    sleep 3
  done
}

run() {
  trap 'kill 0' INT TERM EXIT   # everything started below shares this process group
  local cors city_cors
  cors=$(env_value CORS_ORIGINS); city_cors=$(env_value CITY_SERVICE_CORS_ORIGINS)
  [ -n "$cors" ] && export CORS_ORIGINS="$cors"
  [ -n "$city_cors" ] && export CITY_SERVICE_CORS_ORIGINS="$city_cors"
  supervise api backend .venv/bin/uvicorn app.main:app_from_env --factory --host 127.0.0.1 --port "$API_PORT" --no-access-log &
  supervise city city-service ../backend/.venv/bin/uvicorn app.main:app_from_env --factory --host 127.0.0.1 --port "$CITY_PORT" --no-access-log &
  wait
}

alive() { [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

free_ports() {  # stop whatever still listens on the two ports (for example servers started by hand)
  for port in "$API_PORT" "$CITY_PORT"; do
    pids=$(ss -ltnp 2>/dev/null | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)
    [ -n "$pids" ] && kill $pids 2>/dev/null
  done
}

stop() {
  if alive; then kill -- "-$(cat "$PIDFILE")" 2>/dev/null; sleep 1; fi
  rm -f "$PIDFILE"
}

health() { printf '  %-13s' "$1"; curl -s -m 5 "http://127.0.0.1:$2/v1/health" || printf 'not answering'; echo; }

case "${1:-status}" in
  run) run ;;
  start)
    if alive; then echo "already running (process group $(cat "$PIDFILE"))"; exit 0; fi
    setsid nohup "$0" run >>"$RUN/supervisor.log" 2>&1 &
    echo $! >"$PIDFILE"
    # A cold start loads the data from the database and takes up to a minute: wait until both answer.
    echo -n "starting"
    for _ in $(seq 1 30); do
      curl -sf -m 3 "http://127.0.0.1:$API_PORT/v1/health" >/dev/null && curl -sf -m 3 "http://127.0.0.1:$CITY_PORT/v1/health" >/dev/null && break
      echo -n "."; sleep 2
    done
    echo; "$0" status ;;
  stop) stop; echo "stopped" ;;
  restart) stop; free_ports; sleep 2; "$0" start ;;
  status)
    if alive; then echo "supervisor: running (process group $(cat "$PIDFILE"))"; else echo "supervisor: not running (servers started some other way may still answer)"; fi
    health "data API" "$API_PORT"; health "city service" "$CITY_PORT" ;;
  *) echo "usage: $0 start|stop|restart|status|run"; exit 2 ;;
esac
