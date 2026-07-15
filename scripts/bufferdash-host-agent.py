#!/usr/bin/env python3
"""BufferDash host collector: sanitized Caddy errors/aggregates and VPS /proc metrics."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import socket
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

VERSION = "1.0.0"
ENDPOINT = os.environ.get("BUFFERDASH_ENDPOINT", "http://127.0.0.1:3001").rstrip("/")
SECRET = os.environ.get("BUFFERDASH_INGESTION_SECRET", "")
LOG_PATH = Path(os.environ.get("BUFFERDASH_CADDY_LOG", "/var/log/caddy/bufferdash-access.json"))
STATE_PATH = Path(os.environ.get("BUFFERDASH_AGENT_STATE", "/var/lib/bufferdash-agent/checkpoint.json"))
HOSTNAME = socket.gethostname()[:255]


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def post(path: str, payload: dict) -> bool:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(ENDPOINT + path, data=body, method="POST", headers={
        "Authorization": "Bearer " + SECRET,
        "Content-Type": "application/json",
        "User-Agent": "bufferdash-host-agent/" + VERSION,
    })
    delay = 1.0
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status == 204
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            if attempt == 4:
                print(f"post {path} failed: {error}", file=sys.stderr, flush=True)
                return False
            time.sleep(delay)
            delay = min(delay * 2, 16)
    return False


def load_state() -> dict:
    try:
        value = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def save_state(identity: str, offset: int) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATE_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps({"identity": identity, "offset": offset}), encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(STATE_PATH)


def identity(path: Path) -> str:
    stat = path.stat()
    return f"{stat.st_dev}:{stat.st_ino}"


def find_log(saved_identity: str | None) -> Path | None:
    candidates = [LOG_PATH] + sorted(LOG_PATH.parent.glob(LOG_PATH.stem + "*"), key=lambda path: path.stat().st_mtime)
    existing = [path for path in candidates if path.is_file()]
    if saved_identity:
        for path in existing:
            if identity(path) == saved_identity:
                return path
    return LOG_PATH if LOG_PATH.is_file() else (existing[0] if existing else None)


def first_header(headers: object, name: str) -> str | None:
    if not isinstance(headers, dict):
        return None
    value = headers.get(name) or headers.get(name.lower())
    if isinstance(value, list):
        value = value[0] if value else None
    return str(value) if value is not None else None


def strip_ip(value: object) -> str:
    text = str(value or "0.0.0.0").strip()
    if text.startswith("[") and "]" in text:
        return text[1:text.index("]")]
    if text.count(":") == 1 and "." in text:
        return text.rsplit(":", 1)[0]
    return text


def parse_caddy(line: bytes, file_identity: str, start: int, end: int) -> dict | None:
    try:
        row = json.loads(line)
    except (UnicodeDecodeError, ValueError):
        return None
    request = row.get("request") if isinstance(row.get("request"), dict) else {}
    headers = request.get("headers")
    uri = str(request.get("uri") or "/")
    path = uri.split("?", 1)[0].split("#", 1)[0] or "/"
    timestamp = row.get("ts")
    if isinstance(timestamp, (int, float)):
        timestamp = datetime.fromtimestamp(timestamp, timezone.utc).isoformat().replace("+00:00", "Z")
    elif not isinstance(timestamp, str):
        timestamp = iso_now()
    duration = float(row.get("duration") or 0)
    if duration < 1000:
        duration *= 1000
    key = hashlib.sha256(f"{file_identity}:{start}:{end}".encode()).hexdigest()
    error = row.get("error") or row.get("err_trace") or row.get("err_id")
    if error:
        error = re.sub(r"\?[^\s\"'<>]*", "?[redacted]", str(error))
        error = re.sub(r"(authorization|cookie)\s*[:=]\s*\S+", r"\1=[redacted]", error, flags=re.I)
    return {
        "requestKey": key,
        "timestamp": timestamp,
        "host": str(request.get("host") or "unknown")[:255],
        "method": str(request.get("method") or "GET")[:16],
        "path": path[:4000],
        "status": int(row.get("status") or 0),
        "durationMs": max(0, duration),
        "responseBytes": max(0, int(row.get("size") or 0)),
        "clientIp": strip_ip(request.get("client_ip") or request.get("remote_ip") or row.get("remote_ip")),
        "userAgent": (first_header(headers, "User-Agent") or "")[:1000] or None,
        "cfRay": (first_header(headers, "Cf-Ray") or "")[:120] or None,
        "error": str(error)[:1000] if error else None,
    }


def collect_log_batch(state: dict) -> tuple[dict | None, str | None, int]:
    path = find_log(state.get("identity"))
    if not path:
        return None, None, 0
    file_identity = identity(path)
    offset = int(state.get("offset", 0)) if state.get("identity") == file_identity else 0
    if path.stat().st_size < offset:
        offset = 0
    records: list[dict] = []
    end = offset
    started = time.monotonic()
    with path.open("rb") as handle:
        handle.seek(offset)
        while len(records) < 100 and time.monotonic() - started < 5:
            line_start = handle.tell()
            line = handle.readline()
            if not line:
                break
            end = handle.tell()
            record = parse_caddy(line, file_identity, line_start, end)
            if record and 100 <= record["status"] <= 599:
                records.append(record)
    if end == offset:
        return None, file_identity, offset
    batch_key = hashlib.sha256(f"{file_identity}:{offset}:{end}".encode()).hexdigest()
    return ({"source": "caddy", "batchKey": batch_key, "hostname": HOSTNAME, "agentVersion": VERSION, "records": records} if records else {}), file_identity, end


def cpu_line() -> list[int]:
    values = Path("/proc/stat").read_text(encoding="utf-8").splitlines()[0].split()[1:]
    return [int(value) for value in values]


def cpu_percent(previous: list[int], current: list[int]) -> float:
    previous_idle = previous[3] + previous[4]
    current_idle = current[3] + current[4]
    total = sum(current) - sum(previous)
    return round(100 * (1 - (current_idle - previous_idle) / total), 2) if total > 0 else 0.0


def mem_values() -> tuple[float, float]:
    values = {}
    for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
        key, raw = line.split(":", 1)
        values[key] = int(raw.strip().split()[0])
    total = values["MemTotal"] / 1024
    return total - values.get("MemAvailable", values.get("MemFree", 0)) / 1024, total


def network_values() -> tuple[int, int]:
    rx = tx = 0
    for interface in Path("/sys/class/net").iterdir():
        if interface.name == "lo":
            continue
        try:
            rx += int((interface / "statistics/rx_bytes").read_text())
            tx += int((interface / "statistics/tx_bytes").read_text())
        except OSError:
            pass
    return rx, tx


def host_payload(previous_cpu: list[int]) -> tuple[dict, list[int]]:
    current_cpu = cpu_line()
    memory_used, memory_total = mem_values()
    disk = shutil.disk_usage("/")
    load1, load5, load15 = os.getloadavg()
    uptime = int(float(Path("/proc/uptime").read_text().split()[0]))
    rx, tx = network_values()
    timestamp = iso_now()
    return {
        "sampleKey": f"{HOSTNAME}:{timestamp}", "timestamp": timestamp, "hostname": HOSTNAME, "agentVersion": VERSION,
        "cpuPercent": cpu_percent(previous_cpu, current_cpu),
        "memoryUsedMb": memory_used, "memoryTotalMb": memory_total,
        "diskUsedGb": disk.used / 1024 ** 3, "diskTotalGb": disk.total / 1024 ** 3,
        "load1": load1, "load5": load5, "load15": load15, "uptimeSeconds": uptime,
        "networkRxBytes": rx, "networkTxBytes": tx,
    }, current_cpu


def main() -> int:
    if not SECRET or len(SECRET) < 32:
        print("BUFFERDASH_INGESTION_SECRET must contain at least 32 characters", file=sys.stderr)
        return 2
    state = load_state()
    previous_cpu = cpu_line()
    next_metric = time.monotonic()
    while True:
        batch, file_identity, end = collect_log_batch(state)
        if batch is not None:
            if not batch or post("/api/ingest/http", batch):
                save_state(file_identity or "", end)
                state = {"identity": file_identity, "offset": end}
        if time.monotonic() >= next_metric:
            payload, previous_cpu = host_payload(previous_cpu)
            post("/api/ingest/host", payload)
            next_metric = time.monotonic() + 60
        time.sleep(1)


if __name__ == "__main__":
    raise SystemExit(main())
