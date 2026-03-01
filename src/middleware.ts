import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Check if the current environment is production AND NOT localhost
    const isProduction = process.env.NODE_ENV === 'production';
    const url = request.nextUrl.clone();

    if (isProduction && request.headers.get('host') !== 'localhost:3000' && !request.headers.get('host')?.startsWith('localhost:')) {
        // Determine target environments (e.g. Vercel) shouldn't allow admin
        url.pathname = '/404'; // Rewrite to a 404 page for admin routes
        return NextResponse.rewrite(url);
    }

    return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
    matcher: [
        '/admin/:path*',
        '/api/admin/:path*'
    ],
};
