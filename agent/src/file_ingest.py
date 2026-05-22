import json
import os
import time
from typing import Dict, Iterator, List, Optional, TextIO

from backend import LogEvent

FIELD_MAP: Dict[str, str] = {
    "ClientAddr": "client_addr",
    "ClientHost": "client_host",
    "ClientPort": "client_port",
    "RequestAddr": "request_addr",
    "RequestHost": "request_host",
    "RequestMethod": "request_method",
    "RequestPath": "request_path",
    "RouterName": "router_name",
    "ServiceName": "service_name",
    "StartLocal": "start_local",
    "request_Accept-Language": "request_accept_language",
    "request_X-Forwarded-For": "request_x_forwarded_for",
    "request_Cf-Connecting-Ip": "request_cf_connecting_ip",
    "request_Cf-Ipcountry": "request_cf_ipcountry",
    "request_X-Real-Ip": "request_x_real_ip",
}

def _sanitize_line(line: str) -> str:
    trimmed = line.strip()
    if not trimmed:
        return ""
    if trimmed.startswith("["):
        trimmed = trimmed[1:].lstrip()
    if trimmed.endswith("]"):
        trimmed = trimmed[:-1].rstrip()
    if trimmed.endswith(","):
        trimmed = trimmed[:-1].rstrip()
    return trimmed

def _parse_event(line: str) -> Optional[LogEvent]:
    sanitized = _sanitize_line(line)
    if not sanitized:
        return None
    try:
        payload = json.loads(sanitized)
    except json.JSONDecodeError:
        return None  
    if not isinstance(payload, dict):
        return None  
    
    # Minor optimization: skip attributes that do not exist in the source payload
    kwargs = {attr: payload[key] for key, attr in FIELD_MAP.items() if key in payload}
    return LogEvent(**kwargs)

def _drain(fh: TextIO) -> List[LogEvent]:
    events = []
    while line := fh.readline():
        event = _parse_event(line)
        if event is not None:
            events.append(event)
    return events

def ingest_log_file(
    file_path: str,
    *,
    start_at_end: bool = True,
    poll_interval: float = 0.1,
    batch_size: int = 200,  # Group objects to maximize pipeline throughput
) -> Iterator[List[LogEvent]]:  # Yields batches of events
    if poll_interval <= 0:
        raise ValueError("poll_interval must be greater than zero.")

    file_handle: Optional[TextIO] = None
    current_inode: Optional[int] = None
    batch: List[LogEvent] = []

    try:
        while True:
            if file_handle is None:
                try:
                    file_handle = open(file_path, "r", encoding="utf-8")
                except FileNotFoundError:
                    time.sleep(poll_interval)
                    continue
                current_inode = os.fstat(file_handle.fileno()).st_ino
                if start_at_end:
                    file_handle.seek(0, os.SEEK_END)
                    start_at_end = False # Only execute seek once on initialization

            # Read up to batch_size lines in a single iteration loop pass
            for _ in range(batch_size):
                line = file_handle.readline()
                if not line:
                    break
                event = _parse_event(line)
                if event is not None:
                    batch.append(event)

            # If our batch is filled or we reached an active resting threshold, ship it
            if batch:
                yield batch
                batch = []
                continue # Instantly try reading again without sleeping

            # File is currently empty/exhausted. Sleep before checking file system state
            time.sleep(poll_interval)

            try:
                stat = os.stat(file_path)
            except FileNotFoundError:
                # File deleted completely; exhaust anything remaining in current buffer
                batch = _drain(file_handle)
                if batch:
                    yield batch
                    batch = []
                
                file_handle.close()
                file_handle = None
                current_inode = None
                continue

            # ROTATION RACE PROTECTION: Check if file swapped inodes
            if stat.st_ino != current_inode:
                # Drain the remainder of the old file handle before discarding it
                batch = _drain(file_handle)
                if batch:
                    yield batch
                    batch = []

                file_handle.close()
                file_handle = None
                current_inode = None
                
            # TRUNCATION PROTECTION
            elif stat.st_size < file_handle.tell():
                file_handle.seek(0)
                
    finally:
        if file_handle is not None:
            file_handle.close()
