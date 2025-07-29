
"use client";

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'; // Import RadioGroup
import { type EnvironmentDB, type Project, getEnvironmentSettings } from '@/db/db'; // Import types and env settings function
import { useToast } from "@/hooks/use-toast";

// Project schema updated for billing type
const projectSchema = z.object({
  clientName: z.string().min(1, 'Nome do cliente é obrigatório'),
  description: z.string().min(1, 'Descrição do projeto é obrigatória'),
  projectType: z.enum(['Commercial', 'Residential']),
  subType: z.string().optional(),
  status: z.enum(['Pendente', 'Em Andamento', 'Concluído', 'Atrasado']),
  billingType: z.enum(['fixed', 'hourly'], { required_error: "Tipo de cobrança é obrigatório" }),
  hourlyRate: z.coerce.number().optional(), // Optional now
  totalValue: z.coerce.number().optional(), // Optional now
}).refine(data => {
    // Require hourlyRate if billingType is 'hourly'
    if (data.billingType === 'hourly' && (data.hourlyRate === undefined || data.hourlyRate <= 0)) return false;
    return true;
}, { message: "Valor por hora é obrigatório para cobrança por hora.", path: ["hourlyRate"] })
  .refine(data => {
    // Require totalValue if billingType is 'fixed'
    if (data.billingType === 'fixed' && (data.totalValue === undefined || data.totalValue <= 0)) return false;
    return true;
}, { message: "Valor total é obrigatório para cobrança com valor fechado.", path: ["totalValue"] });


type ProjectFormData = z.infer<typeof projectSchema>;

// Type/Status mappings remain the same
const projectTypeMap: { [key in Project['projectType']]: string } = { 'Commercial': 'Comercial', 'Residential': 'Residencial' };
const statusMap: { [key in Project['status']]: string } = { 'Pendente': 'Pendente', 'Em Andamento': 'Em Andamento', 'Concluído': 'Concluído', 'Atrasado': 'Atrasado' };
const projectTypeKeys = Object.keys(projectTypeMap) as Project['projectType'][];
const statusKeys = Object.keys(statusMap) as Project['status'][];

interface ProjectFormProps {
  environmentDb: EnvironmentDB; // Accept the specific DB instance
  onProjectAddedOrUpdated: () => void;
  projectToEdit?: Project | null;
}

