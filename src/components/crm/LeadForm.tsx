
'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type EnvironmentDB, type Lead, type KanbanColumn, Project } from '@/db/db'; // Import EnvironmentDB
import { useToast } from "@/hooks/use-toast";

// Definitions remain the same
const projectTypes: Project['projectType'][] = ['Commercial', 'Residential'];
const leadSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.string().optional(),
  projectType: z.enum(projectTypes).optional(),
  subType: z.string().optional(),
  responsible: z.string().optional(),
  notes: z.string().optional(),
  kanbanColumnId: z.string().min(1, 'Etapa do funil é obrigatória'),
});
type LeadFormData = z.infer<typeof leadSchema>;
const projectTypeMap: { [key in Project['projectType']]: string } = { 'Commercial': 'Comercial', 'Residential': 'Residencial' };

interface LeadFormProps {
  environmentDb: EnvironmentDB; // Accept the specific DB instance
  onSuccess: () => void;
  leadToEdit?: Lead | null;
  columns: KanbanColumn[];
}

export default function LeadForm({ environmentDb, onSuccess, leadToEdit, columns }: LeadFormProps) {
  const { toast } = useToast();
  const isEditMode = !!leadToEdit;
  const defaultColumnId = columns.find(col => col.order === 0)?.id || columns[0]?.id || ''; // Improved default column logic

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: { name: '', email: '', phone: '', source: '', projectType: undefined, subType: '', responsible: '', notes: '', kanbanColumnId: defaultColumnId },
  });

  useEffect(() => {
    const colId = leadToEdit?.kanbanColumnId || defaultColumnId;
    // Ensure the default/loaded columnId actually exists in the columns list
    const validKanbanColumnId = columns.some(c => c.id === colId) ? colId : defaultColumnId;

    if (isEditMode && leadToEdit) {
      form.reset({ name: leadToEdit.name, email: leadToEdit.email ?? '', phone: leadToEdit.phone ?? '', source: leadToEdit.source ?? '', projectType: leadToEdit.projectType, subType: leadToEdit.subType ?? '', responsible: leadToEdit.responsible ?? '', notes: leadToEdit.notes ?? '', kanbanColumnId: validKanbanColumnId });
    } else {
        form.reset({ name: '', email: '', phone: '', source: '', projectType: undefined, subType: '', responsible: '', notes: '', kanbanColumnId: defaultColumnId });
    }
  }, [leadToEdit, isEditMode, form, defaultColumnId, columns]);

  async function onSubmit(data: LeadFormData) {
    if (!environmentDb) {
        toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        return;
    }
    try {
      const leadDataToSave: Omit<Lead, 'id' | 'createdAt'> & { createdAt?: Date, id?: number } = {
        name: data.name, email: data.email || undefined, phone: data.phone || undefined, source: data.source || undefined, projectType: data.projectType, subType: data.subType || undefined, responsible: data.responsible || undefined, notes: data.notes || undefined, kanbanColumnId: data.kanbanColumnId,
        // environmentId removed
      };

      if (isEditMode && leadToEdit?.id !== undefined) {
        leadDataToSave.id = leadToEdit.id; leadDataToSave.createdAt = leadToEdit.createdAt;
        await environmentDb.leads.put(leadDataToSave as Lead); // Use put for update
        toast({ title: "Lead Atualizado"});
      } else {
        leadDataToSave.createdAt = new Date();
        await environmentDb.leads.add(leadDataToSave as Lead);
        toast({ title: "Lead Criado"});
      }
      form.reset({ name: '', email: '', phone: '', source: '', projectType: undefined, subType: '', responsible: '', notes: '', kanbanColumnId: defaultColumnId });
      onSuccess();
    } catch (error) {
      toast({ title: "Erro", description: `Falha ao ${isEditMode ? 'atualizar' : 'adicionar'} lead.`, variant: "destructive" });
      console.error(`Falha lead:`, error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome*</FormLabel><FormControl><Input placeholder="Nome cliente" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <FormField control={form.control} name="source" render={({ field }) => (<FormItem><FormLabel>Origem</FormLabel><FormControl><Input placeholder="Indicação..." {...field} /></FormControl><FormMessage /></FormItem>)} />
           <FormField control={form.control} name="kanbanColumnId" render={({ field }) => (<FormItem><FormLabel>Etapa*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione">{columns.find(col => col.id === field.value)?.statusLabel}</SelectValue></SelectTrigger></FormControl><SelectContent>{columns.map(column => (<SelectItem key={column.id} value={column.id}>{column.statusLabel}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <FormField control={form.control} name="projectType" render={({ field }) => (<FormItem><FormLabel>Tipo Projeto</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{projectTypes.map(type => (<SelectItem key={type} value={type}>{projectTypeMap[type]}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
           <FormField control={form.control} name="subType" render={({ field }) => (<FormItem><FormLabel>Subtipo</FormLabel><FormControl><Input placeholder="Interiores..." {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <FormField control={form.control} name="responsible" render={({ field }) => (<FormItem><FormLabel>Responsável</FormLabel><FormControl><Input placeholder="Nome responsável" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
        <Button type="submit" className="w-full mt-6" disabled={!environmentDb}>{isEditMode ? 'Salvar Alterações' : 'Criar Lead'}</Button>
      </form>
    </Form>
  );
}
