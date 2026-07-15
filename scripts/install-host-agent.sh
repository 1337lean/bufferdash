#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ "$(id -u)" -ne 0 ]; then
  echo "Run this installer as root." >&2
  exit 1
fi

getent group bufferdash-agent >/dev/null || groupadd --system bufferdash-agent
id bufferdash-agent >/dev/null 2>&1 || useradd --system --gid bufferdash-agent --home-dir /var/lib/bufferdash-agent --shell /usr/sbin/nologin bufferdash-agent
install -d -o bufferdash-agent -g bufferdash-agent -m 0750 /var/lib/bufferdash-agent
install -d -o root -g root -m 0755 /usr/local/lib/bufferdash
install -o root -g root -m 0755 "$root_dir/scripts/bufferdash-host-agent.py" /usr/local/lib/bufferdash/bufferdash-host-agent.py
install -o root -g root -m 0644 "$root_dir/deploy/bufferdash-host-agent.service" /etc/systemd/system/bufferdash-host-agent.service
if [ ! -e /etc/bufferdash-agent.env ]; then
  install -o root -g root -m 0600 "$root_dir/deploy/bufferdash-agent.env.example" /etc/bufferdash-agent.env
  echo "Created /etc/bufferdash-agent.env; set the ingestion secret before starting the service."
  exit 0
fi
chmod 0600 /etc/bufferdash-agent.env
systemctl daemon-reload
systemctl enable --now bufferdash-host-agent.service
systemctl restart bufferdash-host-agent.service
