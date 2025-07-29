
'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type KanbanColumn } from '@/db/db'; // Import EnvironmentDB
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Settings, List, PlusCircle, Trash2, GripVertical, Loader2 } from 'lucide-react'; // Added Loader2
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

// SortableColumnItemProps remains the same
interface SortableColumnItemProps { column: KanbanColumn; onDelete: (id: string) => void; }
function SortableColumnItem({ column, onDelete }: SortableColumnItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 'auto' };
    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 border rounded-md bg-card hover:bg-muted/50">
            <button {...attributes} {...listeners} className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground"><GripVertical className="h-5 w-5" /></button>
            <span className="flex-grow">{column.statusLabel}</span>
            <Button variant="ghost" size="icon" onClick={() => onDelete(column.id)} disabled={['novo-contato', 'aceito', 'perdido', 'convertido'].includes(column.id)} className="text-destructive hover:text-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 className="h-4 w-4" /></Button> {/* Added 'convertido' */}
        </div>
    );
}

export default function CrmSettings() {
    const { toast } = useToast();
    const { user, isLoading: isAuthLoading, currentEnvironmentDb } = useAuth(); // Get context
    const [newColumnName, setNewColumnName] = useState('');

    // Fetch Kanban columns from the current environment's DB
    const columns = useLiveQuery(async () => {
        if (!currentEnvironmentDb) return undefined;
        return await currentEnvironmentDb.kanbanColumns.orderBy('order').toArray();
    }, [currentEnvironmentDb]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

    // --- DB Operations using currentEnvironmentDb ---
    const handleAddColumn = async () => {
        if (!currentEnvironmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        if (!newColumnName.trim()) return;
        const newId = newColumnName.trim().toLowerCase().replace(/\s+/g, '-');
        const existing = await currentEnvironmentDb.kanbanColumns.get(newId);
        if (existing) return toast({ title: "Erro", description: "ID da etapa já existe.", variant: "destructive" });
        try {
            const currentColumns = await currentEnvironmentDb.kanbanColumns.orderBy('order').toArray();
            const newOrder = currentColumns.length > 0 ? currentColumns[currentColumns.length - 1].order + 1 : 0;
            const newColumn: KanbanColumn = { id: newId, statusLabel: newColumnName.trim(), order: newOrder };
            await currentEnvironmentDb.kanbanColumns.add(newColumn);
            setNewColumnName('');
            toast({ title: "Etapa Adicionada"});
             // LiveQuery updates list
        } catch (error) { console.error('Falha add etapa:', error); toast({ title: "Erro", variant: "destructive" }); }
    };

    const handleDeleteColumn = async (id: string) => {
         if (!currentEnvironmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        if (['novo-contato', 'aceito', 'perdido', 'convertido'].includes(id)) return toast({ title: "Ação Inválida", variant: "default" });
        const leadsInColumn = await currentEnvironmentDb.leads.where('kanbanColumnId').equals(id).count();
        if (leadsInColumn > 0) return toast({ title: "Erro", description: `Existem ${leadsInColumn} leads nesta etapa.`, variant: "destructive" });
        try {
            await currentEnvironmentDb.kanbanColumns.delete(id);
            // Re-order remaining
            const remainingColumns = await currentEnvironmentDb.kanbanColumns.orderBy('order').toArray();
            await currentEnvironmentDb.transaction('rw', currentEnvironmentDb.kanbanColumns, async () => {
                for (let i = 0; i < remainingColumns.length; i++) await currentEnvironmentDb.kanbanColumns.update(remainingColumns[i].id, { order: i });
            });
            toast({ title: "Etapa Excluída"});
             // LiveQuery updates list
        } catch (error) { console.error('Falha excluir etapa:', error); toast({ title: "Erro", variant: "destructive" }); }
    };

    const updateColumnOrder = async (newColumns: KanbanColumn[]) => {
         if (!currentEnvironmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        try {
            await currentEnvironmentDb.transaction('rw', currentEnvironmentDb.kanbanColumns, async () => {
                for (let i = 0; i < newColumns.length; i++) await currentEnvironmentDb.kanbanColumns.update(newColumns[i].id, { order: i });
            });
             // LiveQuery handles UI update
        } catch (error) { console.error("Falha reordenar:", error); toast({ title: "Erro Reordenar", variant: "destructive" }); }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id && over && columns) {
             const oldIndex = columns.findIndex((item) => item.id === active.id);
             const newIndex = columns.findIndex((item) => item.id === over.id);
             if (oldIndex === -1 || newIndex === -1) return;
            const newOrderedColumns = arrayMove(columns, oldIndex, newIndex);
            const finalColumns = newOrderedColumns.map((col, index) => ({ ...col, order: index }));
            updateColumnOrder(finalColumns);
            // No local state update needed
        }
    };

    // Render loading or different states
    if (isAuthLoading) {
        return <Card><CardContent className='p-6 flex items-center gap-2'><Loader2 className='h-5 w-5 animate-spin text-primary'/> Carregando...</CardContent></Card>;
    }
     if (user?.role === 'Admin') {
          return <Card><CardContent className='p-6 text-muted-foreground'>Administradores Globais não possuem configurações de CRM.</CardContent></Card>;
     }
    if (!currentEnvironmentDb) {
         return <Card><CardContent className='p-6 text-destructive'>Erro: Ambiente de dados não encontrado.</CardContent></Card>;
     }


    return (
        <div className="space-y-6">
            {/* Funnel Stages Management */}
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><List className="h-5 w-5" /> Etapas do Funil (Ambiente)</CardTitle><CardDescription>Gerencie as colunas do quadro Kanban deste ambiente.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input type="text" value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} placeholder="Nome da nova etapa" className="flex-grow" onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()} />
                        <Button onClick={handleAddColumn}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Etapa</Button>
                    </div>
                     {columns === undefined ? (
                         <p className='flex items-center gap-2 text-muted-foreground'><Loader2 className='h-4 w-4 animate-spin'/> Carregando etapas...</p>
                     ) : columns.length === 0 ? (
                         <p className="text-muted-foreground text-center pt-4">Nenhuma etapa encontrada.</p>
                     ) : (
                         <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                             <SortableContext items={columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                 <div className="space-y-2 max-h-72 overflow-y-auto p-1">
                                     {columns.map(col => (<SortableColumnItem key={col.id} column={col} onDelete={handleDeleteColumn} />))}
                                 </div>
                             </SortableContext>
                         </DndContext>
                     )}
                </CardContent>
            </Card>

            {/* Other CRM Settings (Placeholders) */}
             <Card>
                 <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Outras Configurações (Ambiente)</CardTitle><CardDescription>Origens de leads, modelos de proposta, etc.</CardDescription></CardHeader>
                 <CardContent><p className="text-muted-foreground">Outras configurações do CRM serão implementadas aqui.</p></CardContent>
             </Card>
        </div>
    );
}
