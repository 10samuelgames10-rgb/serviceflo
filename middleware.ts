import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

// Twilio webhooks have no user login; each one checks Twilio's signature instead.
const PUBLIC_PATHS = ["/login", "/auth", "/setup", "/api/twilio"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Twilio webhooks don't have a user session; each route verifies Twilio's signature itself.
  if (path.startsWith("/api/twilio")) return NextResponse.next();
  if (!isConfigured) {
    if (path.startsWith("/setup")) return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
