
'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type Project, type TimeEntry, type Lead, type Proposal } from '@/db/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, TrendingUp, TrendingDown, Clock, Target, FileCheck, FileX, Banknote, Briefcase, Clock10, Percent, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils'; // Assuming formatCurrency is in utils
import { DateRange } from 'react-day-picker';
import { isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

interface KeyIndicatorsProps {
  environmentDb: EnvironmentDB;
  dateRange?: DateRange;
}

interface IndicatorData {
    projectsInProgress: number;
    projectsCompletedThisMonth: number;
    hoursWorkedThisMonth: number;
    fixedRevenueForecast: number;
    hourlyRevenueAccumulated: number;
    avgAcceptedProposalValue: number;
    proposalsPending: number;
    proposalConversionRate: number | null;
    isLoading: boolean;
}

// Helper function to safely format currency
const safeFormatCurrency = (value: number | null | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) {
        return 'R$ 0,00';
    }
    return formatCurrency(value);
};

export default function KeyIndicators({ environmentDb, dateRange }: KeyIndicatorsProps) {
    const [indicatorData, setIndicatorData] = useState<IndicatorData>({
        projectsInProgress: 0,
        projectsCompletedThisMonth: 0,
        hoursWorkedThisMonth: 0,
        fixedRevenueForecast: 0,
        hourlyRevenueAccumulated: 0,
        avgAcceptedProposalValue: 0,
        proposalsPending: 0,
        proposalConversionRate: null,
        isLoading: true,
    });

    // Calculate start and end of the *current* month for specific metrics
    const currentMonthStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());

    const data = useLiveQuery(async () => {
        if (!environmentDb) return undefined;
        setIndicatorData(prev => ({ ...prev, isLoading: true })); // Set loading true before fetching

        const [projects, timeEntries, leads, proposals] = await Promise.all([
            environmentDb.projects.toArray(),
            environmentDb.timeEntries.toArray(), // Fetch all time entries
            environmentDb.leads.toArray(), // Need leads for proposal context
            environmentDb.proposals.toArray(),
        ]);

        const fromDate = dateRange?.from;
        const toDate = dateRange?.to;

        // --- Calculations ---
        const projectsInProgress = projects.filter(p => p.status === 'Em Andamento').length;

        // Completed projects within the *current* month
        const projectsCompletedThisMonth = projects.filter(p =>
            p.status === 'Concluído' &&
            p.createdAt >= currentMonthStart && p.createdAt <= currentMonthEnd // Assuming completion date isn't stored, use creation date for now
        ).length;

        // Hours worked within the selected date range
        const hoursWorkedInRange = timeEntries.reduce((sum, entry) => {
            const entryDate = entry.startTime; // Use startTime to check if entry falls in range
             if (fromDate && toDate && isWithinInterval(entryDate, { start: fromDate, end: toDate })) {
                return sum + (entry.duration ?? 0);
             } else if (!fromDate && !toDate) { // Handle case where no date range is selected (sum all)
                 return sum + (entry.duration ?? 0);
             }
             return sum;
        }, 0) / 3600; // Convert seconds to hours


        // Fixed revenue from *all* non-completed fixed projects
        const fixedRevenueForecast = projects.reduce((sum, p) => {
            if (p.billingType === 'fixed' && p.status !== 'Concluído') {
                return sum + (p.totalValue ?? 0);
            }
            return sum;
        }, 0);

         // Accumulated hourly revenue (total hours * rate for hourly projects)
         // This requires linking TimeEntries back to Projects via Stages
         const stages = await environmentDb.stages.toArray();
         const stageMap = new Map(stages.map(s => [s.id, s.projectId]));
         const projectMap = new Map(projects.map(p => [p.id, p]));

         const hourlyRevenueAccumulated = timeEntries.reduce((sum, entry) => {
             const projectId = stageMap.get(entry.stageId);
             const project = projectId ? projectMap.get(projectId) : undefined;
             if (project && project.billingType === 'hourly') {
                 // Check if entry is within date range
                  const entryDate = entry.startTime;
                  if ((!fromDate || !toDate) || (fromDate && toDate && isWithinInterval(entryDate, { start: fromDate, end: toDate }))) {
                      return sum + (entry.duration / 3600) * (project.hourlyRate ?? 0);
                  }
             }
             return sum;
         }, 0);


        const acceptedProposals = proposals.filter(p => p.status === 'Aceita');
        const avgAcceptedProposalValue = acceptedProposals.length > 0
            ? acceptedProposals.reduce((sum, p) => sum + p.totalValue, 0) / acceptedProposals.length
            : 0;

        const proposalsPending = proposals.filter(p => p.status === 'Enviada').length;

        const totalSentOrAccepted = proposals.filter(p => p.status === 'Enviada' || p.status === 'Aceita').length;
        const proposalConversionRate = totalSentOrAccepted > 0
            ? (acceptedProposals.length / totalSentOrAccepted) * 100
            : null;


        return {
            projectsInProgress,
            projectsCompletedThisMonth,
            hoursWorkedThisMonth: hoursWorkedInRange, // Use range-filtered hours
            fixedRevenueForecast,
            hourlyRevenueAccumulated, // Use calculated hourly revenue
            avgAcceptedProposalValue,
            proposalsPending,
            proposalConversionRate,
            isLoading: false, // Set loading false after calculation
        };
    }, [environmentDb, dateRange]); // Rerun when DB or dateRange changes

     // Update state when data from useLiveQuery changes
     useEffect(() => {
        if (data) {
            setIndicatorData(data);
        }
    }, [data]);


  if (indicatorData.isLoading) {
      return (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                 <Card key={i}>
                     <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                         <CardTitle className="text-sm font-medium text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</CardTitle>
                         {/* Icon Placeholder */}
                     </CardHeader>
                     <CardContent>
                         <div className="text-2xl font-bold"><Loader2 className="h-6 w-6 animate-spin" /></div>
                         <p className="text-xs text-muted-foreground">Aguarde...</p>
                     </CardContent>
                 </Card>
              ))}
          </div>
      );
  }


  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Projetos em Andamento</CardTitle>
          <Briefcase className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{indicatorData.projectsInProgress}</div>
          {/* <p className="text-xs text-muted-foreground">+2 this month</p> */}
        </CardContent>
      </Card>

       <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Concluídos (Mês Atual)</CardTitle>
          <FileCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{indicatorData.projectsCompletedThisMonth}</div>
          <p className="text-xs text-muted-foreground">Projetos finalizados este mês</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Horas Trabalhadas (Período)</CardTitle>
          <Clock10 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{indicatorData.hoursWorkedThisMonth.toFixed(1)}h</div>
          <p className="text-xs text-muted-foreground">Total de horas no período selecionado</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receita Fixa Prevista</CardTitle>
          <Banknote className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{safeFormatCurrency(indicatorData.fixedRevenueForecast)}</div>
          <p className="text-xs text-muted-foreground">Valor de projetos fixos não concluídos</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receita por Hora (Período)</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{safeFormatCurrency(indicatorData.hourlyRevenueAccumulated)}</div>
          <p className="text-xs text-muted-foreground">Acumulado no período</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ticket Médio (Propostas Aceitas)</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{safeFormatCurrency(indicatorData.avgAcceptedProposalValue)}</div>
           <p className="text-xs text-muted-foreground">Média de valor das propostas aceitas</p>
        </CardContent>
      </Card>

       <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Propostas Aguardando</CardTitle>
          <FileX className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{indicatorData.proposalsPending}</div>
          <p className="text-xs text-muted-foreground">Propostas com status 'Enviada'</p>
        </CardContent>
      </Card>

       <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxa de Conversão (Propostas)</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <div className="text-2xl font-bold">{indicatorData.proposalConversionRate !== null ? `${indicatorData.proposalConversionRate.toFixed(1)}%` : 'N/A'}</div>
           <p className="text-xs text-muted-foreground">(Aceitas / (Enviadas + Aceitas))</p>
        </CardContent>
      </Card>

    </div>
  );
}
