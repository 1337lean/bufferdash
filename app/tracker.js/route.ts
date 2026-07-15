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
  var engagementKey = "bufferdash_session_engagement_ms";
  var maxEngagement = 24 * 60 * 60 * 1000;

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
      sessionStorage.setItem(engagementKey, "0");
      return next;
    } catch (error) {
      return id("s");
    }
  }

  var visitorId = getVisitorId();
  var sessionId = getSessionId();
  var storedEngagement = 0;
  try { storedEngagement = Math.min(maxEngagement, Math.max(0, Number(sessionStorage.getItem(engagementKey) || "0"))); } catch (error) {}
  var activeSince = document.visibilityState === "hidden" ? null : Date.now();

  function currentEngagement() {
    var value = storedEngagement + (activeSince === null ? 0 : Date.now() - activeSince);
    return Math.min(maxEngagement, Math.max(0, Math.round(value)));
  }

  function persistEngagement() {
    storedEngagement = currentEngagement();
    activeSince = null;
    try {
      sessionStorage.setItem(engagementKey, String(storedEngagement));
      sessionStorage.setItem(sessionTimeKey, String(Date.now()));
    } catch (error) {}
    return storedEngagement;
  }

  function sanitizeMetadata(metadata) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
    var result = {};
    Object.keys(metadata).slice(0, 20).forEach(function (key) {
      var value = metadata[key];
      if (typeof value === "string") result[String(key).slice(0, 80)] = value.slice(0, 500);
      else if (typeof value === "number" || typeof value === "boolean" || value === null) result[String(key).slice(0, 80)] = value;
    });
    return result;
  }

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
      metadata: sanitizeMetadata(metadata)
    };
  }

  function send(data, keepalive) {
    var body = JSON.stringify(data);
    if (navigator.sendBeacon && keepalive) {
      navigator.sendBeacon(endpoint, body);
      return;
    }
    fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: body,
      keepalive: Boolean(keepalive),
      credentials: "omit"
    }).catch(function () {});
  }

  window.bufferdash = window.bufferdash || {};
  window.bufferdash.track = function (type, metadata) {
    if (type === "tool_used") {
      var details = sanitizeMetadata(metadata) || {};
      var tool = String(details.tool || "").trim().slice(0, 120);
      if (!tool) return;
      details.tool = tool;
      send(payload("tool_used", details));
      return;
    }
    send(payload(type || "custom", metadata));
  };
  window.bufferdash.trackTool = function (name, metadata) {
    var tool = String(name || "").trim().slice(0, 120);
    if (!tool) return;
    var details = sanitizeMetadata(metadata) || {};
    details.tool = tool;
    window.bufferdash.track("tool_used", details);
  };

  send(payload("pageview"));

  function flush(type) {
    var data = payload("pagehide");
    data.type = type;
    data.durationMs = persistEngagement();
    send(data, true);
  }

  if (window.setInterval) {
    window.setInterval(function () {
      if (document.visibilityState !== "hidden") {
        var data = payload("session_ping");
        data.durationMs = currentEngagement();
        try { sessionStorage.setItem(sessionTimeKey, String(Date.now())); } catch (error) {}
        send(data);
      }
    }, 15000);
  }

  window.addEventListener("pagehide", function () { flush("pagehide"); });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      flush("session_ping");
    } else if (activeSince === null) {
      activeSince = Date.now();
    }
  });

  document.addEventListener("click", function (event) {
    var toolTarget = event.target && event.target.closest && event.target.closest("[data-bufferdash-tool]");
    if (toolTarget) {
      window.bufferdash.trackTool(toolTarget.getAttribute("data-bufferdash-tool"));
    }
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
