
"use client";

import { Cog, Loader2, Shield } from 'lucide-react'; // Added Loader2 and Shield
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GeneralSettings from '@/components/settings/GeneralSettings';
import RateSettings from '@/components/settings/RateSettings';
import StageTemplateManagement from '@/components/settings/StageTemplateManagement';
import DataManagement from '@/components/settings/DataManagement';
import CrmSettings from '@/components/crm/CrmSettings';
import PasswordChangeForm from '@/components/settings/PasswordChangeForm'; // Import the new component
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

export default function SettingsPage() {
     const { user, isLoading: isAuthLoading, currentEnvironmentDb } = useAuth(); // Get context
     const [isMounted, setIsMounted] = useState(false);

     useEffect(() => { setIsMounted(true); }, []);

     // Combined loading state
     const isLoading = !isMounted || isAuthLoading;

      if (isLoading) {
        return (
             <div className="container mx-auto p-6 text-center flex justify-center items-center gap-2">
                 <Loader2 className="h-5 w-5 animate-spin text-primary" /> Carregando configurações...
             </div>
         );
      }

     // Admins have no environment-specific settings here, but can change their own password
     if (user?.role === 'Admin') {
         return (
             <div className="container mx-auto p-6">
                 <header className="flex items-center gap-2 mb-6">
                    <Cog className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">Configurações da Conta</h1>
                 </header>
                  <Tabs defaultValue="security" className="w-full max-w-2xl mx-auto">
                        <TabsList className="grid w-full grid-cols-1 mb-4">
                            <TabsTrigger value="security">
                                <Shield className="mr-2 h-4 w-4" /> Segurança
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="security"><PasswordChangeForm /></TabsContent>
                  </Tabs>
             </div>
         );
     }

     // Regular user but no DB instance (error state)
      if (!currentEnvironmentDb) {
         return (
             <div className="container mx-auto p-6 text-center text-destructive">
                 Erro: Não foi possível carregar as configurações do seu ambiente. Contacte o suporte.
             </div>
         );
     }

     // Render settings for regular users with an environment
     return (
       <div className="container mx-auto p-4 md:p-6 lg:p-8">
         <header className="flex items-center gap-2 mb-6">
           <Cog className="h-6 w-6 text-primary" />
           {/* Clarify title based on context */}
           <h1 className="text-2xl font-bold">Configurações do Ambiente e Conta</h1>
         </header>

         <Tabs defaultValue="general" className="w-full">
           <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-6 mb-4"> {/* Adjusted grid cols */}
             <TabsTrigger value="general">Geral</TabsTrigger>
             <TabsTrigger value="rates">Valores</TabsTrigger>
             <TabsTrigger value="stages">Modelos Etapa</TabsTrigger>
             <TabsTrigger value="crm">CRM</TabsTrigger>
             <TabsTrigger value="security">Segurança</TabsTrigger> {/* Added Security Tab */}
             <TabsTrigger value="data">Dados</TabsTrigger>
           </TabsList>

           {/* Pass environmentDb where needed, or components fetch via useAuth */}
           <TabsContent value="general"><GeneralSettings /></TabsContent>
           <TabsContent value="rates"><RateSettings /></TabsContent>
           <TabsContent value="stages"><StageTemplateManagement /></TabsContent>
           <TabsContent value="crm"><CrmSettings /></TabsContent>
           <TabsContent value="security"><PasswordChangeForm /></TabsContent> {/* Added Security Content */}
           <TabsContent value="data"><DataManagement /></TabsContent>
         </Tabs>
       </div>
     );
}
