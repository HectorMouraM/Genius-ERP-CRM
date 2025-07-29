
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Users, LineChart, Loader2 } from 'lucide-react'; // Added Loader2
import UserManagement from '@/components/admin/UserManagement';
import EnvironmentManagement from '@/components/admin/EnvironmentManagement';
// import DashboardStats from '@/components/admin/DashboardStats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveQuery } from 'dexie-react-hooks';
import { mainDb, type Environment, type User } from '@/db/db'; // Import from MainDB
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth to check role
import { useRouter } from 'next/navigation'; // Import useRouter for redirection
import { useEffect } from "react";


export default function AdminPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    // Fetch environments from MainDB
    const environments = useLiveQuery(() => mainDb.environments.orderBy('name').toArray());
    // No need to fetch users here if UserManagement handles it

     // Redirect if not admin or still loading authentication
     useEffect(() => {
        console.log("[AdminPage] useEffect triggered. isLoading:", isLoading, "User Role:", user?.role);
        if (!isLoading && user?.role !== 'Admin') {
            console.log("[AdminPage] User not admin or not loaded, redirecting to / ...");
            router.replace('/'); // Redirect to home if not admin
        } else if (!isLoading && user?.role === 'Admin') {
            console.log("[AdminPage] User is Admin, allowing access.");
        } else if (isLoading) {
             console.log("[AdminPage] Still loading auth data...");
        }
     }, [user, isLoading, router]);

      // Render loading state or null while checking auth
      if (isLoading) {
        console.log("[AdminPage] Rendering loading state...");
        return (
             <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
                 <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Verificando permissões...
            </div>
        );
      }

       // Explicitly check after loading if user is still not admin
       if (user?.role !== 'Admin') {
          console.log("[AdminPage] Rendering null because user is not Admin after loading.");
          // Don't render the admin content if the user isn't an admin.
          // The useEffect should have already initiated the redirect.
          // Rendering null or a placeholder prevents flickering the admin page content briefly.
          return null;
       }


  console.log("[AdminPage] Rendering Admin Content.");
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Painel Administrativo Global</h1>
        <p className="text-muted-foreground">Gerencie usuários, ambientes e configurações do sistema.</p>
      </header>

      <Tabs defaultValue="environments" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="dashboard" disabled>
            <LineChart className="mr-2 h-4 w-4" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="environments">
             <Building className="mr-2 h-4 w-4" /> Ambientes (Empresas)
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" /> Usuários (Global)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <Card>
            <CardHeader>
              <CardTitle>Visão Geral do Sistema</CardTitle>
              <CardDescription>Estatísticas globais (em desenvolvimento).</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Gráficos e KPIs sobre uso do sistema serão exibidos aqui.</p>
              {/* Placeholder for DashboardStats component */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="environments">
           {/* Pass environments fetched from MainDB */}
           <EnvironmentManagement environments={environments ?? []} />
        </TabsContent>

        <TabsContent value="users">
           {/* UserManagement now fetches users directly from MainDB */}
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
