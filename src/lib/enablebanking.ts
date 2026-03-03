import * as jose from "jose";

const APP_ID = process.env.ENABLE_BANKING_APP_ID!;
const PRIVATE_KEY_PEM = process.env.ENABLE_BANKING_PRIVATE_KEY!;
const BASE_URL =
  process.env.ENABLE_BANKING_API_URL ?? "https://api.enablebanking.com";

if (!APP_ID) throw new Error("Missing ENABLE_BANKING_APP_ID");
if (!PRIVATE_KEY_PEM) throw new Error("Missing ENABLE_BANKING_PRIVATE_KEY");

async function getPrivateKey() {
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
 * - Only sets Content-Type when a body is present
 * - Lets Node/undici handle decompression automatically
 * - Structured logging for debugging EB integration issues
 */
export async function ebFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const jwt = await makeJWT();
  const method = (options.method ?? "GET").toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null;
  const requestId = Math.random().toString(36).slice(2, 8);
  const startTime = Date.now();

  console.log(`[EB ${requestId}] → ${method} ${path}`);

  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${jwt}`,
    Accept: "application/json",
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
  };

  const headers = mergeHeaders(baseHeaders, options.headers);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      method,
      headers,
    });
  } catch (err: any) {
    console.error(`[EB ${requestId}] ✗ Network error after ${Date.now() - startTime}ms:`, err.message);
    throw new Error(`Enable Banking network error on ${method} ${path}: ${err.message}`);
  }

  const duration = Date.now() - startTime;
  const contentType = res.headers.get("content-type") ?? "unknown";
  const contentEncoding = res.headers.get("content-encoding") ?? "none";
  const contentLength = res.headers.get("content-length") ?? "unknown";

  console.log(
    `[EB ${requestId}] ← ${res.status} ${res.statusText} | ${duration}ms | type=${contentType} | encoding=${contentEncoding} | length=${contentLength}`
  );

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.error(
      `[EB ${requestId}] ✗ API error ${res.status}:`,
      errorBody.slice(0, 500)
    );
    throw new Error(
      `Enable Banking API error ${res.status}: ${errorBody || res.statusText}`
    );
  }

  if (res.status === 204) {
    console.log(`[EB ${requestId}] ✓ 204 No Content`);
    return undefined as unknown as T;
  }

  const text = await res.text();

  console.log(
    `[EB ${requestId}] ✓ Body received: ${text.length} chars`
  );

  try {
    const parsed = JSON.parse(text) as T;

    // Log nuttige metadata als het een transactions response is
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, any>;
      if (Array.isArray(obj.transactions)) {
        console.log(
          `[EB ${requestId}] → ${obj.transactions.length} transactions | continuation_key=${obj.continuation_key ? "present" : "null"}`
        );
      }
    }

    return parsed;
  } catch {
    console.error(
      `[EB ${requestId}] ✗ JSON parse failed | content-type=${contentType} | first 300 chars:`,
      text.slice(0, 300)
    );
    console.error(
      `[EB ${requestId}] ✗ First 20 char codes:`,
      [...text.slice(0, 20)].map((c) => c.charCodeAt(0))
    );
    return text as unknown as T;
  }
}