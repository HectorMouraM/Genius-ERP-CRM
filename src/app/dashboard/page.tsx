
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Loader2, LayoutGrid, Filter, Download } from 'lucide-react';
import KeyIndicators from '@/components/dashboard/KeyIndicators';
import RevenueChart from '@/components/dashboard/RevenueChart';
import ProjectTypeDistributionChart from '@/components/dashboard/ProjectTypeDistributionChart';
import SalesPipelineChart from '@/components/dashboard/SalesPipelineChart';
import CrmAnalytics from '@/components/dashboard/CrmAnalytics';
import FinancialAnalysis from '@/components/dashboard/FinancialAnalysis';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DashboardFilters from '@/components/dashboard/DashboardFilters'; // Import Filters
import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading, currentEnvironmentDb } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: subDays(new Date(), 29), // Default to last 30 days
      to: new Date(),
  });

  if (isAuthLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Carregando dados...
      </div>
    );
  }

  if (user?.role === 'Admin') {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Administradores Globais não possuem um dashboard analítico. Use o painel Admin.
      </div>
    );
  }

  if (!currentEnvironmentDb) {
    return (
      <div className="p-6 text-center text-destructive">
        Erro: Ambiente de dados não encontrado para carregar o dashboard.
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Dashboard Analítico</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
           <DashboardFilters dateRange={dateRange} setDateRange={setDateRange} />
           <Button variant="outline" size="sm" disabled> <Download className="mr-2 h-4 w-4"/> Exportar</Button> {/* Placeholder */}
        </div>
      </header>

      {/* Key Indicators Section */}
      <section className="mb-8">
        <KeyIndicators environmentDb={currentEnvironmentDb} dateRange={dateRange} />
      </section>

      {/* Charts Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
         <RevenueChart environmentDb={currentEnvironmentDb} dateRange={dateRange} />
         <ProjectTypeDistributionChart environmentDb={currentEnvironmentDb} dateRange={dateRange} />
         <SalesPipelineChart environmentDb={currentEnvironmentDb} dateRange={dateRange} />
         {/* Add ProjectHoursChart when ready */}
         {/* <ProjectHoursChart environmentDb={currentEnvironmentDb} dateRange={dateRange} /> */}
          <Card>
            <CardHeader>
              <CardTitle>Horas por Projeto</CardTitle>
              <CardDescription>Em desenvolvimento.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">Gráfico de Horas por Projeto</p>
            </CardContent>
          </Card>
      </section>

       {/* Analysis Sections */}
       <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
           <FinancialAnalysis environmentDb={currentEnvironmentDb} dateRange={dateRange} />
           <CrmAnalytics environmentDb={currentEnvironmentDb} dateRange={dateRange} />
       </section>

        {/* Team Productivity Section (Placeholder) */}
       <section className="mb-8">
           <Card>
             <CardHeader>
               <CardTitle>Análise de Equipe / Produtividade</CardTitle>
               <CardDescription>Em desenvolvimento (requer atribuição de usuário a tarefas/projetos).</CardDescription>
             </CardHeader>
             <CardContent>
               <p className="text-muted-foreground text-center py-8">
                 Dados sobre produtividade da equipe serão exibidos aqui.
               </p>
             </CardContent>
           </Card>
       </section>

    </div>
  );
}
