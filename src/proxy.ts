import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, isSecureCookie, verifySessionJwt } from '@/backend/core/session';

/**
 * Request proxy (Next.js 16 replacement for middleware). Runs before every route and:
 *  1. rejects cross-origin state-changing API requests (CSRF defence in depth on top of SameSite=Lax),
 *  2. redirects unauthenticated page requests to /login (API routes enforce their own auth),
 *  3. applies security headers.
 *
 * The session check here only verifies the JWT signature/expiry. Role, active status and
 * password-change revocation are enforced per request by getCurrentUser() in the API layer.
 */

const PUBLIC_PAGE_PATHS = new Set(['/login', '/workspace-unavailable', '/tv-board', '/offline.html']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Server-to-server endpoints authenticated by shared secret rather than a browser session.
const CSRF_EXEMPT_API_PREFIXES = ['/api/cron/'];

function isDev() {
  return process.env.NODE_ENV === 'development';
}

function allowedOrigins(req: NextRequest): Set<string> {
  const origins = new Set<string>([req.nextUrl.origin]);
  const host = req.headers.get('host');
  if (host) {
    origins.add(`http://${host}`);
    origins.add(`https://${host}`);
  }
  if (process.env.TRUST_PROXY === 'true') {
    const forwardedHost = req.headers.get('x-forwarded-host');
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
    if (forwardedHost) origins.add(`${forwardedProto}://${forwardedHost}`);
  }
  for (const value of [process.env.APP_URL, ...(process.env.ALLOWED_ORIGINS || '').split(',')]) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    try {
      origins.add(new URL(trimmed).origin);
    } catch {
      // ignore malformed configuration entries
    }
  }
  return origins;
}

function isCrossSiteMutation(req: NextRequest): boolean {
  if (SAFE_METHODS.has(req.method)) return false;
  const { pathname } = req.nextUrl;
  if (CSRF_EXEMPT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;

  const origin = req.headers.get('origin');
  if (origin) return !allowedOrigins(req).has(origin);

  // Browsers always send Sec-Fetch-Site on fetch(); absent Origin + cross-site means a forged request.
  const fetchSite = req.headers.get('sec-fetch-site');
  return fetchSite === 'cross-site';
}

function contentSecurityPolicy(): string {
  const dev = isDev();
  // Next.js injects inline bootstrap scripts into statically rendered pages, so scripts need
  // 'unsafe-inline' unless every page is rendered dynamically with a per-request nonce.
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  if (isSecureCookie()) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('Content-Security-Policy', contentSecurityPolicy());
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (isSecureCookie()) {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (isCrossSiteMutation(req)) {
      return applySecurityHeaders(NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 }));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  if (!PUBLIC_PAGE_PATHS.has(pathname)) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await verifySessionJwt(token) : null;
    if (!session) {
      // Sign-in always lands on the user's role home, so no return path is carried.
      const redirect = NextResponse.redirect(new URL('/login', req.url));
      if (token) redirect.cookies.delete(SESSION_COOKIE_NAME);
      return applySecurityHeaders(redirect);
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    // Everything except Next.js internals (build assets, image optimizer, dev HMR socket)
    // and static public files.
    '/((?!_next/|__nextjs|favicon.ico|sw.js|manifest.webmanifest|images/).*)',
  ],
};
