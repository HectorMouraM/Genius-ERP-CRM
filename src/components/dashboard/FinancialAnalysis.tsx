
'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type Project, type TimeEntry, type Lead, type Proposal } from '@/db/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from '@/lib/utils'; // Assuming formatCurrency is in utils
import { DateRange } from 'react-day-picker';
import { isWithinInterval } from 'date-fns';
import { DollarSign, Scale, TrendingUp, TrendingDown, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FinancialAnalysisProps {
  environmentDb: EnvironmentDB;
  dateRange?: DateRange;
}

interface ProjectFinancials {
  id: number;
  name: string;
  type: 'fixed' | 'hourly';
  budget: number; // totalValue for fixed, hourlyRate for hourly
  hoursLogged: number;
  costRealized: number; // Calculated cost based on hours logged
  marginEstimated: number | null; // Only for fixed projects
  isDeficit: boolean; // Only for fixed projects
}

// Helper function to safely format currency
const safeFormatCurrency = (value: number | null | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) {
        return 'N/A';
    }
    return formatCurrency(value);
};


export default function FinancialAnalysis({ environmentDb, dateRange }: FinancialAnalysisProps) {
  const [financialData, setFinancialData] = useState<ProjectFinancials[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const rawData = useLiveQuery(async () => {
    if (!environmentDb) return undefined;
    setIsLoading(true);
    const [projects, timeEntries, stages] = await Promise.all([
        environmentDb.projects.toArray(),
        environmentDb.timeEntries.toArray(), // Fetch all time entries
        environmentDb.stages.toArray(),
    ]);
    return { projects, timeEntries, stages };
  }, [environmentDb]);

  useEffect(() => {
    if (!rawData) return;

    const { projects, timeEntries, stages } = rawData;

    const stageMap = new Map(stages.map(s => [s.id, s.projectId]));
    const projectTimeMap = new Map<number, number>(); // Map<projectId, totalSeconds>

     // Calculate total time per project based on time entries within the date range
     timeEntries.forEach(entry => {
         const projectId = stageMap.get(entry.stageId);
         if (projectId) {
             const entryDate = entry.startTime;
             // Include entry if no date range OR if within the date range
             if (!dateRange?.from || !dateRange?.to || isWithinInterval(entryDate, { start: dateRange.from, end: dateRange.to })) {
                 const currentTotal = projectTimeMap.get(projectId) ?? 0;
                 projectTimeMap.set(projectId, currentTotal + (entry.duration ?? 0));
             }
         }
     });


    const calculatedData = projects.map(project => {
      const totalSecondsLogged = projectTimeMap.get(project.id!) ?? 0;
      const hoursLogged = totalSecondsLogged / 3600;
      let costRealized = 0;
      let marginEstimated = null;
      let isDeficit = false;
      let budget = 0;

      if (project.billingType === 'hourly') {
        costRealized = hoursLogged * (project.hourlyRate ?? 0);
        budget = project.hourlyRate ?? 0; // Budget here means the rate
      } else if (project.billingType === 'fixed') {
         // Assume a default cost per hour if not explicitly tracked
         // In a real scenario, you'd have cost rates per employee/activity
         const estimatedCostPerHour = 75; // Example cost - replace with actual cost tracking
         costRealized = hoursLogged * estimatedCostPerHour;
         marginEstimated = (project.totalValue ?? 0) - costRealized;
         isDeficit = marginEstimated < 0;
         budget = project.totalValue ?? 0;
      }

      return {
        id: project.id!,
        name: project.clientName,
        type: project.billingType,
        budget: budget,
        hoursLogged: parseFloat(hoursLogged.toFixed(2)),
        costRealized: parseFloat(costRealized.toFixed(2)),
        marginEstimated: marginEstimated !== null ? parseFloat(marginEstimated.toFixed(2)) : null,
        isDeficit: isDeficit,
      };
    });

    // Filter data based on date range (projects created or with activity in range)
     const filteredData = calculatedData.filter(data => {
         const project = projects.find(p => p.id === data.id);
         if (!project) return false;
         // Check if project was created in range OR had time entries in range
         const projectCreatedInRange = dateRange?.from && dateRange?.to && isWithinInterval(project.createdAt, { start: dateRange.from, end: dateRange.to });
         const hasActivityInRange = projectTimeMap.has(project.id!);
         return !dateRange?.from || !dateRange?.to || projectCreatedInRange || hasActivityInRange;
     });


    setFinancialData(filteredData);
    setIsLoading(false);
  }, [rawData, dateRange]);


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Análise Financeira Avançada</CardTitle>
        <CardDescription>Comparativo orçado vs. realizado e margem estimada.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando dados...
          </div>
        ) : financialData.length === 0 ? (
           <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Nenhum dado financeiro para o período selecionado.
           </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Orçado/Taxa</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Custo Realizado</TableHead>
                  <TableHead className="text-right">Margem (Est.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financialData.map((data) => (
                  <TableRow key={data.id} className={data.isDeficit ? 'bg-destructive/10' : ''}>
                    <TableCell className="font-medium">{data.name}</TableCell>
                    <TableCell><Badge variant={data.type === 'fixed' ? 'secondary' : 'outline'}>{data.type === 'fixed' ? 'Fixo' : 'Hora'}</Badge></TableCell>
                    <TableCell className="text-right">{safeFormatCurrency(data.budget)}</TableCell>
                    <TableCell className="text-right">{data.hoursLogged}h</TableCell>
                    <TableCell className="text-right">{safeFormatCurrency(data.costRealized)}</TableCell>
                    <TableCell className={`text-right font-medium ${data.marginEstimated === null ? 'text-muted-foreground' : data.marginEstimated >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.isDeficit && <AlertCircle className="h-4 w-4 inline-block mr-1 text-red-600" />}
                        {safeFormatCurrency(data.marginEstimated)}
                     </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
         <p className="text-xs text-muted-foreground mt-3">* Margem estimada para projetos de valor fixo = (Valor Cobrado - (Custo/Hora Estimado * Horas Registradas)). Custo Realizado = Horas * Taxa (p/ hora) ou Horas * Custo/Hora Estimado (p/ fixo).</p>
      </CardContent>
    </Card>
  );
}
