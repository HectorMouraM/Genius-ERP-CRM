
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings, LogIn, LayoutDashboard, Target, ShieldCheck, BarChartHorizontalBig } from 'lucide-react'; // Added BarChartHorizontalBig
import { useAuth } from '@/contexts/AuthContext'; // Corrected import path
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

export default function AuthNav() {
  const { user, logout, isLoading } = useAuth();

  // Show loading state while auth context is verifying
  if (isLoading) {
     return (
       <div className="flex items-center space-x-1 sm:space-x-2">
           <Skeleton className="h-8 w-20 rounded-md" />
           <Skeleton className="h-8 w-24 rounded-md" />
           <Skeleton className="h-8 w-8 rounded-full" />
       </div>
     );
  }

  return (
    <>
      {user ? (
        <>
          {/* Links available when logged in */}

          {/* Projetos Link - Visible to Padrão, Gerente, Proprietário */}
          {(user.role === 'Padrão' || user.role === 'Gerente' || user.role === 'Proprietário') && (
            <Button asChild variant="ghost" size="sm">
                <Link href="/">
                  <LayoutDashboard className="mr-1 h-4 w-4" />
                  Projetos
                </Link>
             </Button>
          )}

           {/* CRM Link - Visible to CRM, Gerente, Proprietário */}
           {(user.role === 'CRM' || user.role === 'Gerente' || user.role === 'Proprietário') && (
             <Button asChild variant="ghost" size="sm">
                <Link href="/crm">
                  <Target className="mr-1 h-4 w-4" />
                  CRM
                </Link>
             </Button>
           )}

           {/* Dashboard Link - Visible to Gerente, Proprietário */}
            {(user.role === 'Gerente' || user.role === 'Proprietário') && (
               <Button asChild variant="ghost" size="sm">
                 <Link href="/dashboard">
                   <BarChartHorizontalBig className="mr-1 h-4 w-4" />
                   Dashboard
                 </Link>
               </Button>
            )}

            {/* Settings Link - Visible to Proprietário, Admin */}
             {(user.role === 'Proprietário' || user.role === 'Admin') && (
                 <Button asChild variant="ghost" size="sm">
                    <Link href="/settings">
                      <Settings className="mr-1 h-4 w-4" />
                      Configurações
                    </Link>
                 </Button>
             )}

           {/* Admin Link - Only for Admin role */}
           {user.role === 'Admin' && (
             <Button asChild variant="ghost" size="sm">
               <Link href="/admin">
                 <ShieldCheck className="mr-1 h-4 w-4" />
                 Admin
               </Link>
             </Button>
           )}

          {/* User Info and Logout */}
           <span className="text-sm text-muted-foreground hidden sm:inline-block mx-2">Olá, {user.email} ({user.role})</span>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="mr-1 h-4 w-4" />
            Sair
          </Button>
        </>
      ) : (
        // Link to Login page when logged out
        <Button asChild variant="default" size="sm">
          <Link href="/login">
            <LogIn className="mr-1 h-4 w-4" />
            Login
          </Link>
        </Button>
      )}
    </>
  );
}
