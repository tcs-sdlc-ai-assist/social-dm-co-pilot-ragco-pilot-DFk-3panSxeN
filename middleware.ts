import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Next.js middleware for route protection using NextAuth.
 *
 * Protects:
 * - All /api/* routes (except /api/auth/* and /api/health)
 * - All page routes (except /auth/*)
 *
 * Unauthenticated requests to protected API routes receive a 401 JSON response.
 * Unauthenticated requests to protected page routes are redirected to /auth/signin.
 *
 * In development mode (when NEXTAUTH_SECRET is the dev default or Azure AD is not
 * configured), authentication checks are bypassed to allow local development
 * without Azure AD credentials.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Public Routes (always allowed) ──────────────────────────────────

  // Allow NextAuth routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow health check endpoint
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  // Allow auth pages (signin, error, etc.)
  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // ─── Development Mode Bypass ─────────────────────────────────────────

  // In development, bypass auth if Azure AD is not configured
  // This allows local development without Azure AD credentials
  const isDevelopment = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  const isAzureADConfigured = Boolean(
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
  );

  if (isDevelopment && !isAzureADConfigured) {
    return NextResponse.next();
  }

  // ─── Authentication Check ────────────────────────────────────────────

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = token !== null;

  // ─── Protected API Routes ────────────────────────────────────────────

  if (pathname.startsWith("/api/")) {
    if (!isAuthenticated) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Authentication required. Please sign in to access this resource.",
          statusCode: 401,
        },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // ─── Protected Page Routes ───────────────────────────────────────────

  if (!isAuthenticated) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

/**
 * Matcher configuration for the middleware.
 *
 * Matches all routes except:
 * - _next/static (static files)
 * - _next/image (image optimization files)
 * - favicon.ico (favicon file)
 * - Public assets with file extensions
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};