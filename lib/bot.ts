const knownBots = [
  ["googlebot", "Googlebot"],
  ["bingbot", "Bingbot"],
  ["ahrefs", "Ahrefs"],
  ["semrush", "Semrush"],
  ["discordbot", "Discordbot"],
  ["twitterbot", "Twitterbot"],
  ["facebookexternalhit", "Facebook"],
  ["slurp", "Yahoo Slurp"],
  ["crawler", "Crawler"],
  ["spider", "Spider"],
  ["bot", "Generic bot"]
] as const;

export const suspiciousPaths = [
  "/wp-admin",
  "/wp-login.php",
  "/xmlrpc.php",
  "/.env",
  "/.git/config",
  "/phpmyadmin",
  "/admin.php",
  "/vendor/phpunit"
];

export function detectBot(userAgent: string | null | undefined) {
  const ua = (userAgent || "").toLowerCase().trim();
  if (!ua) {
    return { isBot: true, botName: "Empty user agent" };
  }

  const match = knownBots.find(([token]) => ua.includes(token));
  return {
    isBot: Boolean(match),
    botName: match?.[1] || null
  };
}

export function isSuspiciousPath(path: string | null | undefined) {
  if (!path) return false;
  return suspiciousPaths.some((pattern) => path.toLowerCase().startsWith(pattern));
}
