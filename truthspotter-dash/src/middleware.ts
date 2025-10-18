import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Example: simple rate-limit placeholder using a header flag (extend with real store if needed)
export function middleware(req: NextRequest) {
  // Add a simple header for observability
  const res = NextResponse.next();
  res.headers.set("x-api-version", "v1");
  return res;
}

export const config = {
  matcher: ["/api/:path*"]
};
