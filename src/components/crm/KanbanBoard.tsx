
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanColumn as KanbanColumnType, Lead, Proposal, EnvironmentDB } from '@/db/db'; // Import EnvironmentDB
import KanbanColumnComponent from './KanbanColumn';
import LeadCard from './LeadCard';
import LeadDetail from './LeadDetail';
import { useToast } from '@/hooks/use-toast';
import { createPortal } from 'react-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useLiveQuery } from 'dexie-react-hooks';

interface KanbanBoardProps {
  environmentDb: EnvironmentDB; // Accept the specific DB instance
  initialLeads: Lead[];
  initialColumns: KanbanColumnType[];
  onEditLeadRequest: (lead: Lead) => void;
}

export default function KanbanBoard({ environmentDb, initialLeads, initialColumns, onEditLeadRequest }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [columns, setColumns] = useState<KanbanColumnType[]>(initialColumns);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const { toast } = useToast();

   // Fetch proposals from the specific environment DB
   const allProposals = useLiveQuery(async () => {
        if (!environmentDb) return undefined; // Return undefined if DB not ready
        return await environmentDb.proposals.toArray();
   }, [environmentDb]); // Depend on environmentDb

   // Calculate proposals lookup table, handling undefined case
   const proposalsByLeadId = useMemo(() => {
       if (!allProposals) return {}; // <-- Return empty object if proposals are not loaded yet
       const lookup: { [leadId: number]: Proposal[] } = {};
       allProposals.forEach(proposal => {
           if (proposal.leadId !== undefined) {
               if (!lookup[proposal.leadId]) {
                   lookup[proposal.leadId] = [];
               }
               lookup[proposal.leadId].push(proposal);
               // Sort proposals within each lead by creation date descending
               lookup[proposal.leadId].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
           }
       });
       return lookup;
   }, [allProposals]); // Depend only on allProposals


  // Update state when initial props change
  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);
  useEffect(() => { setColumns(initialColumns); }, [initialColumns]);

  const columnsId = useMemo(() => columns.map((col) => col.id), [columns]);

  // Group leads by column ID
  const leadsByColumnId = useMemo(() => {
      const grouped: { [key: string]: Lead[] } = {};
      columns.forEach(col => grouped[col.id] = []);
      leads.forEach(lead => {
          const columnId = lead.kanbanColumnId;
          if (columnId && grouped[columnId]) grouped[columnId].push(lead);
          else {
              const firstColumnId = columns[0]?.id;
              if (firstColumnId) {
                  if (!grouped[firstColumnId]) grouped[firstColumnId] = [];
                  grouped[firstColumnId].push({ ...lead, kanbanColumnId: firstColumnId }); // Assign to first column if missing/invalid
                   console.warn(`Lead ${lead.id} assigned to default column ${firstColumnId}.`);
              } else {
                   console.error(`Lead ${lead.id} has invalid/missing column ID and no default column found.`);
              }
          }
      });
      // Sort leads within each column by creation date descending
      Object.keys(grouped).forEach(colId => { grouped[colId]?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); });
      return grouped;
  }, [leads, columns]);


  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'Column') setActiveColumnId(active.id as string);
    if (active.data.current?.type === 'Lead') {
      const leadId = active.id as number;
      setActiveLeadId(leadId);
      const lead = leads.find(l => l.id === leadId);
      if (lead) setActiveColumnId(lead.kanbanColumnId);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const activeColIdBeforeDrag = activeColumnId;
    setActiveColumnId(null); setActiveLeadId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id; const overId = over.id;

    // Column Reordering
    if (active.data.current?.type === 'Column' && over.data.current?.type === 'Column' && activeId !== overId) {
        const oldIndex = columns.findIndex((col) => col.id === activeId);
        const newIndex = columns.findIndex((col) => col.id === overId);
        if (oldIndex !== -1 && newIndex !== -1) {
            const newColumnsOrder = arrayMove(columns, oldIndex, newIndex);
            setColumns(newColumnsOrder);
            try {
                // Use environmentDb for transaction
                await environmentDb.transaction('rw', environmentDb.kanbanColumns, async () => {
                    for (let i = 0; i < newColumnsOrder.length; i++) await environmentDb.kanbanColumns.update(newColumnsOrder[i].id, { order: i });
                });
            } catch (error) { console.error("Falha atualizar ordem colunas:", error); toast({ title: "Erro Ordem", variant: "destructive" }); setColumns(columns); }
        } return;
    }

     // Lead Reordering/Moving
     if (active.data.current?.type === 'Lead') {
         const activeLeadId = active.id as number;
         const overElementId = over.id;
         let targetColumnId: string | null = null;
         if (over.data.current?.type === 'Column') targetColumnId = overElementId as string;
         else if (over.data.current?.type === 'Lead') { const overLead = leads.find(l => l.id === overElementId); targetColumnId = overLead?.kanbanColumnId ?? null; }

         if (targetColumnId) {
             const activeLead = leads.find(l => l.id === activeLeadId);
             const currentColumnId = activeLead?.kanbanColumnId;

             if (currentColumnId !== targetColumnId) { // Moving to different column
                 try {
                     // Use environmentDb to update lead
                     await environmentDb.leads.update(activeLeadId, { kanbanColumnId: targetColumnId });
                     // Update local state immediately AFTER successful DB update if not relying solely on live query refresh
                      setLeads(prev => prev.map(l => l.id === activeLeadId ? { ...l, kanbanColumnId: targetColumnId! } : l));

                     toast({ title: "Lead Movido", description: `Movido para "${columns.find(c => c.id === targetColumnId)?.statusLabel}".` });
                     if (targetColumnId === 'aceito') { toast({ title: "Lead Aceito!", description: "Implementar conversão para Projeto.", variant: "default" }); }
                     if (targetColumnId === 'convertido') { toast({ title: "Lead Convertido!", description: "Lead movido para coluna de convertidos.", variant: "default" }); }
                 } catch (error) {
                     console.error("Falha atualizar coluna lead:", error);
                     toast({ title: "Erro Mover Lead", variant: "destructive" });
                     // Revert optimistic UI update if needed (handled by handleDragOver resetting or live query)
                 }
             } else { // Reordering within same column
                  console.log(`Lead ${activeLeadId} reordered within column ${targetColumnId}. Persistence not implemented.`);
                  // If implementing persistence for order within column:
                  // 1. Find old and new index within the targetColumnId leads array
                  // 2. Update the local leads state with the new order
                  // 3. Persist the new order (e.g., add an 'orderInColumn' field to the Lead model or similar)
             }
         }
     }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !active.data.current?.type || active.data.current.type !== 'Lead') return;
    const activeLeadId = active.id as number; const overElementId = over.id;
    let targetColumnId: string | null = null;
    if (over.data.current?.type === 'Column') targetColumnId = overElementId as string;
    else if (over.data.current?.type === 'Lead') { const overLead = leads.find(l => l.id === overElementId); targetColumnId = overLead?.kanbanColumnId ?? null; }
    if (!targetColumnId) return;
    const activeLead = leads.find(l => l.id === activeLeadId); const currentColumnId = activeLead?.kanbanColumnId;
    if (currentColumnId && targetColumnId !== currentColumnId) {
        // Optimistic UI update: move lead visually during drag
        setLeads((prevLeads) => prevLeads.map((lead) => lead.id === activeLeadId ? { ...lead, kanbanColumnId: targetColumnId! } : lead ));
    }
  };

   const activeLeadData = useMemo(() => { if (!activeLeadId) return null; return leads.find((lead) => lead.id === activeLeadId); }, [activeLeadId, leads]);
   const handleOpenLeadDetail = (lead: Lead) => { setSelectedLead(lead); setIsDetailSheetOpen(true); };
   const handleLeadUpdate = (updatedLead: Lead) => { setLeads(prevLeads => prevLeads.map(l => l.id === updatedLead.id ? updatedLead : l)); setSelectedLead(updatedLead); };

  return (
    <>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver} collisionDetection={closestCorners}>
      <div className="flex flex-col md:flex-row gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-background">
        <SortableContext items={columnsId} strategy={horizontalListSortingStrategy}>
          {columns.map((col) => (
            <KanbanColumnComponent
                key={col.id}
                column={col}
                leads={leadsByColumnId[col.id] ?? []}
                onCardClick={handleOpenLeadDetail}
                proposalsLookup={proposalsByLeadId} // Pass the memoized lookup
             />
          ))}
        </SortableContext>
      </div>
      {/* Ensure DragOverlay only renders on client */}
      {typeof window !== 'undefined' && createPortal(
         <DragOverlay>
            {activeLeadId && activeLeadData ? (
                <LeadCard
                    lead={activeLeadData}
                    primaryProposalValue={activeLeadData.id !== undefined ? proposalsByLeadId[activeLeadData.id]?.[0]?.totalValue : undefined}
                    isDragging
                />
            ) : null}
         </DragOverlay>, document.body
      )}
    </DndContext>

     <Sheet open={isDetailSheetOpen} onOpenChange={setIsDetailSheetOpen}>
        <SheetContent className="w-full sm:w-[500px] md:w-[600px] lg:w-[700px] sm:max-w-none p-0 flex flex-col">
           {selectedLead && ( <LeadDetail environmentDb={environmentDb} lead={selectedLead} onClose={() => setIsDetailSheetOpen(false)} onUpdate={handleLeadUpdate} columns={columns} /> )} {/* Pass environmentDb */}
        </SheetContent>
     </Sheet>
    </>
  );
}
