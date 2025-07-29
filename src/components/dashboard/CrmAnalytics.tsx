
'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type Lead, type Proposal, type Interaction } from '@/db/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from '@/lib/utils'; // Assuming formatCurrency is in utils
import { DateRange } from 'react-day-picker';
import { isWithinInterval, differenceInDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Target, Clock, Users, BarChart, Loader2, Star, MessageSquareWarning, CalendarClock } from 'lucide-react';

interface CrmAnalyticsProps {
  environmentDb: EnvironmentDB;
  dateRange?: DateRange;
}

interface CrmData {
  averageConversionTime: number | null; // in days
  topLostReasons: { reason: string; count: number }[]; // Placeholder for now
  topClientsByValue: { name: string; totalValue: number }[];
  recentInteractions: Interaction[];
  isLoading: boolean;
}

// Helper function to safely format currency
const safeFormatCurrency = (value: number | null | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) {
        return 'R$ 0,00';
    }
    return formatCurrency(value);
};


export default function CrmAnalytics({ environmentDb, dateRange }: CrmAnalyticsProps) {
  const [crmData, setCrmData] = useState<CrmData>({
    averageConversionTime: null,
    topLostReasons: [],
    topClientsByValue: [],
    recentInteractions: [],
    isLoading: true,
  });

  const rawData = useLiveQuery(async () => {
    if (!environmentDb) return undefined;
    setCrmData(prev => ({ ...prev, isLoading: true }));
    const [leads, proposals, interactions] = await Promise.all([
      environmentDb.leads.toArray(),
      environmentDb.proposals.toArray(),
      environmentDb.interactions.orderBy('date').reverse().limit(5).toArray(), // Get last 5 interactions globally for now
    ]);
    return { leads, proposals, interactions };
  }, [environmentDb]);


  useEffect(() => {
    if (!rawData) return;
    const { leads, proposals, interactions } = rawData;

    // --- Calculate Average Conversion Time ---
    let totalConversionDays = 0;
    let convertedCount = 0;
    proposals.forEach(proposal => {
        if (proposal.status === 'Aceita' && proposal.sentAt) {
            const lead = leads.find(l => l.id === proposal.leadId);
             // Filter by date range: Proposal accepted within the range
             if (lead && (!dateRange?.from || !dateRange?.to || isWithinInterval(proposal.createdAt, { start: dateRange.from, end: dateRange.to }))) { // Assuming acceptance date isn't stored, use creation date of proposal
                 // Use createdAt of proposal as acceptance date proxy for now
                 totalConversionDays += differenceInDays(proposal.createdAt, proposal.sentAt);
                 convertedCount++;
             }
        }
    });
    const averageConversionTime = convertedCount > 0 ? totalConversionDays / convertedCount : null;

    // --- Top Lost Reasons (Placeholder) ---
    // This requires a field on the Lead or Proposal to store the lost reason
    const topLostReasons = [ { reason: 'Preço', count: 5 }, { reason: 'Timing', count: 3 }, { reason: 'Concorrência', count: 2 } ]; // Example

    // --- Top Clients by Proposal Value ---
    const valueByClient: { [name: string]: number } = {};
    proposals.forEach(proposal => {
       const lead = leads.find(l => l.id === proposal.leadId);
        if (lead && proposal.status === 'Aceita') { // Consider only accepted proposals value
             // Filter by date range: Proposal accepted within the range
              if (!dateRange?.from || !dateRange?.to || isWithinInterval(proposal.createdAt, { start: dateRange.from, end: dateRange.to })) {
                  valueByClient[lead.name] = (valueByClient[lead.name] || 0) + proposal.totalValue;
              }
       }
    });
    const topClientsByValue = Object.entries(valueByClient)
        .map(([name, totalValue]) => ({ name, totalValue }))
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 5); // Top 5

    // --- Recent Interactions (Filtered by date range if needed, but less common) ---
    const recentInteractions = interactions; // Already limited by query


    setCrmData({
      averageConversionTime: averageConversionTime !== null ? Math.round(averageConversionTime) : null,
      topLostReasons: topLostReasons, // Use placeholder
      topClientsByValue: topClientsByValue,
      recentInteractions: recentInteractions,
      isLoading: false,
    });

  }, [rawData, dateRange]); // Re-run when data or dateRange changes

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Análises de CRM</CardTitle>
        <CardDescription>Insights sobre o funil de vendas e clientes.</CardDescription>
      </CardHeader>
      <CardContent>
        {crmData.isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando dados do CRM...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Average Conversion Time */}
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Tempo Médio de Conversão</p>
                <p className="text-xl font-bold">
                  {crmData.averageConversionTime !== null ? `${crmData.averageConversionTime} dias` : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">(Proposta Enviada → Aceita)</p>
              </div>
            </div>

            {/* Top Lost Reasons (Placeholder) */}
             {/* <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-1"><MessageSquareWarning className="h-4 w-4 text-destructive" /> Principais Motivos de Perda (Exemplo)</h4>
                 <ul className="list-disc list-inside text-sm text-muted-foreground pl-2">
                     {crmData.topLostReasons.map(item => (
                         <li key={item.reason}>{item.reason} ({item.count})</li>
                     ))}
                 </ul>
             </div> */}

             {/* Top Clients */}
             <div className="space-y-2">
                 <h4 className="font-medium text-sm flex items-center gap-1"><Star className="h-4 w-4 text-yellow-500" /> Top 5 Clientes (Valor Total Aceito)</h4>
                 {crmData.topClientsByValue.length > 0 ? (
                     <Table>
                         <TableHeader>
                             <TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Valor Total</TableHead></TableRow>
                         </TableHeader>
                         <TableBody>
                             {crmData.topClientsByValue.map(client => (
                                <TableRow key={client.name}>
                                    <TableCell>{client.name}</TableCell>
                                    <TableCell className="text-right">{safeFormatCurrency(client.totalValue)}</TableCell>
                                </TableRow>
                             ))}
                         </TableBody>
                     </Table>
                 ) : (
                     <p className="text-sm text-muted-foreground text-center py-4">Nenhuma proposta aceita no período.</p>
                 )}
             </div>

            {/* Recent Interactions */}
             <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-1"><MessageSquareWarning className="h-4 w-4 text-blue-500" /> Últimas Interações (Globais)</h4>
                 {crmData.recentInteractions.length > 0 ? (
                    <div className="space-y-2">
                         {crmData.recentInteractions.map(int => (
                             <div key={int.id} className="text-xs border-l-2 pl-2 ml-1">
                                 <p className="font-medium capitalize">{int.type} - {formatDistanceToNow(int.date, { locale: ptBR, addSuffix: true })}</p>
                                 <p className="text-muted-foreground">{int.details}</p>
                             </div>
                         ))}
                    </div>
                 ) : (
                     <p className="text-sm text-muted-foreground text-center py-4">Nenhuma interação registrada.</p>
                 )}
             </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}
