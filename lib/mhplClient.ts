// lib/mhplClient.ts
const MHPL_BASE_URL =
  process.env.MHPL_BASE_URL ?? "http://appit.ignitetechno.com:8080";

const MHPL_USERNAME = process.env.MHPL_USERNAME ?? "MHPL.API";
const MHPL_PASSWORD = process.env.MHPL_PASSWORD ?? "1234567890#25";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getMhplToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const authHeader =
    "Basic " +
    Buffer.from(`${MHPL_USERNAME}:${MHPL_PASSWORD}`).toString("base64");

  const res = await fetch(`${MHPL_BASE_URL}/ords/xapi/auth/token`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `MHPL auth failed: ${res.status} ${res.statusText} – ${text.slice(0, 300)}`
    );
  }

  const data = await res.json();

  const token =
    data.access_token || data.token || data.Token || data.jwt || null;
  if (!token) {
    throw new Error("MHPL auth response missing token field");
  }

  const expiresInMs = (data.expires_in ?? 600) * 1000;
  tokenExpiresAt = now + expiresInMs - 30_000;
  cachedToken = token;

  return token;
}

export async function callMhpl(
  path: string,
  options: {
    method?: "GET" | "POST";
    headers?: Record<string, string>;
  } = {}
) {
  const token = await getMhplToken();

  const res = await fetch(`${MHPL_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `MHPL API error ${res.status} ${res.statusText}: ${text.slice(0, 500)}`
    );
  }

  return res.json();
}
