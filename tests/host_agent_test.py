import importlib.util
import json
import pathlib
import unittest

MODULE_PATH = pathlib.Path(__file__).parents[1] / "scripts" / "bufferdash-host-agent.py"
SPEC = importlib.util.spec_from_file_location("bufferdash_host_agent", MODULE_PATH)
AGENT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AGENT)


class HostAgentTests(unittest.TestCase):
    def test_caddy_fixture_is_sanitized(self):
        line = json.dumps({
            "ts": 1784116800.0, "status": 502, "duration": 0.012, "size": 321,
            "request": {"host": "dash.buffer.lol", "method": "GET", "uri": "/health?token=private", "client_ip": "203.0.113.10", "headers": {"User-Agent": ["test-agent"], "Cf-Ray": ["ray-id"]}}
        }).encode()
        record = AGENT.parse_caddy(line, "1:2", 0, len(line))
        self.assertEqual(record["path"], "/health")
        self.assertEqual(record["durationMs"], 12)
        self.assertNotIn("private", json.dumps(record))

    def test_cpu_delta(self):
        self.assertEqual(AGENT.cpu_percent([10, 0, 0, 90, 0], [20, 0, 0, 180, 0]), 10.0)


if __name__ == "__main__":
    unittest.main()
