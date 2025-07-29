
'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type EnvironmentDB, type Interaction, type Lead } from '@/db/db'; // Import EnvironmentDB
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle } from 'lucide-react';

// Define interaction types
const interactionTypes: Interaction['type'][] = ['ligação', 'visita', 'reunião', 'anotação', 'email'];

const interactionSchema = z.object({
  type: z.enum(interactionTypes),
  details: z.string().min(1, 'Detalhes são obrigatórios'),
});

type InteractionFormData = z.infer<typeof interactionSchema>;

interface InteractionFormProps {
  environmentDb: EnvironmentDB; // Require the environment DB instance
  leadId: number;
  onSuccess?: () => void; // Optional callback after adding
}

export default function InteractionForm({ environmentDb, leadId, onSuccess }: InteractionFormProps) {
  const { toast } = useToast();

  const form = useForm<InteractionFormData>({
    resolver: zodResolver(interactionSchema),
    defaultValues: {
      type: 'anotação', // Default type
      details: '',
    },
  });

  async function onSubmit(data: InteractionFormData) {
     if (!environmentDb) {
        toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        return;
     }
    try {
      const newInteraction: Omit<Interaction, 'id'> = {
        leadId: leadId,
        type: data.type,
        date: new Date(),
        details: data.details.trim(),
      };
      // Use the passed environmentDb instance
      await environmentDb.interactions.add(newInteraction as Interaction);
      form.reset(); // Reset form after successful submission
      toast({ title: "Sucesso", description: "Interação adicionada." });
      onSuccess?.(); // Call success callback if provided
    } catch (error) {
      console.error("Falha ao adicionar interação:", error);
      toast({ title: "Erro", description: "Não foi possível adicionar a interação.", variant: "destructive" });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 border p-3 rounded-md">
         <div className="flex flex-col sm:flex-row gap-2 items-end">
           <FormField
             control={form.control}
             name="type"
             render={({ field }) => (
               <FormItem className="flex-grow w-full sm:w-auto">
                 <FormLabel>Tipo</FormLabel>
                 <Select onValueChange={field.onChange} value={field.value}>
                   <FormControl>
                     <SelectTrigger>
                       <SelectValue placeholder="Selecione o tipo" />
                     </SelectTrigger>
                   </FormControl>
                   <SelectContent>
                     {interactionTypes.map(type => (
                       <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
                 <FormMessage />
               </FormItem>
             )}
           />
           <FormField
             control={form.control}
             name="details"
             render={({ field }) => (
               <FormItem className="flex-grow-[3] w-full sm:w-auto">
                 <FormLabel>Detalhes*</FormLabel>
                 <FormControl>
                   <Textarea
                     placeholder="Descreva a interação..."
                     rows={2}
                     className="min-h-[40px]"
                     {...field}
                   />
                 </FormControl>
                 <FormMessage />
               </FormItem>
             )}
           />
            <Button type="submit" size="sm" className="w-full sm:w-auto self-end" disabled={!environmentDb}>
                 <PlusCircle className="mr-2 h-4 w-4"/> Adicionar
             </Button>
         </div>
      </form>
    </Form>
  );
}

  