import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: Do NOT run code between createServerClient and supabase.auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/auth');

  const isMfaRoute = pathname.startsWith('/mfa');
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/health') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico');

  // If unauthenticated and accessing protected route
  if (!user && !isAuthRoute && !isPublicRoute && !isMfaRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // If authenticated and accessing login/forgot-password, redirect to app
  if (
    user &&
    isAuthRoute &&
    !pathname.startsWith('/auth/callback') &&
    !pathname.startsWith('/reset-password')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/users';
    return NextResponse.redirect(url);
  }

  // Check if authenticated user is deactivated
  if (user && !isAuthRoute && !isPublicRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .single();

    if (profile && !profile.is_active) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'account_deactivated');
      return NextResponse.redirect(url);
    }
  }

  // Check MFA status if user is authenticated
  if (user && !isMfaRoute && !isAuthRoute && !isPublicRoute) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData) {
      const { currentLevel, nextLevel } = aalData;
      // If user has a verified factor registered (nextLevel === 'aal2') but current session is aal1,
      // require MFA challenge
      if (nextLevel === 'aal2' && currentLevel !== 'aal2') {
        const url = request.nextUrl.clone();
        url.pathname = '/mfa/verify';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
