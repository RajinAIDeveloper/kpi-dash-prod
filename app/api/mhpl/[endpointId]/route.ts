// app/api/mhpl/[endpointId]/route.ts
//
// Server-side proxy for MHPL KPI endpoints.
// - Accepts query string and/or JSON body parameters
// - Obtains a bearer token from the MHPL auth endpoint
// - Calls the requested MHPL endpoint with parameters as headers
// - Returns the raw MHPL JSON (or text) to the browser

import { NextResponse } from "next/server";

// Force the Node.js runtime so outbound fetch + Buffer work on Vercel
export const runtime = 'nodejs'

const MHPL_BASE_URL =
  process.env.MHPL_BASE_URL ?? "http://appit.ignitetechno.com:8080";

const MHPL_USERNAME = process.env.MHPL_USERNAME ?? "MHPL.API";
const MHPL_PASSWORD = process.env.MHPL_PASSWORD ?? "1234567890#25";

// Mapping of endpointId -> relative path on MHPL server
const MHPL_ENDPOINTS: Record<string, string> = {
  mhpl0001: "/xapi/xapp/mhpl0001",
  mhpl0002: "/xapi/xapp/mhpl0002",
  mhpl0003: "/ords/xapi/xapp/mhpl0003",
  mhpl0004: "/ords/xapi/xapp/mhpl0004",
  mhpl0005: "/ords/xapi/xapp/mhpl0005",
  mhpl0006: "/ords/xapi/xapp/mhpl0006",
  mhpl0007: "/ords/xapi/xapp/mhpl0007",
  mhpl0008: "/ords/xapi/xapp/mhpl0008",
  mhpl0009: "/ords/xapi/xapp/mhpl0009",
  mhpl0010: "/ords/xapi/xapp/mhpl0010",
};

// Simple in-memory cache for the MHPL bearer token.
// This lives per server instance (or per Vercel lambda) and avoids
// calling the auth endpoint on every KPI request.
let cachedToken: string | null = null;
let cachedTokenExpiresAt: number | null = null;

function isCachedTokenValid(): boolean {
  if (!cachedToken || !cachedTokenExpiresAt) return false;
  // Add a 60-second safety margin before expiry
  return Date.now() < cachedTokenExpiresAt - 60_000;
}

function updateTokenCache(token: string) {
  cachedToken = token;
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadJson = Buffer.from(parts[1], "base64").toString("utf8");
      const payload = JSON.parse(payloadJson);
      if (typeof payload.exp === "number") {
        // exp is seconds since epoch
        cachedTokenExpiresAt = payload.exp * 1000;
        return;
      }
    }
  } catch {
    // Ignore parsing errors and fall back
  }
  // Fallback: assume token is valid for 24h
  cachedTokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
}

function extractTokenFromPayload(payload: any, raw: string): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidateKeys = ["Token", "token", "access_token", "bearer"];
  for (const key of candidateKeys) {
    const value = (payload as any)[key];
    if (typeof value === "string" && value.trim().length > 0) {
      const trimmed = value.trim();
      if (!trimmed.includes("<") && !trimmed.includes(">")) {
        return trimmed;
      }
    }
  }

  if (Array.isArray(payload.items)) {
    for (const item of payload.items) {
      const nested = extractTokenFromPayload(item, "");
      if (nested) return nested;
    }
  }

  if (raw?.includes("Token")) {
    try {
      const parsed = JSON.parse(raw);
      return extractTokenFromPayload(parsed, "");
    } catch {
      // ignore parse error, fall through
    }
  }

  return null;
}

async function getBearerToken(): Promise<string> {
  // Reuse cached token if still valid
  if (isCachedTokenValid()) {
    return cachedToken as string;
  }

  const authUrl = `${MHPL_BASE_URL}/ords/xapi/auth/token`;

  const basicAuthValue =
    "Basic " + Buffer.from(`${MHPL_USERNAME}:${MHPL_PASSWORD}`).toString("base64");

  const res = await fetch(authUrl, {
    method: "POST",
    headers: {
      Authorization: basicAuthValue,
      Accept: "application/json, */*",
    },
  });

  const rawBody = await res.text();

  if (!res.ok) {
    console.error("[MHPL_PROXY_AUTH] Auth request failed:", {
      status: res.status,
      statusText: res.statusText,
      bodyPreview: rawBody.slice(0, 300),
    });
    throw new Error(
      `Auth failed (${res.status} ${res.statusText || "Unknown error"})`
    );
  }

  let payload: any = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    payload = null;
  }

  const token = extractTokenFromPayload(payload, rawBody);
  if (!token) {
    console.error("[MHPL_PROXY_AUTH] No token found in auth response:", {
      status: res.status,
      statusText: res.statusText,
      bodyPreview: rawBody.slice(0, 300),
    });
    throw new Error("No bearer token found in auth response");
  }

  // Cache token for subsequent requests
  updateTokenCache(token);

  return token;
}

