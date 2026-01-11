export function getCreemApiBaseUrl(): string {
  const baseUrl = (process.env.CREEM_API_BASE_URL || "https://api.creem.io").trim();
  const normalized = baseUrl.replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production" && /test-api\.creem\.io/i.test(normalized)) {
    throw new Error("CREEM_API_BASE_URL points to test-api in production");
  }

  return normalized;
}

export function creemUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error("creemUrl path must start with '/'");
  }
  return `${getCreemApiBaseUrl()}${path}`;
}

