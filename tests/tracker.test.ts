import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tracker } from "../app/tracker.js/route";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

type TrackerHarness = {
  requests: Array<Record<string, unknown>>;
  beacons: Array<{ body: unknown }>;
  documentListeners: Record<string, (event: { target?: unknown }) => void>;
  windowListeners: Record<string, () => void>;
  intervals: Array<() => void>;
  documentState: { visibilityState: string };
};

function trackerHarness(localStorage = new MemoryStorage(), sessionStorage = new MemoryStorage()): TrackerHarness {
  const requests: Array<Record<string, unknown>> = [];
  const beacons: Array<{ body: unknown }> = [];
  const documentListeners: Record<string, (event: { target?: unknown }) => void> = {};
  const windowListeners: Record<string, () => void> = {};
  const intervals: Array<() => void> = [];
  const documentState = { visibilityState: "visible" };
  const window = {
    location: new URL("https://buffer.lol/tools/dns-lookup?token=private#private-fragment"), screen: { width: 1440, height: 900 },
    addEventListener(name: string, handler: () => void) { windowListeners[name] = handler; },
    setInterval(handler: () => void) { intervals.push(handler); return 1; },
    bufferdash: undefined as undefined | { track: (type: string, metadata?: Record<string, unknown>) => void; trackTool: (name: string, metadata?: Record<string, unknown>) => void }
  };
  vm.runInNewContext(tracker, {
    Date, Intl, URL,
    document: {
      currentScript: { src: "https://dash.buffer.lol/tracker.js", getAttribute: (name: string) => name === "data-site-id" ? "buffer-lol-test" : null },
      referrer: "https://example.com/?private=yes", title: "DNS lookup",
      get visibilityState() { return documentState.visibilityState; },
      addEventListener(name: string, handler: (event: { target?: unknown }) => void) { documentListeners[name] = handler; }
    },
    fetch: (_url: string, options: { body: string }) => { requests.push(JSON.parse(options.body)); return Promise.resolve({ ok: true }); },
    localStorage,
    navigator: { language: "en-US", sendBeacon: (_url: string, body: unknown) => { beacons.push({ body }); return true; } },
    sessionStorage, window
  });
  return { requests, beacons, documentListeners, windowListeners, intervals, documentState };
}

function runTracker(localStorage: MemoryStorage, sessionStorage: MemoryStorage) {
  const requests: Array<Record<string, unknown>> = [];
  const window = {
    location: new URL("https://buffer.lol/tools/dns-lookup?token=private#private-fragment"),
    screen: { width: 1440, height: 900 },
    addEventListener() {},
    bufferdash: undefined as undefined | { track: (type: string, metadata?: Record<string, unknown>) => void }
  };

  vm.runInNewContext(tracker, {
    Blob,
    Date,
    Intl,
    URL,
    document: {
      currentScript: {
        src: "https://dash.buffer.lol/tracker.js",
        getAttribute: (name: string) => name === "data-site-id" ? "buffer-lol-test" : null
      },
      referrer: "https://example.com/",
      title: "DNS lookup",
      addEventListener() {}
    },
    fetch: (_url: string, options: { body: string }) => {
      requests.push(JSON.parse(options.body) as Record<string, unknown>);
      return Promise.resolve({ ok: true });
    },
    localStorage,
    navigator: { language: "en-US" },
    sessionStorage,
    window
  });

  return requests;
}

describe("browser tracker", () => {
  afterEach(() => vi.useRealTimers());
  it("reuses visitor and session identifiers across page loads in one tab", () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();

    const first = runTracker(localStorage, sessionStorage)[0];
    const second = runTracker(localStorage, sessionStorage)[0];

    expect(first.type).toBe("pageview");
    expect(second.visitorId).toBe(first.visitorId);
    expect(second.sessionId).toBe(first.sessionId);
  });

  it("does not include URL fragments or query strings by default", () => {
    const request = runTracker(new MemoryStorage(), new MemoryStorage())[0];
    expect(request.url).toBe("https://buffer.lol/tools/dns-lookup");
  });

  it("expires a session after thirty minutes and resets engagement", () => {
    const local = new MemoryStorage(); const session = new MemoryStorage();
    session.setItem("bufferdash_session_id", "s_expired_session");
    session.setItem("bufferdash_session_last_seen_at", "1");
    session.setItem("bufferdash_session_engagement_ms", "50000");
    const request = runTracker(local, session)[0];
    expect(request.sessionId).not.toBe("s_expired_session");
    expect(session.getItem("bufferdash_session_engagement_ms")).toBe("0");
  });

  it("reports cumulative visible engagement on heartbeat and pauses while hidden", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    const harness = trackerHarness();
    vi.setSystemTime(new Date("2026-07-15T12:00:15Z"));
    harness.intervals[0]();
    expect(harness.requests.at(-1)).toMatchObject({ type: "session_ping", durationMs: 15000 });
    harness.documentState.visibilityState = "hidden";
    harness.documentListeners.visibilitychange({});
    expect(typeof harness.beacons[0].body).toBe("string");
    expect(JSON.parse(String(harness.beacons[0].body))).toMatchObject({ type: "session_ping", durationMs: 15000 });
    vi.setSystemTime(new Date("2026-07-15T12:01:15Z"));
    harness.intervals[0]();
    expect(harness.requests.at(-1)).toMatchObject({ type: "session_ping", durationMs: 15000 });
  });

  it("tracks a declarative tool exactly once per activation", () => {
    const harness = trackerHarness();
    const tool = { getAttribute: () => " dns-lookup " };
    const target = { closest: (selector: string) => selector === "[data-bufferdash-tool]" ? tool : null };
    harness.documentListeners.click({ target });
    expect(harness.requests.filter((row) => row.type === "tool_used")).toHaveLength(1);
    expect(harness.requests.at(-1)?.metadata).toEqual({ tool: "dns-lookup" });
  });
});
