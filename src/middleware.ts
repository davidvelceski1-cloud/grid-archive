import { NextResponse, type NextRequest } from "next/server";

/** HTTP Basic auth for /admin (user "admin", password from ADMIN_PASSWORD). Server actions post to the same paths. */
export function middleware(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new NextResponse("Admin is disabled: set ADMIN_PASSWORD.", { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, pass] = atob(encoded).split(":");
    if (user === "admin" && pass === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="GRID ARCHIVE admin"' } });
}

export const config = { matcher: ["/admin/:path*"] };
