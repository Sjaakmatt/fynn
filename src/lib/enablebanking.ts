import * as jose from "jose";

const APP_ID = process.env.ENABLE_BANKING_APP_ID!;
const PRIVATE_KEY_PEM = process.env.ENABLE_BANKING_PRIVATE_KEY!;
const BASE_URL =
  process.env.ENABLE_BANKING_API_URL ?? "https://api.enablebanking.com";

if (!APP_ID) throw new Error("Missing ENABLE_BANKING_APP_ID");
if (!PRIVATE_KEY_PEM) throw new Error("Missing ENABLE_BANKING_PRIVATE_KEY");

async function getPrivateKey() {
  // PKCS8 PEM key
  return jose.importPKCS8(PRIVATE_KEY_PEM, "RS256");
}

export async function makeJWT() {
  const privateKey = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  return new jose.SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: APP_ID })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setIssuer("enablebanking.com")
    .setAudience("api.enablebanking.com")
    .sign(privateKey);
}

type HeaderValue = string | number | boolean | null | undefined;
type HeadersLike = Record<string, HeaderValue>;

function normalizeHeaders(input?: HeadersInit): Record<string, string> {
  if (!input) return {};
  if (input instanceof Headers) {
    const out: Record<string, string> = {};
    input.forEach((v, k) => (out[k] = v));
    return out;
  }
  if (Array.isArray(input)) {
    return Object.fromEntries(input.map(([k, v]) => [k, v]));
  }
  // object
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = String(v);
  }
  return out;
}

function mergeHeaders(base: Record<string, string>, extra?: HeadersInit) {
  return { ...base, ...normalizeHeaders(extra) };
}

/**
 * Enable Banking fetch helper.
 *
 * - Adds Bearer JWT
 * - Only sets Content-Type when a body is present (prevents weirdness on GET)
 * - Returns JSON by default; can return text/empty if the response isn't JSON
 */
export async function ebFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const jwt = await makeJWT();

  const method = (options.method ?? "GET").toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null;

  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${jwt}`,
    Accept: "application/json",
    "Accept-Encoding": "identity",  // ← geen gzip
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
  }

  const headers = mergeHeaders(baseHeaders, options.headers);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    method,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Enable Banking API error ${res.status}: ${text || res.statusText}`)
  }

  if (res.status === 204) return undefined as unknown as T

  // Handmatig decomprimeren als gzip
  const encoding = res.headers.get("content-encoding") ?? ""
  let body: string

  if (encoding.includes("gzip") || encoding.includes("deflate") || encoding.includes("br")) {
    const buffer = await res.arrayBuffer()
    const { gunzipSync, inflateSync, brotliDecompressSync } = await import("zlib")
    const buf = Buffer.from(buffer)
    try {
      body = (encoding.includes("br") ? brotliDecompressSync(buf) : 
               encoding.includes("deflate") ? inflateSync(buf) : 
               gunzipSync(buf)).toString("utf-8")
    } catch {
      body = await res.text()
    }
  } else {
    body = await res.text()
  }

  try {
    return JSON.parse(body) as T
  } catch {
    return body as unknown as T
  }
}