
'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type Lead, type KanbanColumn } from '@/db/db';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts'; // Removed Tooltip and Legend from recharts
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// Import ChartTooltip along with other chart components
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { DateRange } from 'react-day-picker';
import { isWithinInterval } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface SalesPipelineChartProps {
  environmentDb: EnvironmentDB;
  dateRange?: DateRange; // Optional date range filter
}

interface PipelineStageData {
  name: string;
  count: number;
}

const chartConfig = {
  count: { label: 'Leads', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

export default function SalesPipelineChart({ environmentDb, dateRange }: SalesPipelineChartProps) {
  const [chartData, setChartData] = useState<PipelineStageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const leadsAndColumns = useLiveQuery(async () => {
    if (!environmentDb) return undefined;
    setIsLoading(true);
    const [leads, columns] = await Promise.all([
      environmentDb.leads.toArray(),
      environmentDb.kanbanColumns.orderBy('order').toArray(),
    ]);
    return { leads, columns };
  }, [environmentDb]); // Rerun when DB instance changes

  useEffect(() => {
    if (!leadsAndColumns) return;

    const { leads, columns } = leadsAndColumns;

    // Filter leads based on dateRange if provided
    const filteredLeads = dateRange?.from && dateRange?.to
        ? leads.filter(lead => isWithinInterval(lead.createdAt, { start: dateRange.from!, end: dateRange.to! }))
        : leads; // Use all leads if no date range

    const countsByColumn: { [key: string]: number } = {};
    columns.forEach(col => {
      countsByColumn[col.id] = 0; // Initialize count for each column
    });

    filteredLeads.forEach(lead => {
      if (countsByColumn.hasOwnProperty(lead.kanbanColumnId)) {
        countsByColumn[lead.kanbanColumnId]++;
      } else {
        // Handle leads potentially assigned to non-existent columns (optional)
        console.warn(`Lead ${lead.id} has invalid column ID: ${lead.kanbanColumnId}`);
      }
    });

    const newChartData = columns.map(col => ({
      name: col.statusLabel,
      count: countsByColumn[col.id] || 0,
    }));

    setChartData(newChartData);
    setIsLoading(false);
  }, [leadsAndColumns, dateRange]); // Rerun when data or dateRange changes

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline de Vendas (CRM)</CardTitle>
        <CardDescription>Número de leads em cada etapa do funil no período.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando dados do gráfico...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
             Nenhum lead encontrado no período.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} fontSize={12} width={100} />
                <XAxis type="number" hide />
                {/* Use the imported ChartTooltip */}
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                {/* Removed Legend for vertical bar chart */}
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
