import json
import os
import requests
from dataclasses import asdict
from file_ingest import ingest_log_file

import debugpy

def _resolve_log_path() -> str:
    #_load_env_files()
    log_file = os.getenv("LOG_FILE")
    log_dir = os.getenv("LOG_DIR", "/log")
    if not log_file:
        raise RuntimeError("LOG_FILE environment variable is required.")
    if os.path.basename(log_file) != log_file:
        raise ValueError("LOG_FILE must be a filename without any path segments.")
    return os.path.join(log_dir, log_file)


def main() -> None:
    debugpy.listen(("0.0.0.0", 5678))
    print("⏳ Debugger enabled. Waiting for client attachment on port 5678...", flush=True)
    debugpy.wait_for_client()  # Blocks execution until the IDE connects
    print("🚀 Debugger attached! Resuming execution.", flush=True)

    log_path = _resolve_log_path()
    pb_url = os.getenv("PB_URL", "http://localhost:8090")
    access_key = os.getenv("ACCESS_KEY")
    if not pb_url:
        raise RuntimeError("PB_URL environment variable is required.")
    if not access_key:
        raise RuntimeError("ACCESS_KEY environment variable is required.")
    endpoint = f"{pb_url.rstrip('/')}/api/collections/connections/records"
    for batch in ingest_log_file(log_path, batch_size=2):
        for event in batch:
            info = event.connection_info()
            print(json.dumps(asdict(info)))
            requests.post(endpoint, json=asdict(info),
                          headers={"Content-Type": "application/json",
                                   "X-Access-Key": access_key})
            
if __name__ == "__main__":
    main()