import vm from "node:vm";
import { describe, expect, it } from "vitest";
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

function runTracker(localStorage: MemoryStorage, sessionStorage: MemoryStorage) {
  const requests: Array<Record<string, unknown>> = [];
  const window = {
    location: new URL("https://buffer.lol/tools/dns-lookup"),
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
  it("reuses visitor and session identifiers across page loads in one tab", () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();

    const first = runTracker(localStorage, sessionStorage)[0];
    const second = runTracker(localStorage, sessionStorage)[0];

    expect(first.type).toBe("pageview");
    expect(second.visitorId).toBe(first.visitorId);
    expect(second.sessionId).toBe(first.sessionId);
  });

  it("does not include URL fragments", () => {
    const request = runTracker(new MemoryStorage(), new MemoryStorage())[0];
    expect(request.url).toBe("https://buffer.lol/tools/dns-lookup");
  });
});
