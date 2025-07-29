
'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type Lead, type KanbanColumn } from '@/db/db'; // Import EnvironmentDB
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, BarChart2, CalendarDays, Filter, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import LeadForm from './LeadForm';
import KanbanBoard from './KanbanBoard';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CrmDashboardProps {
    environmentDb: EnvironmentDB; // Accept the specific DB instance
}

export default function CrmDashboard({ environmentDb }: CrmDashboardProps) {
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // Removed isMounted, useLiveQuery handles async

  // Fetch leads from the provided environmentDb instance
  const leads = useLiveQuery(async () => {
    if (!environmentDb) return undefined;
    const query = environmentDb.leads.orderBy('createdAt').reverse();
    if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        return await query.filter(lead =>
            lead.name.toLowerCase().includes(lowerSearchTerm) ||
            (lead.email && lead.email.toLowerCase().includes(lowerSearchTerm)) ||
            (lead.phone && lead.phone.includes(searchTerm)) ||
            (lead.responsible && lead.responsible.toLowerCase().includes(lowerSearchTerm))
        ).toArray();
    }
    return await query.toArray();
  }, [environmentDb, searchTerm]); // Depend on environmentDb and searchTerm

  // Fetch columns from the provided environmentDb instance
  const columns = useLiveQuery(async () => {
    if (!environmentDb) return undefined;
    return await environmentDb.kanbanColumns.orderBy('order').toArray();
  }, [environmentDb]); // Depend on environmentDb

  const handleLeadAddedOrUpdated = () => { setIsLeadModalOpen(false); setLeadToEdit(null); };
  const openCreateLeadModal = () => { setLeadToEdit(null); setIsLeadModalOpen(true); };
  const openEditLeadModal = (lead: Lead) => { setLeadToEdit(lead); setIsLeadModalOpen(true); };

  const isLoading = leads === undefined || columns === undefined; // Loading if either is undefined

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">CRM - Gestão de Leads</h1>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input type="search" placeholder="Buscar leads..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-full md:w-[250px] lg:w-[300px]" />
            </div>
            <Button variant="outline" size="sm" disabled><Filter className="mr-2 h-4 w-4" /> Filtros</Button>
            <Button variant="outline" size="sm" disabled><BarChart2 className="mr-2 h-4 w-4" /> Visão Geral</Button>
            <Button variant="outline" size="sm" disabled><CalendarDays className="mr-2 h-4 w-4" /> Agenda</Button>
          <Dialog open={isLeadModalOpen} onOpenChange={(isOpen) => { setIsLeadModalOpen(isOpen); if (!isOpen) setLeadToEdit(null); }}>
            <DialogTrigger asChild><Button onClick={openCreateLeadModal} disabled={!environmentDb}><PlusCircle className="mr-2 h-4 w-4" /> Novo Lead</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[600px] md:max-w-[700px]">
              <DialogHeader><DialogTitle>{leadToEdit ? 'Editar Detalhes do Lead' : 'Criar Novo Lead'}</DialogTitle></DialogHeader>
              {/* Pass environmentDb and columns to LeadForm */}
              <LeadForm environmentDb={environmentDb!} onSuccess={handleLeadAddedOrUpdated} leadToEdit={leadToEdit} columns={columns ?? []} />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Kanban Board */}
       {isLoading ? (
         <Card>
           <CardHeader><CardTitle className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Carregando Quadro Kanban...</CardTitle></CardHeader>
           <CardContent><p>Aguarde enquanto os dados são carregados.</p></CardContent>
         </Card>
       ) : (
           <KanbanBoard
             environmentDb={environmentDb!} // Pass the DB instance
             initialLeads={leads ?? []}
             initialColumns={columns ?? []}
             onEditLeadRequest={openEditLeadModal}
           />
       )}
    </div>
  );
}
