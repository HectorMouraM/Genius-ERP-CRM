
'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type Project } from '@/db/db';
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { DateRange } from 'react-day-picker';
import { isWithinInterval } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface ProjectTypeDistributionChartProps {
  environmentDb: EnvironmentDB;
  dateRange?: DateRange;
}

interface ChartDataPoint {
  name: string;
  value: number;
  fill: string;
}

const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--chart-1) / 0.7)', // Added more variants
    'hsl(var(--chart-2) / 0.7)',
    'hsl(var(--chart-3) / 0.7)',
];

const projectTypeMap: { [key in Project['projectType']]: string } = {
    'Commercial': 'Comercial',
    'Residential': 'Residencial',
};

export default function ProjectTypeDistributionChart({ environmentDb, dateRange }: ProjectTypeDistributionChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartConfig, setChartConfig] = useState<ChartConfig>({});
  const [isLoading, setIsLoading] = useState(true);

  const projects = useLiveQuery(async () => {
    if (!environmentDb) return undefined;
    setIsLoading(true);
    let query = environmentDb.projects;
    if (dateRange?.from && dateRange?.to) {
        // Filter projects created within the date range
        return await query.filter(project =>
            isWithinInterval(project.createdAt, { start: dateRange.from!, end: dateRange.to! })
        ).toArray();
    } else {
        return await query.toArray(); // Get all projects if no range
    }
  }, [environmentDb, dateRange]); // Rerun when DB or dateRange changes

  useEffect(() => {
    if (!projects) return;

    const counts: { [key: string]: number } = {};
    projects.forEach(project => {
      const typeKey = project.projectType || 'Não Definido'; // Group undefined types
      counts[typeKey] = (counts[typeKey] || 0) + 1;
    });

    const newChartData: ChartDataPoint[] = [];
    const newChartConfig: ChartConfig = {};
    let colorIndex = 0;

    Object.entries(counts).forEach(([typeKey, count]) => {
      const color = COLORS[colorIndex % COLORS.length];
      const label = projectTypeMap[typeKey as Project['projectType']] || typeKey;
      newChartData.push({
        name: label,
        value: count,
        fill: color,
      });
      newChartConfig[label] = { label: label, color: color };
      colorIndex++;
    });

    setChartData(newChartData);
    setChartConfig(newChartConfig);
    setIsLoading(false);
  }, [projects]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribuição por Tipo de Projeto</CardTitle>
        <CardDescription>Contagem de projetos por tipo no período selecionado.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando dados do gráfico...
          </div>
        ) : chartData.length === 0 ? (
           <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Nenhum projeto encontrado no período.
           </div>
         ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer>
              <PieChart>
                <Tooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={60} paddingAngle={5} labelLine={false}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend content={({ payload }) => ( // Custom Legend
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4 text-xs">
                      {payload?.map((entry, index) => (
                        <div key={`item-${index}`} className="flex items-center">
                          <span className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: entry.color }}></span>
                          {entry.value} ({chartData.find(d => d.name === entry.value)?.value ?? 0})
                        </div>
                      ))}
                    </div>
                  )} />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