export default function ProjectForm({ environmentDb, onProjectAddedOrUpdated, projectToEdit }: ProjectFormProps) {
  const { toast } = useToast();
  const isEditMode = !!projectToEdit;
  const [defaultHourlyRate, setDefaultHourlyRate] = useState<number | undefined>(undefined);
  // Determine if editing is allowed based on status (cannot edit after start)
  const isBillingEditable = !isEditMode || (projectToEdit?.status === 'Pendente');


  // Fetch environment-specific settings using the passed DB instance
   useEffect(() => {
        const loadDefaultRate = async () => {
            if (environmentDb) { // Check if DB instance is available
                try {
                    const settings = await getEnvironmentSettings(environmentDb);
                    setDefaultHourlyRate(settings.defaultHourlyRate ?? 100); // Use environment default or fallback
                } catch (error) {
                     console.error("Failed to load environment settings:", error);
                     setDefaultHourlyRate(100); // Fallback on error
                }
            } else {
                console.warn("ProjectForm: environmentDb not provided yet.");
                 setDefaultHourlyRate(100); // Fallback if DB not ready
            }
        };
        loadDefaultRate();
    }, [environmentDb]); // Re-run when environmentDb changes


  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    // Set initial default billingType, others are conditional or set in useEffect
    defaultValues: { clientName: '', description: '', projectType: 'Residential', subType: '', status: 'Pendente', billingType: 'hourly', hourlyRate: 0, totalValue: 0 },
  });

   // Populate form or set default rate/type
   useEffect(() => {
       if (isEditMode && projectToEdit) {
            form.reset({
                 clientName: projectToEdit.clientName,
                 description: projectToEdit.description,
                 projectType: projectToEdit.projectType,
                 subType: projectToEdit.subType ?? '',
                 status: projectToEdit.status,
                 billingType: projectToEdit.billingType,
                 hourlyRate: projectToEdit.hourlyRate ?? defaultHourlyRate ?? 0, // Populate if exists, else default
                 totalValue: projectToEdit.totalValue ?? 0, // Populate if exists
            });
       } else {
           // Set default rate for new projects only when it's loaded and not editing
           if (defaultHourlyRate !== undefined && !isEditMode) {
               form.reset({
                    clientName: '', description: '', projectType: 'Residential', subType: '', status: 'Pendente',
                    billingType: 'hourly', // Default to hourly for new projects
                    hourlyRate: defaultHourlyRate,
                    totalValue: 0,
               });
           }
       }
   }, [projectToEdit, isEditMode, form, defaultHourlyRate]); // Add defaultHourlyRate dependency

   const billingType = form.watch('billingType'); // Watch billingType field

  async function onSubmit(data: ProjectFormData) {
    if (!environmentDb) {
        toast({ title: "Erro", description: "Conexão com o banco de dados do ambiente não estabelecida.", variant: "destructive" });
        return;
    }
    try {
        const projectDataToSave: Omit<Project, 'id' | 'createdAt'> & { createdAt?: Date, id?: number } = {
             ...data,
             subType: data.subType || undefined,
             hourlyRate: data.billingType === 'hourly' ? data.hourlyRate : undefined, // Only save if type is hourly
             totalValue: data.billingType === 'fixed' ? data.totalValue : undefined, // Only save if type is fixed
             // Removed environmentId, it's implicit
        };

        if (isEditMode && projectToEdit?.id !== undefined) {
             if (!isBillingEditable) {
                 // If editing an existing project that's started, don't allow changing billing type
                 projectDataToSave.billingType = projectToEdit.billingType;
                 projectDataToSave.hourlyRate = projectToEdit.hourlyRate;
                 projectDataToSave.totalValue = projectToEdit.totalValue;
             }
            projectDataToSave.id = projectToEdit.id;
            projectDataToSave.createdAt = projectToEdit.createdAt; // Keep original date
            await environmentDb.projects.put(projectDataToSave as Project); // Use put for update
            toast({ title: "Projeto Atualizado", description: `Projeto "${data.clientName}" atualizado.` });
        } else {
            projectDataToSave.createdAt = new Date();
            await environmentDb.projects.add(projectDataToSave as Project);
            toast({ title: "Projeto Criado", description: `Projeto "${data.clientName}" adicionado.` });
        }
        // Reset form with default rate for potential next creation
        form.reset({ clientName: '', description: '', projectType: 'Residential', subType: '', status: 'Pendente', billingType: 'hourly', hourlyRate: defaultHourlyRate ?? 0, totalValue: 0 });
        onProjectAddedOrUpdated();
    } catch (error) {
       toast({ title: "Erro", description: `Falha ao ${isEditMode ? 'atualizar' : 'adicionar'} projeto.`, variant: "destructive", });
       console.error(`Falha ao ${isEditMode ? 'atualizar' : 'adicionar'} projeto:`, error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="clientName" render={({ field }) => (<FormItem><FormLabel>Nome do Cliente</FormLabel><FormControl><Input placeholder="Digite o nome do cliente" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descrição do Projeto</FormLabel><FormControl><Textarea placeholder="Descreva o projeto" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <FormField control={form.control} name="projectType" render={({ field }) => (<FormItem><FormLabel>Tipo de Projeto</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger></FormControl><SelectContent>{projectTypeKeys.map(key => (<SelectItem key={key} value={key}>{projectTypeMap[key]}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
           <FormField control={form.control} name="subType" render={({ field }) => (<FormItem><FormLabel>Subtipo (Opcional)</FormLabel><FormControl><Input placeholder="ex: Interiores, Paisagismo" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
        </div>
         <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isEditMode} /* Disable status change in edit mode via form */ ><FormControl><SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger></FormControl><SelectContent>{statusKeys.map(key => (<SelectItem key={key} value={key}>{statusMap[key]}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />

        {/* Billing Type Selection */}
        <FormField
          control={form.control}
          name="billingType"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Tipo de Cobrança*</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
                  disabled={!isBillingEditable} // Disable if not editable
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="hourly" />
                    </FormControl>
                    <FormLabel className="font-normal">Por Hora Trabalhada</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="fixed" />
                    </FormControl>
                    <FormLabel className="font-normal">Valor Fechado</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
                {!isBillingEditable && <p className="text-xs text-muted-foreground">O tipo de cobrança não pode ser alterado após o início do projeto.</p>}
            </FormItem>
          )}
        />

        {/* Conditional Fields based on Billing Type */}
        {billingType === 'hourly' && (
             <FormField control={form.control} name="hourlyRate" render={({ field }) => (<FormItem><FormLabel>Valor por Hora (R$)*</FormLabel><FormControl><Input type="number" step="0.01" min="0.01" placeholder="150.00" {...field} disabled={!isBillingEditable} /></FormControl><FormMessage /></FormItem>)} />
        )}
         {billingType === 'fixed' && (
              <FormField control={form.control} name="totalValue" render={({ field }) => (<FormItem><FormLabel>Valor Total do Projeto (R$)*</FormLabel><FormControl><Input type="number" step="0.01" min="0.01" placeholder="35000.00" {...field} disabled={!isBillingEditable} /></FormControl><FormMessage /></FormItem>)} />
         )}

        <Button type="submit" className="w-full" disabled={!environmentDb}>{isEditMode ? 'Atualizar Projeto' : 'Adicionar Projeto'}</Button>
      </form>
    </Form>
  );
}