function normalizeParamsForEndpoint(
  endpointId: string,
  raw: Record<string, any>
): Record<string, string> {
  const out: Record<string, any> = {};

  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }

  const isZero = (ps: any) => ps === 0 || ps === "0";

  if (endpointId === "mhpl0005" || endpointId === "mhpl0006") {
    if (out.PageSize !== undefined && out.Page_Size === undefined) {
      out.Page_Size = out.PageSize;
      delete out.PageSize;
    }
    if (out.PageNumber !== undefined && out.Page_Number === undefined) {
      out.Page_Number = out.PageNumber;
      delete out.PageNumber;
    }
    if (isZero(out.Page_Size)) {
      delete out.Page_Size;
      delete out.Page_Number;
    }
  } else {
    if (isZero(out.PageSize)) {
      delete out.PageSize;
      delete out.PageNumber;
    }
  }

  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(out)) {
    cleaned[k] = String(v);
  }

  return cleaned;
}

// Server-side safety defaults so API calls never miss critical params
function applyEndpointDefaults(
  endpointId: string,
  params: Record<string, string>
): Record<string, string> {
  const out = { ...params };

  // Ensure StartDate/EndDate are always present
  const needsStart = !out.StartDate || String(out.StartDate).trim() === '';
  const needsEnd = !out.EndDate || String(out.EndDate).trim() === '';
  if (needsStart || needsEnd) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    if (needsStart) out.StartDate = fmt(start);
    if (needsEnd) out.EndDate = fmt(now);
  }

  // Endpoint-specific fallbacks
  switch (endpointId) {
    case 'mhpl0003':
      if (!out.PatCat) out.PatCat = 'IPD';
      break;
    case 'mhpl0004':
      // MHPL0004 rejects empty PatCat; default to both categories to match curl success
      if (!out.PatCat) out.PatCat = 'IPD,OPD';
      break;
    case 'mhpl0005':
      if (!out.ServiceTypes) out.ServiceTypes = 'IPD';
      break;
    case 'mhpl0006':
      if (!out.InsuranceProviders) out.InsuranceProviders = 'MetLife Alico';
      break;
    case 'mhpl0007':
      if (!out.Threshold) out.Threshold = '70';
      break;
    default:
      break;
  }

  return out;
}

async function handleMhplProxyRequest(
  req: Request,
  endpointId: string,
  rawParams: Record<string, any>
) {
  const path = MHPL_ENDPOINTS[endpointId];
  if (!path) {
    return NextResponse.json(
      {
        success: false,
        error: `Unknown MHPL endpointId: ${endpointId}`,
      },
      { status: 400 }
    );
  }

  let token: string;
  try {
    token = await getBearerToken();
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to obtain bearer token",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }

  const url = new URL(path.startsWith("/") ? path : `/${path}`, MHPL_BASE_URL);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "MHPL-Proxy/1.0",
  };

  const normalizedParams = normalizeParamsForEndpoint(endpointId, rawParams);
  const paramsWithDefaults = applyEndpointDefaults(endpointId, normalizedParams);

  for (const [key, value] of Object.entries(paramsWithDefaults)) {
    headers[key] = value;
  }

  // Enhanced logging for debugging
  console.log(`[MHPL_PROXY] 📤 REQUEST to ${endpointId}:`, {
    url: url.toString(),
    params: normalizedParams,
    paramsWithDefaults,
    headers: Object.fromEntries(
      Object.entries(headers).map(([k, v]) =>
        k === 'Authorization' ? [k, `Bearer ${v.substring(v.length - 20)}...`] : [k, v]
      )
    )
  });

  let mhplResponse: Response;
  let rawBody: string;
  try {
    mhplResponse = await fetch(url.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    rawBody = await mhplResponse.text();
  } catch (error: any) {
    console.error("[MHPL_PROXY] Network error calling MHPL API:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Network error while calling MHPL API",
        details: error?.message ?? String(error),
      },
      { status: 502 }
    );
  }

  if (!mhplResponse.ok) {
    const status = mhplResponse.status;
    const statusText = mhplResponse.statusText || "Unknown error";

    console.error(`[MHPL_PROXY] ❌ ERROR from ${endpointId}:`, {
      status,
      statusText,
      url: url.toString(),
      params: paramsWithDefaults,
      responseBodyPreview: rawBody.substring(0, 500)
    });

    return NextResponse.json(
      {
        success: false,
        statusFromMHPL: status,
        statusTextFromMHPL: statusText,
        rawBody,
        requestParams: normalizedParams, // Include params in error response for debugging
        requestUrl: url.toString() // Include URL in error response
      },
      { status: status === 401 ? 401 : 502 }
    );
  }

  let data: any = rawBody;
  try {
    if (rawBody.trim().startsWith("{") || rawBody.trim().startsWith("[")) {
      data = JSON.parse(rawBody);
    } else {
      data = { raw: rawBody };
    }
  } catch {
    data = { raw: rawBody };
  }

  return NextResponse.json(
    {
      success: true,
      statusFromMHPL: mhplResponse.status,
      data,
    },
    { status: 200 }
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ endpointId: string }> }
) {
  const { endpointId } = await params;
  const url = new URL(req.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());

  return handleMhplProxyRequest(req, endpointId, rawParams);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ endpointId: string }> }
) {
  const { endpointId } = await params;
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  let bodyParams: Record<string, any> = {};
  try {
    const body = await req.json();
    if (body && typeof body === "object") {
      bodyParams = body as Record<string, any>;
    }
  } catch {
    // No JSON body or invalid JSON; ignore and rely on query params only
  }

  const rawParams = { ...queryParams, ...bodyParams };

  return handleMhplProxyRequest(req, endpointId, rawParams);
}
