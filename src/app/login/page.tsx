
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { mainDb, type User, type UserRole } from '@/db/db'; // Import mainDb and UserRole
import Cookies from 'js-cookie'; // Import js-cookie
import { SignJWT } from 'jose'; // Import jose for JWT generation
import { BriefcaseBusiness, Loader2 } from 'lucide-react'; // Import icons
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth to trigger refresh

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

// **SECURITY WARNING:** In a real application, NEVER store secrets directly in the frontend code.
// Use environment variables managed securely.
const JWT_SECRET = process.env.NEXT_PUBLIC_JWT_SECRET || 'your-fallback-secret-key-32-bytes-long'; // Use NEXT_PUBLIC_ prefix for client-side env var access or get from backend
const SECRET_KEY_BYTES = new TextEncoder().encode(JWT_SECRET);

// Hardcoded Admin credentials for direct check
const ADMIN_EMAIL = 'hectormouram@gmail.com';
const ADMIN_PASSWORD = 'Hec965tor!'; // **WARNING: Use hashing in production**


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { refreshAuthStatus } = useAuth(); // Get refresh function

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    console.log("[LoginPage] handleLogin started.");
    setIsLoading(true);
    try {
      let user: Omit<User, 'passwordHash'> | null = null; // Store user data without password hash
      let userRole: UserRole = 'Padrão'; // Default role
      let userId: number | undefined = undefined;
      let environmentId: number | undefined = undefined;

      // Add logging before the check
      console.log(`[LoginPage] Login attempt: Email='${data.email}', Password Provided='${data.password ? 'Yes' : 'No'}'`);
      console.log(`[LoginPage] Admin Email Check: Comparing '${data.email.toLowerCase()}' with '${ADMIN_EMAIL.toLowerCase()}'`);


      // --- Priority Check for Admin User ---
      if (data.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          console.log('[LoginPage] Potential Admin login attempt.');
          if (data.password === ADMIN_PASSWORD) {
              console.log('[LoginPage] Admin password matches.');
              // Check if admin exists in DB (should have been populated)
               console.log('[LoginPage] Checking MainDB for admin record...');
              const dbAdmin = await mainDb.users.where('email').equalsIgnoreCase(ADMIN_EMAIL).first();
               console.log('[LoginPage] MainDB admin check result:', dbAdmin);
              if (dbAdmin && dbAdmin.role === 'Admin') {
                   console.log('[LoginPage] Admin record found in DB with correct role.');
                  user = {
                      name: dbAdmin.name,
                      email: dbAdmin.email,
                      role: 'Admin', // Explicitly set role
                      status: dbAdmin.status,
                      createdAt: dbAdmin.createdAt,
                      // environmentId is undefined for global admin
                  };
                  userRole = 'Admin';
                  userId = dbAdmin.id; // Use actual ID from DB
                  environmentId = undefined; // No environment for global admin
                  console.log(`[LoginPage] Admin authenticated: UserID=${userId}, Role=${userRole}, EnvID=${environmentId}`);
               } else {
                   // Admin credentials match but DB record not found/incorrect role - should not happen if populate works
                   console.error(`[LoginPage] Admin login failed: Admin user record not found or role mismatch in MainDB for ${ADMIN_EMAIL}`);
                   toast({ title: 'Erro de Login', description: 'Falha na configuração do Admin. Contate o suporte.', variant: 'destructive' });
                   setIsLoading(false);
                   return; // Stops execution
               }
          } else {
                // Email matches admin, but password doesn't
                console.log('[LoginPage] Admin login failed: Incorrect password.');
                toast({ title: 'Erro de Login', description: 'Senha incorreta para Admin.', variant: 'destructive' });
                setIsLoading(false);
                return; // Stops execution
          }
      } else {
        // --- Check Database for Regular Users ---
        console.log('[LoginPage] Email did not match admin. Checking DB for regular user.');
        const dbUser = await mainDb.users.where('email').equalsIgnoreCase(data.email).first();
        console.log('[LoginPage] DB User Check Result:', dbUser); // Log DB result

        if (!dbUser) {
           console.log(`[LoginPage] DB check failed: No user found for email '${data.email}'`);
          toast({ title: 'Erro de Login', description: 'Usuário não encontrado.', variant: 'destructive' });
          setIsLoading(false);
          return; // Stops execution
        }

        // **SECURITY WARNING:** Comparing plaintext passwords. Implement hashing (e.g., bcrypt) in a real app.
         console.log(`[LoginPage] Comparing provided password with stored hash for user ${data.email}...`);
        if (dbUser.passwordHash !== data.password) {
          console.log(`[LoginPage] DB check failed: Incorrect password for user '${data.email}'`);
          toast({ title: 'Erro de Login', description: 'Senha incorreta.', variant: 'destructive' });
          setIsLoading(false);
          return;
        }

         if (dbUser.status === 'Inativo') {
            console.log(`[LoginPage] DB check failed: User '${data.email}' is inactive.`);
            toast({ title: 'Acesso Negado', description: 'Sua conta está inativa.', variant: 'destructive' });
            setIsLoading(false);
            return;
         }

         // If DB user found and password matches
         console.log(`[LoginPage] DB User login successful for: ${data.email}`);
         user = {
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
            status: dbUser.status,
            environmentId: dbUser.environmentId,
            createdAt: dbUser.createdAt,
         };
         userRole = dbUser.role;
         userId = dbUser.id; // Use the actual ID from the database
         environmentId = dbUser.environmentId;
         console.log(`[LoginPage] User authenticated: UserID=${userId}, Role=${userRole}, EnvID=${environmentId}`);

          // Ensure non-admin users have an environment ID
         if (!environmentId) {
              console.error(`[LoginPage] Login failed: User ${data.email} (Role: ${userRole}) has no associated environment ID.`);
              toast({ title: 'Erro de Configuração', description: 'Usuário sem ambiente associado. Contate o suporte.', variant: 'destructive' });
              setIsLoading(false);
              return;
          }

      }

      // --- Proceed if user is authenticated (either admin or from DB) ---
      if (user && userId !== undefined) {
         console.log(`[LoginPage] User authenticated proceeding to JWT generation: ${user.name}, Role: ${userRole}, UserID: ${userId}, EnvID: ${environmentId}`);
        // --- JWT Generation ---
        const expirationTime = data.rememberMe ? '30d' : '1h'; // 30 days if remember me, else 1 hour
        console.log(`[LoginPage] Generating JWT with expiration: ${expirationTime}`);
        const token = await new SignJWT({
          userId: userId, // Use the determined user ID (from DB for admin or user)
          email: user.email,
          role: userRole, // Use the determined role
          environmentId: environmentId, // Include environmentId (will be undefined for admin)
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime(expirationTime)
          .sign(SECRET_KEY_BYTES);

        console.log("[LoginPage] JWT generated successfully.");

        // --- Store token in cookie ---
        Cookies.set('auth_token', token, {
          expires: data.rememberMe ? 30 : undefined, // Cookie expiry in days or session
          path: '/',
          // secure: process.env.NODE_ENV === 'production', // Uncomment in production with HTTPS
          // sameSite: 'strict',
        });
        console.log("[LoginPage] Auth token stored in cookie.");

        toast({ title: 'Login Bem-sucedido', description: `Bem-vindo, ${user.name}!` });

         // Refresh auth context BEFORE redirecting
         console.log("[LoginPage] Refreshing auth status...");
         await refreshAuthStatus();
         console.log("[LoginPage] Auth status refreshed.");

        // Redirect based on role
        if (userRole === 'Admin') {
          console.log('[LoginPage] Redirecting Admin to /admin');
          router.push('/admin');
        } else {
          console.log('[LoginPage] Redirecting non-admin user to /');
          router.push('/'); // Redirect regular users to the main dashboard
        }
        // Don't set isLoading to false here if redirecting successfully
        console.log("[LoginPage] Redirect initiated.");
        return; // Ensure no further code in this function executes after redirection starts
      } else {
         // This case should not be reached if the logic above is correct,
         // but added as a safeguard. Handles cases where user check failed unexpectedly.
         console.log('[LoginPage] Authentication failed unexpectedly after checks.');
         toast({ title: 'Erro de Login', description: 'Falha ao verificar usuário.', variant: 'destructive' });
         setIsLoading(false);
      }


    } catch (error) {
      console.error('[LoginPage] Login process failed with error:', error);
      toast({ title: 'Erro de Login', description: 'Ocorreu um erro inesperado.', variant: 'destructive' });
      setIsLoading(false);
    }
    // Set isLoading to false only if an error occurred and we didn't return early
    console.log("[LoginPage] handleLogin finished (error path).");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center gap-2">
             <BriefcaseBusiness className="h-7 w-7 text-primary" />
             <span className="text-xl font-bold">Genius ERP+CRM</span>
          </div>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Acesse sua conta para gerenciar seus projetos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="seu@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Lembrar de mim
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </Form>
        </CardContent>
        {/* Optional Footer */}
        {/* <CardFooter className="text-center text-xs text-muted-foreground">
           Esqueceu sua senha?
        </CardFooter> */}
      </Card>
    </div>
  );
}
