import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard', '/budgets', '/goals', '/piggyai'];
const AUTH_PREFIXES = ['/login', '/signup'];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix)
    );
    const isAuthPage = AUTH_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix)
    );
    if (!isProtected && !isAuthPage) return NextResponse.next();

    let response = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                );
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) =>
                    response.cookies.set(name, value, options)
                );
            },
        },
    });

    // getUser() (not getSession()) revalidates the token against Supabase
    // rather than trusting a possibly-stale cookie.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (isProtected && !user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAuthPage && user) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
