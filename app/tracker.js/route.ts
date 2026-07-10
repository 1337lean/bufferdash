export const dynamic = "force-dynamic";

export const tracker = String.raw`
(function () {
  var script = document.currentScript;
  var siteId = script && script.getAttribute("data-site-id");
  if (!siteId) return;

  var endpoint = new URL("/api/track", script.src).toString();
  var visitorKey = "bufferdash_visitor_id";
  var sessionKey = "bufferdash_session_id";
  var sessionTimeKey = "bufferdash_session_last_seen_at";

  function id(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function getVisitorId() {
    try {
      var existing = localStorage.getItem(visitorKey);
      if (existing) return existing;
      var next = id("v");
      localStorage.setItem(visitorKey, next);
      return next;
    } catch (error) {
      return id("v");
    }
  }

  function getSessionId() {
    try {
      var existing = sessionStorage.getItem(sessionKey);
      var lastSeenAt = Number(sessionStorage.getItem(sessionTimeKey) || "0");
      if (existing && Date.now() - lastSeenAt < 30 * 60 * 1000) {
        sessionStorage.setItem(sessionTimeKey, String(Date.now()));
        return existing;
      }
      var next = id("s");
      sessionStorage.setItem(sessionKey, next);
      sessionStorage.setItem(sessionTimeKey, String(Date.now()));
      return next;
    } catch (error) {
      return id("s");
    }
  }

  var visitorId = getVisitorId();
  var sessionId = getSessionId();
  var startedAt = Date.now();

  function payload(type, metadata) {
    var url = new URL(window.location.href);
    url.hash = "";
    var includeQuery = script.hasAttribute && script.hasAttribute("data-include-query");
    if (!includeQuery) url.search = "";
    var referrer = null;
    if (document.referrer) {
      try {
        var referrerUrl = new URL(document.referrer);
        referrerUrl.hash = "";
        if (!includeQuery) referrerUrl.search = "";
        referrer = referrerUrl.toString();
      } catch (error) {}
    }
    return {
      siteId: siteId,
      type: type || "pageview",
      path: window.location.pathname,
      url: url.toString(),
      referrer: referrer,
      title: document.title || null,
      screenWidth: window.screen && window.screen.width,
      screenHeight: window.screen && window.screen.height,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      visitorId: visitorId,
      sessionId: sessionId,
      metadata: metadata || undefined
    };
  }

  function send(data, keepalive) {
    var body = JSON.stringify(data);
    if (navigator.sendBeacon && keepalive) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body,
      keepalive: Boolean(keepalive),
      credentials: "omit"
    }).catch(function () {});
  }

  window.bufferdash = window.bufferdash || {};
  window.bufferdash.track = function (type, metadata) {
    send(payload(type || "custom", metadata));
  };

  send(payload("pageview"));

  window.addEventListener("pagehide", function () {
    var data = payload("pagehide");
    data.durationMs = Date.now() - startedAt;
    send(data, true);
  });

  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest && event.target.closest("a[href]");
    if (!target) return;
    var href = target.href;
    if (href && target.hostname !== window.location.hostname) {
      try {
        var outboundUrl = new URL(href);
        outboundUrl.hash = "";
        if (!(script.hasAttribute && script.hasAttribute("data-include-query"))) outboundUrl.search = "";
        href = outboundUrl.toString();
      } catch (error) {}
      send(payload("outbound_click", { href: href }), true);
    }
  });
})();`;

export function GET() {
  return new Response(tracker, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300, stale-while-revalidate=86400"
    }
  });
}
