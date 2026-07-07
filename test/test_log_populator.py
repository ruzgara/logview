#!/usr/bin/env python3

"""Append lines from test_log_source.log to test.log slowly to simulate traffic logs."""

from __future__ import annotations

import os
import random
import signal
import time
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
SOURCE_LOG = BASE_DIR / "test_log_source.log"
TARGET_LOG = BASE_DIR / "test.log"


def load_source_lines() -> list[str]:
	SOURCE_LOG.parent.mkdir(parents=True, exist_ok=True)
	SOURCE_LOG.touch(exist_ok=True)
	if not SOURCE_LOG.exists():
		raise FileNotFoundError(f"Source log not found: {SOURCE_LOG}")

	lines = SOURCE_LOG.read_text(encoding="utf-8").splitlines()
	if not lines:
		raise ValueError(f"Source log is empty: {SOURCE_LOG}")
	return lines


def main() -> int:
	lines = load_source_lines()
	stopped = False

	def handle_stop(signum, frame):
		nonlocal stopped
		stopped = True

	signal.signal(signal.SIGINT, handle_stop)
	signal.signal(signal.SIGTERM, handle_stop)

	TARGET_LOG.parent.mkdir(parents=True, exist_ok=True)
	TARGET_LOG.touch(exist_ok=True)

	with TARGET_LOG.open("a", encoding="utf-8") as target:
		while not stopped:
			target.write(random.choice(lines) + "\n")
			target.flush()
			os.fsync(target.fileno())
			time.sleep(random.uniform(0.1, 0.3))

	return 0


if __name__ == "__main__":
	raise SystemExit(main())
