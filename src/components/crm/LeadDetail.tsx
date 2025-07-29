
'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type Lead, type Proposal, type Interaction, type Appointment, type KanbanColumn, Project, EnvironmentSettings, getEnvironmentSettings } from '@/db/db'; // Added EnvironmentDB
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Save, PlusCircle, Edit, Trash2, Phone, Mail, Calendar, StickyNote, DollarSign, Clock, FileText, Info, Send, Loader2 } from 'lucide-react'; // Added Loader2
import { ScrollArea } from '@/components/ui/scroll-area';
import ProposalForm from './ProposalForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card'; // Import Card

// Definitions remain the same
const projectTypes: Project['projectType'][] = ['Commercial', 'Residential'];
const projectTypeMap: { [key in Project['projectType']]: string } = { 'Commercial': 'Comercial', 'Residential': 'Residencial' };
const interactionTypes: Interaction['type'][] = ['ligação', 'visita', 'reunião', 'anotação', 'email'];
const appointmentStatuses: Appointment['status'][] = ['Pendente', 'Realizado', 'Adiado'];
const proposalStatuses: Proposal['status'][] = ['Rascunho', 'Enviada', 'Aceita', 'Recusada'];
function formatCurrency(amount?: number): string { if (amount === undefined || amount === null) return 'N/A'; return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

interface LeadDetailProps {
  environmentDb: EnvironmentDB; // Accept the specific DB instance
  lead: Lead;
  onClose: () => void;
  onUpdate: (updatedLead: Lead) => void;
  columns: KanbanColumn[];
}

export default function LeadDetail({ environmentDb, lead, onClose, onUpdate, columns }: LeadDetailProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedLead, setEditedLead] = useState<Lead>(lead);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [proposalToManage, setProposalToManage] = useState<Proposal | null>(null);
  const [newInteractionType, setNewInteractionType] = useState<Interaction['type']>('anotação');
  const [newInteractionDetails, setNewInteractionDetails] = useState('');
  const [newAppointmentDateTime, setNewAppointmentDateTime] = useState<string>('');
  const [newAppointmentDescription, setNewAppointmentDescription] = useState('');

  // Fetch related data from the specific environmentDb
  const proposals = useLiveQuery(async () => { if (!lead.id || !environmentDb) return []; return await environmentDb.proposals.where('leadId').equals(lead.id).reverse().sortBy('createdAt'); }, [lead.id, environmentDb]);
  const interactions = useLiveQuery(async () => { if (!lead.id || !environmentDb) return []; return await environmentDb.interactions.where('leadId').equals(lead.id).reverse().sortBy('date'); }, [lead.id, environmentDb]);
  const appointments = useLiveQuery(async () => { if (!lead.id || !environmentDb) return []; return await environmentDb.appointments.where('leadId').equals(lead.id).sortBy('dateTime'); }, [lead.id, environmentDb]);

  useEffect(() => { setEditedLead(lead); setIsEditing(false); }, [lead]);

  // --- Handlers using environmentDb ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { const { name, value } = e.target; if (e.target instanceof HTMLSelectElement) setEditedLead(prev => ({ ...prev!, [name]: value })); else setEditedLead(prev => ({ ...prev!, [name]: value })); };
  const handleSelectChange = (name: keyof Lead, value: string | undefined) => { setEditedLead(prev => ({ ...prev!, [name]: value })); };

  const handleSaveChanges = async () => {
    if (!editedLead || !editedLead.id || !environmentDb) return;
    try {
      await environmentDb.leads.update(editedLead.id, { name: editedLead.name, email: editedLead.email || undefined, phone: editedLead.phone || undefined, source: editedLead.source || undefined, projectType: editedLead.projectType, subType: editedLead.subType || undefined, responsible: editedLead.responsible || undefined, notes: editedLead.notes || undefined, kanbanColumnId: editedLead.kanbanColumnId });
      onUpdate(editedLead); setIsEditing(false); toast({ title: "Sucesso", description: "Lead atualizado." });
      if (editedLead.kanbanColumnId === 'aceito') { toast({ title: "Lead Aceito!", description: "Implementar conversão para Projeto.", variant: "default", duration: 5000 }); }
      if (editedLead.kanbanColumnId === 'convertido') { toast({ title: "Lead Convertido!", description: "Lead movido para coluna de convertidos.", variant: "default" }); } // Handle 'convertido'
    } catch (error) { console.error("Falha atualizar lead:", error); toast({ title: "Erro Salvar", variant: "destructive" }); }
  };

  const handleAddInteraction = async () => {
    if (!lead.id || !newInteractionDetails.trim() || !environmentDb) return;
    try {
        const newInteraction: Omit<Interaction, 'id'> = { leadId: lead.id, type: newInteractionType, date: new Date(), details: newInteractionDetails.trim() };
        await environmentDb.interactions.add(newInteraction as Interaction);
        setNewInteractionDetails(''); setNewInteractionType('anotação'); toast({ title: "Sucesso", description: "Interação adicionada." });
    } catch (error) { console.error("Falha add interação:", error); toast({ title: "Erro Interação", variant: "destructive" }); }
  };
   const handleDeleteInteraction = async (interactionId: number) => {
       if (!interactionId || !environmentDb) return;
       try { await environmentDb.interactions.delete(interactionId); toast({ title: "Sucesso", description: "Interação excluída." }); }
       catch (error) { console.error("Falha excluir interação:", error); toast({ title: "Erro Excluir Interação", variant: "destructive" }); }
   };

  const handleAddAppointment = async () => {
    if (!lead.id || !newAppointmentDescription.trim() || !newAppointmentDateTime || !environmentDb) return;
    try {
        const newAppointment: Omit<Appointment, 'id'> = { leadId: lead.id, dateTime: new Date(newAppointmentDateTime), description: newAppointmentDescription.trim(), status: 'Pendente' };
        await environmentDb.appointments.add(newAppointment as Appointment);
        setNewAppointmentDateTime(''); setNewAppointmentDescription(''); toast({ title: "Sucesso", description: "Agendamento adicionado." });
    } catch (error) { console.error("Falha add agendamento:", error); toast({ title: "Erro Agendamento", variant: "destructive" }); }
  };
   const handleUpdateAppointmentStatus = async (appointmentId: number, status: Appointment['status']) => {
        if (!appointmentId || !environmentDb) return;
        try { await environmentDb.appointments.update(appointmentId, { status }); toast({ title: "Sucesso", description: `Status agendamento: ${status}.` }); }
        catch (error) { console.error("Falha atualizar status agendamento:", error); toast({ title: "Erro Status Agendamento", variant: "destructive" }); }
    };
    const handleDeleteAppointment = async (appointmentId: number) => {
        if (!appointmentId || !environmentDb) return;
        try { await environmentDb.appointments.delete(appointmentId); toast({ title: "Sucesso", description: "Agendamento excluído." }); }
        catch (error) { console.error("Falha excluir agendamento:", error); toast({ title: "Erro Excluir Agendamento", variant: "destructive" }); }
    };

    const openProposalModal = (proposal?: Proposal) => { setProposalToManage(proposal || null); setIsProposalModalOpen(true); };
    const handleProposalSuccess = () => { setIsProposalModalOpen(false); setProposalToManage(null); };
    const handleDeleteProposal = async (proposalId: number) => {
        if (!proposalId || !environmentDb) return;
        try { await environmentDb.proposals.delete(proposalId); toast({ title: "Sucesso", description: "Proposta excluída." }); }
        catch (error) { console.error("Falha excluir proposta:", error); toast({ title: "Erro Excluir Proposta", variant: "destructive" }); }
    };
    const handleConvertToProject = async (proposalId: number) => {
        if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        const acceptedProposal = proposals?.find(p => p.id === proposalId);
        if (!acceptedProposal || acceptedProposal.status !== 'Aceita' || lead.id === undefined) return toast({ title: "Ação Inválida", variant: "default"});
        toast({ title: "Convertendo...", duration: 2000});
        try {
            const settings = await getEnvironmentSettings(environmentDb);
            const projectData: Omit<Project, 'id' | 'createdAt'> = {
                 clientName: lead.name,
                 description: acceptedProposal.description || lead.notes || 'Descrição a definir',
                 projectType: lead.projectType || 'Residential',
                 subType: lead.subType || undefined,
                 status: 'Pendente',
                 billingType: acceptedProposal.chargeType, // Get billing type from proposal
                 hourlyRate: acceptedProposal.chargeType === 'hourly' ? (acceptedProposal.hourlyRate || settings.defaultHourlyRate || 100) : undefined, // Rate only if hourly
                 totalValue: acceptedProposal.chargeType === 'fixed' ? acceptedProposal.totalValue : undefined, // Value only if fixed
             };
            const newProjectId = await environmentDb.projects.add({ ...projectData, createdAt: new Date() });
            const convertedColumn = columns.find(c => c.id === 'convertido');
             if (convertedColumn && lead.id !== undefined) {
                 await environmentDb.leads.update(lead.id, { kanbanColumnId: convertedColumn.id });
                 onUpdate({ ...editedLead, kanbanColumnId: convertedColumn.id });
                 toast({ title: "Projeto Criado e Lead Movido!", description: `Projeto ${projectData.clientName} (ID: ${newProjectId}) criado e lead movido para 'Convertido'.`, duration: 5000 });
             }
             else {
                 console.log("Coluna 'convertido' não encontrada. Projeto criado, mas lead não movido.");
                 toast({ title: "Projeto Criado!", description: `Projeto ${projectData.clientName} (ID: ${newProjectId}) criado. Coluna 'Convertido' não encontrada.`, duration: 5000 });
             }
            onClose();
        } catch (error) { console.error("Falha converter:", error); toast({ title: "Erro Conversão", variant: "destructive"}); }
    };
    const handleMarkAsSent = async (proposalId: number) => {
        if (!proposalId || !environmentDb) return;
        try { await environmentDb.proposals.update(proposalId, { status: 'Enviada', sentAt: new Date() }); toast({ title: "Proposta Enviada" }); }
        catch (error) { console.error("Falha marcar enviada:", error); toast({ title: "Erro", variant: "destructive" }); }
    };


    // Loading state for related data
    const isLoadingRelatedData = proposals === undefined || interactions === undefined || appointments === undefined;


  return (
    <>
      <SheetHeader className="p-4 border-b sticky top-0 bg-background z-10">
        <div className="flex justify-between items-center">
            <div>
                <SheetTitle>{lead.name}</SheetTitle>
                <SheetDescription>
                    Criado em: {format(lead.createdAt, 'PPP', { locale: ptBR })} | Etapa: {columns.find(c => c.id === editedLead.kanbanColumnId)?.statusLabel || 'N/A'}
                </SheetDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
      </SheetHeader>

       <ScrollArea className="h-full">
            <div className="p-4">
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4"><TabsTrigger value="info"><Info className="mr-1 h-4 w-4 inline-block"/> Geral</TabsTrigger><TabsTrigger value="proposals"><FileText className="mr-1 h-4 w-4 inline-block"/> Propostas</TabsTrigger><TabsTrigger value="interactions"><StickyNote className="mr-1 h-4 w-4 inline-block"/> Interações</TabsTrigger><TabsTrigger value="appointments"><Calendar className="mr-1 h-4 w-4 inline-block"/> Agendamentos</TabsTrigger></TabsList>

                {/* Tab 1: General Info */}
                <TabsContent value="info"><div className="space-y-4">{isEditing ? (<>{/* Edit Form */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="space-y-1"><Label htmlFor="name">Nome*</Label><Input id="name" name="name" value={editedLead.name} onChange={handleInputChange} /></div><div className="space-y-1"><Label htmlFor="kanbanColumnId">Etapa*</Label><Select name="kanbanColumnId" value={editedLead.kanbanColumnId} onValueChange={(value) => handleSelectChange('kanbanColumnId', value)}><SelectTrigger id="kanbanColumnId"><SelectValue /></SelectTrigger><SelectContent>{columns.map(column => (<SelectItem key={column.id} value={column.id}>{column.statusLabel}</SelectItem>))}</SelectContent></Select></div><div className="space-y-1"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" value={editedLead.email ?? ''} onChange={handleInputChange} /></div><div className="space-y-1"><Label htmlFor="phone">Telefone</Label><Input id="phone" name="phone" value={editedLead.phone ?? ''} onChange={handleInputChange} /></div><div className="space-y-1"><Label htmlFor="source">Origem</Label><Input id="source" name="source" value={editedLead.source ?? ''} onChange={handleInputChange} /></div><div className="space-y-1"><Label htmlFor="responsible">Responsável</Label><Input id="responsible" name="responsible" value={editedLead.responsible ?? ''} onChange={handleInputChange} /></div><div className="space-y-1"><Label htmlFor="projectType">Tipo Projeto</Label><Select name="projectType" value={editedLead.projectType} onValueChange={(value) => handleSelectChange('projectType', value as Project['projectType'])}><SelectTrigger id="projectType"><SelectValue placeholder="Selecione o tipo"/></SelectTrigger><SelectContent>{projectTypes.map(type => (<SelectItem key={type} value={type}>{projectTypeMap[type]}</SelectItem>))}</SelectContent></Select></div><div className="space-y-1"><Label htmlFor="subType">Subtipo</Label><Input id="subType" name="subType" value={editedLead.subType ?? ''} onChange={handleInputChange} /></div></div><div className="space-y-1"><Label htmlFor="notes">Observações</Label><Textarea id="notes" name="notes" value={editedLead.notes ?? ''} onChange={handleInputChange} rows={4} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setIsEditing(false); setEditedLead(lead); }}>Cancelar</Button><Button onClick={handleSaveChanges}><Save className="mr-2 h-4 w-4"/> Salvar</Button></div></>) : (<>{/* Display View */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {editedLead.email || <span className="text-muted-foreground">N/A</span>}</div><div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {editedLead.phone || <span className="text-muted-foreground">N/A</span>}</div><div><span className="font-medium text-muted-foreground">Origem:</span> {editedLead.source || 'N/A'}</div><div><span className="font-medium text-muted-foreground">Responsável:</span> {editedLead.responsible || 'N/A'}</div><div><span className="font-medium text-muted-foreground">Tipo:</span> {editedLead.projectType ? projectTypeMap[editedLead.projectType] : 'N/A'}</div><div><span className="font-medium text-muted-foreground">Subtipo:</span> {editedLead.subType || 'N/A'}</div></div>{editedLead.notes && (<div className="mt-4 space-y-1"><Label>Observações</Label><p className="text-sm p-3 bg-muted rounded-md whitespace-pre-wrap">{editedLead.notes}</p></div>)}<div className="flex justify-end mt-4"><Button variant="outline" onClick={() => setIsEditing(true)}><Edit className="mr-2 h-4 w-4"/> Editar</Button></div></>)}</div></TabsContent>

                {/* Tab 2: Proposals */}
                <TabsContent value="proposals"><div className="space-y-4">
                    <Dialog open={isProposalModalOpen} onOpenChange={(isOpen) => { setIsProposalModalOpen(isOpen); if (!isOpen) setProposalToManage(null); }}>
                        <DialogTrigger asChild><Button onClick={() => openProposalModal()} size="sm"><PlusCircle className="mr-2 h-4 w-4"/> Nova Proposta</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-[800px] md:max-w-[900px] lg:max-w-[1000px] max-h-[90vh]"><DialogHeader><DialogTitle>{proposalToManage ? 'Editar Proposta' : 'Criar Nova Proposta'}</DialogTitle></DialogHeader>{environmentDb && <ProposalForm environmentDb={environmentDb} lead={lead} proposalToEdit={proposalToManage} onSuccess={handleProposalSuccess} onClose={() => setIsProposalModalOpen(false)} />}</DialogContent> {/* Pass environmentDb */}
                    </Dialog>
                     {isLoadingRelatedData && <p className='flex items-center gap-2 text-sm text-muted-foreground'><Loader2 className='h-4 w-4 animate-spin'/> Carregando propostas...</p>}
                     {!isLoadingRelatedData && (!proposals || proposals.length === 0) && <p className="text-muted-foreground text-sm text-center py-4">Nenhuma proposta criada.</p>}
                     {!isLoadingRelatedData && proposals && proposals.length > 0 && (<div className="space-y-3">{proposals.map(prop => (<Card key={prop.id} className="p-3"><div className="flex justify-between items-start gap-2 flex-wrap"><div className="flex-1 min-w-[200px]"><p className="font-semibold text-sm">{prop.title}</p><p className="text-xs text-muted-foreground">Status: {prop.status} | Valor: {formatCurrency(prop.totalValue)} ({prop.chargeType === 'fixed' ? 'Fixo' : `Hora - ${prop.hourlyRate ? formatCurrency(prop.hourlyRate)+'/hr' : 'N/A'}`})</p><p className="text-xs text-muted-foreground">Criada: {format(prop.createdAt, 'P p', { locale: ptBR })} {prop.sentAt ? `| Enviada: ${format(prop.sentAt, 'P p', { locale: ptBR })}` : ''}</p></div><div className="flex items-center gap-1 shrink-0 mt-1 sm:mt-0">{prop.status === 'Rascunho' && prop.id !== undefined && (<Button variant="outline" size="xs" onClick={() => handleMarkAsSent(prop.id!)}><Send className="mr-1 h-3 w-3"/> Enviar</Button>)}{prop.status === 'Aceita' && prop.id !== undefined && (<Button variant="secondary" size="xs" onClick={() => handleConvertToProject(prop.id!)}>Converter</Button>)}<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openProposalModal(prop)} title="Editar"><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => prop.id !== undefined && handleDeleteProposal(prop.id)} title="Excluir"><Trash2 className="h-4 w-4" /></Button></div></div>{prop.description && <p className="text-xs mt-1 p-2 bg-muted/50 rounded-sm">{prop.description}</p>}</Card>))}</div>)}
                  </div></TabsContent>

                {/* Tab 3: Interactions */}
                <TabsContent value="interactions"><div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2 items-end border p-3 rounded-md"><div className="flex-grow w-full sm:w-auto"><Label htmlFor="new-interaction-type">Tipo</Label><Select value={newInteractionType} onValueChange={(value) => setNewInteractionType(value as Interaction['type'])}><SelectTrigger id="new-interaction-type"><SelectValue /></SelectTrigger><SelectContent>{interactionTypes.map(type => (<SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>))}</SelectContent></Select></div><div className="flex-grow-[3] w-full sm:w-auto"><Label htmlFor="new-interaction-details">Detalhes</Label><Textarea id="new-interaction-details" value={newInteractionDetails} onChange={(e) => setNewInteractionDetails(e.target.value)} rows={2} className="min-h-[40px]" /></div><Button onClick={handleAddInteraction} size="sm" className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4"/> Adicionar</Button></div>
                     {isLoadingRelatedData && <p className='flex items-center gap-2 text-sm text-muted-foreground'><Loader2 className='h-4 w-4 animate-spin'/> Carregando interações...</p>}
                     {!isLoadingRelatedData && (!interactions || interactions.length === 0) && <p className="text-muted-foreground text-sm text-center py-4">Nenhuma interação registrada.</p>}
                    {!isLoadingRelatedData && interactions && interactions.length > 0 && (<div className="space-y-3">{interactions.map(int => (<Card key={int.id} className="p-3"><div className="flex justify-between items-start gap-2"><div><p className="text-xs text-muted-foreground capitalize">{int.type} - {format(int.date, 'Pp', { locale: ptBR })}</p><p className="text-sm mt-1 whitespace-pre-wrap">{int.details}</p></div><Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => int.id !== undefined && handleDeleteInteraction(int.id)} title="Excluir"><Trash2 className="h-3 w-3" /></Button></div></Card>))}</div>)}
                  </div></TabsContent>

                {/* Tab 4: Appointments */}
                <TabsContent value="appointments"><div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2 items-end border p-3 rounded-md"><div className="flex-grow w-full sm:w-auto"><Label htmlFor="new-appointment-datetime">Data/Hora</Label><Input id="new-appointment-datetime" type="datetime-local" value={newAppointmentDateTime} onChange={(e) => setNewAppointmentDateTime(e.target.value)} /></div><div className="flex-grow-[3] w-full sm:w-auto"><Label htmlFor="new-appointment-description">Descrição</Label><Input id="new-appointment-description" value={newAppointmentDescription} onChange={(e) => setNewAppointmentDescription(e.target.value)} placeholder="Reunião..." /></div><Button onClick={handleAddAppointment} size="sm" className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4"/> Agendar</Button></div>
                     {isLoadingRelatedData && <p className='flex items-center gap-2 text-sm text-muted-foreground'><Loader2 className='h-4 w-4 animate-spin'/> Carregando agendamentos...</p>}
                     {!isLoadingRelatedData && (!appointments || appointments.length === 0) && <p className="text-muted-foreground text-sm text-center py-4">Nenhum agendamento.</p>}
                     {!isLoadingRelatedData && appointments && appointments.length > 0 && (<div className="space-y-3">{appointments.map(apt => (<Card key={apt.id} className="p-3"><div className="flex justify-between items-start gap-2 flex-wrap"><div className="flex-1 min-w-[150px]"><p className="text-sm font-medium">{apt.description}</p><p className="text-xs text-muted-foreground">{format(apt.dateTime, 'Pp', { locale: ptBR })}</p></div><div className="flex items-center gap-1 shrink-0 mt-1 sm:mt-0"><Select value={apt.status} onValueChange={(value) => apt.id !== undefined && handleUpdateAppointmentStatus(apt.id, value as Appointment['status'])}><SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger><SelectContent>{appointmentStatuses.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}</SelectContent></Select><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => apt.id !== undefined && handleDeleteAppointment(apt.id)} title="Excluir"><Trash2 className="h-4 w-4" /></Button></div></div></Card>))}</div>)}
                  </div></TabsContent>
              </Tabs>
            </div>
       </ScrollArea>
    </>
  );
}
    