
'use client';

import CrmDashboard from '@/components/crm/CrmDashboard';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { Loader2 } from 'lucide-react'; // Import Loader

export default function CrmPage() {
  const { user, isLoading, currentEnvironmentDb } = useAuth();

  if (isLoading) {
     return (
       <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }

   // Handle cases where the user shouldn't see the CRM
   if (user?.role === 'Admin') {
       return <div className="p-6 text-center text-muted-foreground">Administradores Globais não possuem um painel de CRM.</div>;
   }
   if (!currentEnvironmentDb) {
        return <div className="p-6 text-center text-destructive">Erro: Ambiente de dados não encontrado para carregar o CRM.</div>;
   }

  // Render the dashboard only if authenticated and environment DB is available
  return <CrmDashboard environmentDb={currentEnvironmentDb} />;
}
