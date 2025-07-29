
'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type Project, type TimeEntry } from '@/db/db';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'; // Keep original Recharts import
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'; // Import ChartTooltip and ChartTooltipContent
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Loader2 } from 'lucide-react';

interface RevenueChartProps {
  environmentDb: EnvironmentDB;
  dateRange?: DateRange;
}

interface MonthlyRevenue {
  month: string;
  fixedRevenue: number;
  hourlyRevenue: number;
}

const chartConfig = {
  fixedRevenue: { label: 'Receita Fixa', color: 'hsl(var(--chart-1))' },
  hourlyRevenue: { label: 'Receita por Hora', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

export default function RevenueChart({ environmentDb, dateRange }: RevenueChartProps) {
  const [chartData, setChartData] = useState<MonthlyRevenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

   // Determine the start and end dates for the chart
   const chartStartDate = dateRange?.from ?? startOfMonth(new Date(new Date().setFullYear(new Date().getFullYear() - 1))); // Default to last 12 months
   const chartEndDate = dateRange?.to ?? endOfMonth(new Date());

  const rawData = useLiveQuery(async () => {
    if (!environmentDb) return undefined;
    setIsLoading(true);
    const [projects, timeEntries, stages] = await Promise.all([
      environmentDb.projects.toArray(),
      environmentDb.timeEntries.toArray(),
      environmentDb.stages.toArray(),
    ]);
    return { projects, timeEntries, stages };
  }, [environmentDb]);

  useEffect(() => {
    if (!rawData) return;

    const { projects, timeEntries, stages } = rawData;

    const stageMap = new Map(stages.map(s => [s.id, s.projectId]));
    const projectMap = new Map(projects.map(p => [p.id, p]));

    const months = eachMonthOfInterval({ start: chartStartDate, end: chartEndDate });
    const monthlyData: MonthlyRevenue[] = months.map(monthStart => {
      const monthEnd = endOfMonth(monthStart);
      const monthLabel = format(monthStart, 'MMM/yy', { locale: ptBR });

      // Calculate fixed revenue for projects *created* in this month
      const fixedRevenue = projects.reduce((sum, p) => {
          if (p.billingType === 'fixed' && isWithinInterval(p.createdAt, { start: monthStart, end: monthEnd })) {
             return sum + (p.totalValue ?? 0);
          }
          return sum;
      }, 0);

       // Calculate hourly revenue for time entries *within* this month
       const hourlyRevenue = timeEntries.reduce((sum, entry) => {
           const entryDate = entry.startTime;
           if (isWithinInterval(entryDate, { start: monthStart, end: monthEnd })) {
              const projectId = stageMap.get(entry.stageId);
              const project = projectId ? projectMap.get(projectId) : undefined;
              if (project && project.billingType === 'hourly') {
                 return sum + (entry.duration / 3600) * (project.hourlyRate ?? 0);
              }
           }
           return sum;
       }, 0);

      return {
        month: monthLabel,
        fixedRevenue: parseFloat(fixedRevenue.toFixed(2)),
        hourlyRevenue: parseFloat(hourlyRevenue.toFixed(2)),
      };
    });

    setChartData(monthlyData);
    setIsLoading(false);
  }, [rawData, chartStartDate, chartEndDate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receita Mensal</CardTitle>
        <CardDescription>Receita fixa (projetos criados no mês) e receita por hora (horas registradas no mês).</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando dados do gráfico...
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(value) => `R$${value / 1000}k`} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                 <Legend content={({ payload }) => ( // Custom Legend
                     <div className="flex justify-center gap-4 mt-2">
                       {payload?.map((entry, index) => (
                         <div key={`item-${index}`} className="flex items-center text-xs">
                           <span className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: entry.color }}></span>
                           {chartConfig[entry.dataKey as keyof typeof chartConfig]?.label || entry.value}
                         </div>
                       ))}
                     </div>
                  )} />
                <Bar dataKey="fixedRevenue" fill="var(--color-fixedRevenue)" radius={4} stackId="a" />
                <Bar dataKey="hourlyRevenue" fill="var(--color-hourlyRevenue)" radius={4} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
