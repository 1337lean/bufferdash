"use client";

import { useState } from "react";

export function CopySnippet({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="snippet-box">
      <code>{value}</code>
      <button
        className="icon-button text-button"
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
