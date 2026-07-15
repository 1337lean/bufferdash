"use client";

import { useState } from "react";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="copy-field"><span>{label}</span><code>{value}</code><button type="button" className="icon-button" onClick={async () => {
    await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  }}>{copied ? "Copied" : "Copy"}</button></div>;
}
