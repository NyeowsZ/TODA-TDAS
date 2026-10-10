import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session - IMPORTANT: don't remove this
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require auth
  const publicPaths = ["/login", "/"];
  const isPublicPath = publicPaths.some(
    (path) => request.nextUrl.pathname === path
  );

  if (!user && !isPublicPath) {
    // Not authenticated and trying to access protected route
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isPublicPath) {
    // Authenticated user - enforce role-based route access
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.is_active) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    const pathname = request.nextUrl.pathname;

    // Controller route protection
    if (pathname.startsWith("/controller")) {
      if (profile.role !== "controller") {
        const url = request.nextUrl.clone();
        url.pathname =
          profile.role === "controller" ? "/controller" : "/official/audit";
        return NextResponse.redirect(url);
      }
    }

    // Official/admin route protection
    if (pathname.startsWith("/official")) {
      const officialRoles = [
        "official",
        "auditor",
        "secretary",
        "chairman",
      ];
      if (!officialRoles.includes(profile.role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/controller";
        return NextResponse.redirect(url);
      }

      // Settings page - chairman only
      if (pathname.startsWith("/official/settings")) {
        if (
          profile.role !== "chairman" &&
          profile.role !== "secretary"
        ) {
          const url = request.nextUrl.clone();
          url.pathname = "/official/audit";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // If authenticated user visits login, redirect to their dashboard
  if (user && request.nextUrl.pathname === "/login") {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile) {
      const url = request.nextUrl.clone();
      url.pathname =
        profile.role === "controller" ? "/controller" : "/official/audit";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
