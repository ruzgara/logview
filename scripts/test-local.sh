#!/usr/bin/env bash
# Build the local images, run the stack with the test log populator, and clean up on exit.
#
# Usage: scripts/test-local.sh [--no-build] [--quiet]
#   --no-build  reuse the existing logview-*:local images
#   --quiet     don't follow container logs, just wait for Ctrl-C
#
# Requires docker-compose.override.yml (local builds + agent ACCESS_KEY).
# data/ is kept between runs since the agent's access key lives in that database.

set -euo pipefail

cd "$(dirname "$0")/.."

build=1
follow=1
for arg in "$@"; do
	case "$arg" in
		--no-build) build=0 ;;
		--quiet) follow=0 ;;
		-h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) echo "Unknown option: $arg" >&2; exit 1 ;;
	esac
done

if [[ ! -f docker-compose.override.yml ]]; then
	echo "docker-compose.override.yml not found; it provides the local builds and ACCESS_KEY." >&2
	exit 1
fi

compose=(docker compose -f docker-compose.yml -f docker-compose.override.yml)
populator=logview-populator
pids=()

cleanup() {
	trap - EXIT INT TERM
	echo
	echo "==> Cleaning up"
	for pid in ${pids[@]+"${pids[@]}"}; do
		kill "$pid" 2>/dev/null || true
		wait "$pid" 2>/dev/null || true
	done
	docker rm -f "$populator" >/dev/null 2>&1 || true
	"${compose[@]}" down --remove-orphans
	: > test/test.log
}
trap cleanup EXIT
trap 'exit 130' INT TERM

if (( build )); then
	echo "==> Building images"
	old_ids=$(docker image inspect -f '{{.Id}}' logview-app:local logview-agent:local 2>/dev/null || true)
	"${compose[@]}" build
	# Remove the previous builds that the rebuild left untagged
	dangling=$(docker images -q --no-trunc -f dangling=true)
	for id in $old_ids; do
		if grep -qx "$id" <<< "$dangling"; then
			docker image rm "$id" >/dev/null || true
		fi
	done
fi

# Start from an empty log so the agent doesn't replay a previous run
: > test/test.log

echo "==> Starting containers"
"${compose[@]}" up -d

# Runs in a container because Docker Desktop's bind mounts don't reliably show
# the agent appends made from the host
echo "==> Starting test log populator"
docker run -d --rm --name "$populator" -v "$PWD/test:/test" python:3.13-alpine \
	python /test/test_log_populator.py >/dev/null
docker wait "$populator" >/dev/null &
pids+=($!)

echo "==> App running at http://localhost:8090 (admin at /_/). Ctrl-C to stop and clean up."
# Everything runs in the background so bash can handle signals while waiting
if (( follow )); then
	"${compose[@]}" logs -f --tail=20 &
	pids+=($!)
fi
wait "${pids[0]}" || true
echo "==> Test log populator exited unexpectedly"
exit 1
