import { env } from "@/lib/env";

export function trackingSnippet(publicKey: string, appUrl = env.appUrl) {
  return `<script defer src="${appUrl.replace(/\/$/, "")}/tracker.js" data-site-id="${publicKey}"></script>`;
}
