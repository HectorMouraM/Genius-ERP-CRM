
"use client";

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type StageTemplate } from '@/db/db'; // Import EnvironmentDB
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, GripVertical, Layers, Loader2 } from 'lucide-react'; // Added Loader2
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

// SortableTemplateItemProps remains the same
interface SortableTemplateItemProps { template: StageTemplate; onDelete: (id: number) => void; }
function SortableTemplateItem({ template, onDelete }: SortableTemplateItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: template.id! });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 'auto' };
    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 border rounded-md bg-card hover:bg-muted/50">
            <button {...attributes} {...listeners} className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground"><GripVertical className="h-5 w-5" /></button>
            <span className="flex-grow">{template.name}</span>
            <Button variant="ghost" size="icon" onClick={() => onDelete(template.id!)} className="text-destructive hover:text-destructive/10"><Trash2 className="h-4 w-4" /></Button>
        </div>
    );
}

export default function StageTemplateManagement() {
    const { toast } = useToast();
    const { user, isLoading: isAuthLoading, currentEnvironmentDb } = useAuth(); // Get context
    const [newTemplateName, setNewTemplateName] = useState('');

    // Fetch templates from the current environment's DB using useLiveQuery
    const templates = useLiveQuery(async () => {
        if (!currentEnvironmentDb) return undefined; // Wait for DB instance
        return await currentEnvironmentDb.stageTemplates.orderBy('order').toArray();
    }, [currentEnvironmentDb]); // Dependency on the DB instance

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

    // --- DB Operations using currentEnvironmentDb ---
    const handleAddTemplate = async () => {
        if (!currentEnvironmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        if (!newTemplateName.trim()) return;
        try {
            const currentTemplates = await currentEnvironmentDb.stageTemplates.orderBy('order').toArray();
            const newOrder = currentTemplates.length > 0 ? currentTemplates[currentTemplates.length - 1].order + 1 : 0;
            const newTemplate: Omit<StageTemplate, 'id'> = { name: newTemplateName.trim(), order: newOrder }; // Use Omit
            await currentEnvironmentDb.stageTemplates.add(newTemplate as StageTemplate); // Cast for add
            setNewTemplateName('');
            toast({ title: "Modelo Adicionado"});
            // LiveQuery updates the list
        } catch (error) { console.error('Falha add modelo:', error); toast({ title: "Erro", variant: "destructive" }); }
    };

    const handleDeleteTemplate = async (id: number) => {
        if (!currentEnvironmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        try {
            await currentEnvironmentDb.stageTemplates.delete(id);
            // Re-order remaining
            const remainingTemplates = await currentEnvironmentDb.stageTemplates.orderBy('order').toArray();
            await currentEnvironmentDb.transaction('rw', currentEnvironmentDb.stageTemplates, async () => {
                for (let i = 0; i < remainingTemplates.length; i++) await currentEnvironmentDb.stageTemplates.update(remainingTemplates[i].id!, { order: i });
            });
            toast({ title: "Modelo Excluído"});
             // LiveQuery updates the list
        } catch (error) { console.error('Falha excluir modelo:', error); toast({ title: "Erro", variant: "destructive" }); }
    };

    const updateTemplateOrder = async (newTemplates: StageTemplate[]) => {
        if (!currentEnvironmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        try {
            await currentEnvironmentDb.transaction('rw', currentEnvironmentDb.stageTemplates, async () => {
                for (let i = 0; i < newTemplates.length; i++) await currentEnvironmentDb.stageTemplates.update(newTemplates[i].id!, { order: i });
            });
             // LiveQuery handles UI update
        } catch (error) { console.error("Falha reordenar:", error); toast({ title: "Erro Reordenar", variant: "destructive" }); }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id && over && templates) {
             const oldIndex = templates.findIndex((item) => item.id === active.id);
             const newIndex = templates.findIndex((item) => item.id === over.id);
             if (oldIndex === -1 || newIndex === -1) return;
            const newOrderedTemplates = arrayMove(templates, oldIndex, newIndex);
            const finalTemplates = newOrderedTemplates.map((t, i) => ({ ...t, order: i }));
            updateTemplateOrder(finalTemplates);
            // No local state update needed, rely on useLiveQuery
        }
    };

    // Render loading or different states
    if (isAuthLoading) {
        return <Card><CardContent className='p-6 flex items-center gap-2'><Loader2 className='h-5 w-5 animate-spin text-primary'/> Carregando...</CardContent></Card>;
    }
     if (user?.role === 'Admin') {
          return <Card><CardContent className='p-6 text-muted-foreground'>Administradores Globais gerenciam configurações por ambiente na tela de Ambientes.</CardContent></Card>;
     }
    if (!currentEnvironmentDb) {
         return <Card><CardContent className='p-6 text-destructive'>Erro: Ambiente de dados não encontrado.</CardContent></Card>;
     }


    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Modelos de Etapa (Ambiente)</CardTitle>
                <CardDescription>Modelos de etapas reutilizáveis para projetos neste ambiente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input type="text" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Nome do novo modelo" className="flex-grow" onKeyDown={(e) => e.key === 'Enter' && handleAddTemplate()} />
                    <Button onClick={handleAddTemplate}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Modelo</Button>
                </div>

                {templates === undefined ? (
                     <p className='flex items-center gap-2 text-muted-foreground'><Loader2 className='h-4 w-4 animate-spin'/> Carregando modelos...</p>
                 ) : templates.length === 0 ? (
                     <p className="text-muted-foreground text-center pt-4">Nenhum modelo criado ainda.</p>
                 ) : (
                     <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                         <SortableContext items={templates.map(t => t.id!)} strategy={verticalListSortingStrategy}>
                             <div className="space-y-2 max-h-96 overflow-y-auto p-1">
                                 {templates.map(template => (template.id !== undefined ? (<SortableTemplateItem key={template.id} template={template} onDelete={handleDeleteTemplate} />) : null))}
                             </div>
                         </SortableContext>
                     </DndContext>
                 )}
            </CardContent>
        </Card>
    );
}
