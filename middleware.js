import { NextResponse } from "next/server";

const sessionCookieName = "legertas_crm_session";
const allowedEmail = "droneai@legertas.ai";

function base64urlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));

  return bytesToBase64url(new Uint8Array(signature));
}

async function hasValidSession(request) {
  const secret = process.env.AUTH_SESSION_SECRET;
  const token = request.cookies.get(sessionCookieName)?.value;
  const [payload, signature] = String(token || "").split(".");

  if (!secret || !payload || !signature) return false;

  const expected = await hmac(payload, secret);
  if (expected !== signature) return false;

  try {
    const data = JSON.parse(new TextDecoder().decode(base64urlToBytes(payload)));
    return data.email === allowedEmail && Date.now() <= Number(data.exp || 0);
  } catch {
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && !(await hasValidSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasValidSession(request))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.[^/]+$).*)", "/api/:path*"]
};
