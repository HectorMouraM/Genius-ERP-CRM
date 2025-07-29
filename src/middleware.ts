
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose'; // Using 'jose' for JWT verification

// **SECURITY WARNING:** Use environment variables for secrets in production.
const JWT_SECRET = process.env.NEXT_PUBLIC_JWT_SECRET || 'your-fallback-secret-key-32-bytes-long'; // Must match login page
const SECRET_KEY_BYTES = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;
const AUTH_COOKIE_NAME = 'auth_token';


// Define User Role type matching db.ts
type UserRole = 'Padrão' | 'Gerente' | 'Proprietário' | 'Admin' | 'CRM'; // Added CRM role

interface VerifiedPayload {
    userId: number;
    email: string;
    role: UserRole;
    environmentId?: number;
    exp?: number;
    iat?: number;
}


export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;

  // Allow access to login page always
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Redirect to login if no token and trying to access protected routes
  if (!token) {
    // console.log('Middleware: No token found, redirecting to login.');
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token if it exists
  if (!SECRET_KEY_BYTES) {
      console.error('JWT_SECRET is not defined!');
      // Handle missing secret error - maybe redirect to an error page or login
      const loginUrl = new URL('/login?error=config_error', request.url);
      return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY_BYTES) as { payload: VerifiedPayload };
    // console.log('Middleware: Token verified, payload:', payload);
    const userRole = payload.role;

    // --- Route Protection Logic ---

    // If user is logged in and tries to access /login, redirect them to dashboard
    // (Handled implicitly by middleware structure now, but good to keep in mind)

    // Protect /admin route: only allow 'Admin' role
    if (pathname.startsWith('/admin') && userRole !== 'Admin') {
        // console.log(`Middleware: Access denied to /admin for role: ${userRole}`);
        // Redirect non-admins trying to access /admin to the main dashboard
        const dashboardUrl = new URL('/', request.url);
        return NextResponse.redirect(dashboardUrl);
    }

     // Protect /crm route: allow 'CRM', 'Gerente', 'Proprietário', 'Admin'
     if (pathname.startsWith('/crm') && !['CRM', 'Gerente', 'Proprietário', 'Admin'].includes(userRole)) {
         console.log(`Middleware: Access denied to /crm for role: ${userRole}`);
         const dashboardUrl = new URL('/', request.url);
         return NextResponse.redirect(dashboardUrl);
     }

     // Protect /dashboard route: allow 'Gerente', 'Proprietário', 'Admin'
     if (pathname.startsWith('/dashboard') && !['Gerente', 'Proprietário', 'Admin'].includes(userRole)) {
         console.log(`Middleware: Access denied to /dashboard for role: ${userRole}`);
         const dashboardUrl = new URL('/', request.url);
         return NextResponse.redirect(dashboardUrl);
     }

     // Protect /settings route: allow 'Proprietário', 'Admin'
     if (pathname.startsWith('/settings') && !['Proprietário', 'Admin'].includes(userRole)) {
          console.log(`Middleware: Access denied to /settings for role: ${userRole}`);
          const dashboardUrl = new URL('/', request.url);
          return NextResponse.redirect(dashboardUrl);
     }

     // Protect / route (projetos): allow 'Padrão', 'Gerente', 'Proprietário', 'Admin' (but redirect Admin later if needed)
     if (pathname === '/' && !['Padrão', 'Gerente', 'Proprietário', 'Admin'].includes(userRole)) {
          console.log(`Middleware: Access denied to / (Projetos) for role: ${userRole}`);
          // Redirect CRM users to CRM if they land on home
          if (userRole === 'CRM') {
               const crmUrl = new URL('/crm', request.url);
               return NextResponse.redirect(crmUrl);
          }
           // Redirect others to login? Or show an error page? For now, redirect to login.
          const loginUrl = new URL('/login', request.url);
          const response = NextResponse.redirect(loginUrl);
          response.cookies.delete(AUTH_COOKIE_NAME); // Clear token if access denied
          return response;
     }
      // Protect /project/[projectId] route: allow 'Padrão', 'Gerente', 'Proprietário', 'Admin'
      if (pathname.startsWith('/project/') && !['Padrão', 'Gerente', 'Proprietário', 'Admin'].includes(userRole)) {
         console.log(`Middleware: Access denied to /project/[id] for role: ${userRole}`);
         const dashboardUrl = new URL('/', request.url);
         return NextResponse.redirect(dashboardUrl);
     }



    // Allow access to other routes for logged-in users (e.g., API routes if not excluded by matcher)
    // console.log(`Middleware: Access granted to ${pathname} for role: ${userRole}`);
    return NextResponse.next();

  } catch (error) {
    // Token verification failed (invalid or expired)
    console.error('Middleware: Token verification failed:', error);
    const loginUrl = new URL('/login', request.url);
    // Clear the invalid cookie before redirecting
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }
}

// Define paths to run the middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (public images folder if you have one)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
  ],
};
