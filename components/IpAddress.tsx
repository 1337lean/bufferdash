"use client";

import { useState } from "react";

export function IpAddress({ address, isCloudflare = false }: { address: string; isCloudflare?: boolean }) {
  const [showAddress, setShowAddress] = useState(false);
  if (!isCloudflare) return <span>{address}</span>;

  return <button
    type="button"
    className="ip-address-toggle"
    aria-label={showAddress ? `Cloudflare address ${address}; show provider` : `Cloudflare address; show IP`}
    title={showAddress ? "Show provider" : "Show masked IP address"}
    onClick={() => setShowAddress((current) => !current)}
  >{showAddress ? address : "Cloudflare"}</button>;
}
