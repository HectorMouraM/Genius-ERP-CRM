
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import { jwtVerify, type JWTPayload } from 'jose';
import { mainDb, getEnvironmentDB, type User, type UserRole, type EnvironmentDB } from '@/db/db'; // Import mainDb, getEnvironmentDB, UserRole, EnvironmentDB
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// **SECURITY WARNING:** Fetch this from backend if possible.
const JWT_SECRET = process.env.NEXT_PUBLIC_JWT_SECRET || 'your-fallback-secret-key-32-bytes-long';
const SECRET_KEY_BYTES = new TextEncoder().encode(JWT_SECRET);
const AUTH_COOKIE_NAME = 'auth_token';

// Define user type based on JWT payload (matches User in MainDB, excluding passwordHash)
interface AuthenticatedUser extends JWTPayload {
  userId: number;
  email: string;
  role: UserRole;
  environmentId?: number; // Optional: Only present for non-Admin users
}

interface AuthContextType {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  logout: () => void;
  currentEnvironmentDb: EnvironmentDB | null; // Add instance of the current user's DB
  refreshAuthStatus: () => Promise<void>; // Add function to manually refresh auth state
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentEnvironmentDb, setCurrentEnvironmentDb] = useState<EnvironmentDB | null>(null); // State for the environment DB
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

   // Define logout first so it can be used in useCallback's dependencies
   const logout = useCallback(() => {
    console.log("[AuthProvider] logout called.");
    setUser(null);
    setCurrentEnvironmentDb(null); // Clear environment DB on logout
    Cookies.remove(AUTH_COOKIE_NAME);
    router.push('/login'); // Use push for logout navigation
    // Avoid toast on initial load logout scenarios
    // toast({ title: "Logout", description: "Você saiu do sistema." });
  }, [router]);


  const verifyTokenAndSetUser = useCallback(async () => {
      // console.log("[AuthProvider] verifyTokenAndSetUser called. Current isLoading:", isLoading);
      // Only set loading to true if it's not already true (prevents flicker on HMR)
      // setIsLoading(true); // Setting true here might cause issues if called rapidly. Let's manage it more carefully.
      let shouldStopLoading = true; // Flag to ensure loading stops
      setCurrentEnvironmentDb(null); // Reset environment DB on verification start
      const token = Cookies.get(AUTH_COOKIE_NAME);
      console.log("[AuthProvider] Checking token...", token ? "Token found" : "No token");

      if (token && SECRET_KEY_BYTES) {
        try {
            const { payload } = await jwtVerify(token, SECRET_KEY_BYTES) as { payload: AuthenticatedUser };
             console.log("[AuthProvider] Token verified. Payload:", payload);

             setUser(payload);

            // Handle environment DB based on role and environmentId
            if (payload.environmentId) {
                console.log(`[AuthProvider] User has environmentId: ${payload.environmentId}. Fetching DB...`);
                try {
                    const envDb = await getEnvironmentDB(payload.environmentId);
                    setCurrentEnvironmentDb(envDb);
                    console.log(`[AuthProvider] Environment DB instance set for ${envDb.name}`);
                } catch (dbError) {
                    console.error("[AuthProvider] Failed to get environment DB:", dbError);
                    toast({ title: "Erro de Ambiente", description: "Não foi possível carregar os dados do seu ambiente.", variant: "destructive"});
                    logout(); // Log out if environment DB fails
                    shouldStopLoading = false; // Logout handles redirect, loading will reset on next page load
                    return; // Exit early
                }
            } else if (payload.role !== 'Admin') {
                 // Non-admin user without environmentId - ERROR state
                 console.error(`[AuthProvider] Invalid State: User ${payload.email} (Role: ${payload.role}) has no environmentId.`);
                 toast({ title: "Erro de Configuração", description: "Usuário inválido. Contate o administrador.", variant: "destructive"});
                 logout(); // Log out invalid user
                 shouldStopLoading = false; // Logout handles redirect
                 return; // Exit early
            } else {
                 // Admin user with no environmentId - CORRECT state
                 console.log("[AuthProvider] User is Admin, no environment DB needed in context.");
                 setCurrentEnvironmentDb(null); // Explicitly set to null for admin
            }
            console.log("[AuthProvider] User and DB context set successfully.");

        } catch (error) {
            console.error("[AuthProvider] Token verification failed or other error.", error);
            setUser(null);
            setCurrentEnvironmentDb(null); // Clear DB on error
            Cookies.remove(AUTH_COOKIE_NAME);
             if (pathname !== '/login') {
                 console.log("[AuthProvider] Redirecting to /login due to token verification error.");
                // router.replace('/login'); // Use replace for errors to avoid bad history
                // Let logout handle redirect
                logout();
                shouldStopLoading = false; // Logout handles redirect
             }
        }
      } else {
         console.log("[AuthProvider] No token found.");
         setUser(null);
         setCurrentEnvironmentDb(null); // Clear DB if no token
          if (pathname !== '/login') {
             console.log("[AuthProvider] Redirecting to /login because no token.");
             // router.replace('/login');
             // Let logout handle redirect
             logout();
             shouldStopLoading = false; // Logout handles redirect
         }
      }

      // Stop loading if no early exit occurred
      if (shouldStopLoading) {
          console.log("[AuthProvider] Setting isLoading to false.");
          setIsLoading(false);
      } else {
           console.log("[AuthProvider] Skipping setIsLoading(false) due to early exit (logout/redirect).");
      }

  }, [pathname, toast, logout]); // Removed router, added logout

   // Expose refresh function
   const refreshAuthStatus = useCallback(async () => {
        console.log("[AuthProvider] refreshAuthStatus called.");
        setIsLoading(true); // Explicitly set loading true before refresh
       await verifyTokenAndSetUser();
   }, [verifyTokenAndSetUser]);


  useEffect(() => {
     console.log("[AuthProvider] Initial effect running verifyTokenAndSetUser.");
    verifyTokenAndSetUser();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Provide a loading indicator while verifying token, except on login page
  if (isLoading && pathname !== '/login') {
     console.log("[AuthProvider] Rendering loading indicator.");
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Verificando acesso...
        </div>
    );
  }

  // console.log("[AuthProvider] Rendering children. isLoading:", isLoading, "User:", user);
  return (
    <AuthContext.Provider value={{ user, isLoading, logout, currentEnvironmentDb, refreshAuthStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
