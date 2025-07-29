
'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type EnvironmentDB, type Appointment, type Lead } from '@/db/db'; // Import EnvironmentDB
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle } from 'lucide-react';

const appointmentSchema = z.object({
  dateTime: z.string().min(1, 'Data e hora são obrigatórias'), // Use string for datetime-local input
  description: z.string().min(1, 'Descrição é obrigatória'),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  environmentDb: EnvironmentDB; // Require the environment DB instance
  leadId: number;
  onSuccess?: () => void; // Optional callback after adding
}

export default function AppointmentForm({ environmentDb, leadId, onSuccess }: AppointmentFormProps) {
  const { toast } = useToast();

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      dateTime: '',
      description: '',
    },
  });

  async function onSubmit(data: AppointmentFormData) {
    if (!environmentDb) {
      toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
      return;
    }
    try {
      const newAppointment: Omit<Appointment, 'id'> = {
        leadId: leadId,
        dateTime: new Date(data.dateTime), // Convert string to Date
        description: data.description.trim(),
        status: 'Pendente', // Default status
      };
      // Use the passed environmentDb instance
      await environmentDb.appointments.add(newAppointment as Appointment);
      form.reset(); // Reset form after successful submission
      toast({ title: "Sucesso", description: "Agendamento adicionado." });
      onSuccess?.(); // Call success callback if provided
    } catch (error) {
      console.error("Falha ao adicionar agendamento:", error);
      toast({ title: "Erro", description: "Não foi possível adicionar o agendamento.", variant: "destructive" });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 border p-3 rounded-md">
         <div className="flex flex-col sm:flex-row gap-2 items-end">
            <FormField
                control={form.control}
                name="dateTime"
                render={({ field }) => (
                <FormItem className="flex-grow w-full sm:w-auto">
                    <FormLabel>Data e Hora*</FormLabel>
                    <FormControl>
                    <Input
                        type="datetime-local"
                        {...field}
                    />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                <FormItem className="flex-grow-[2] w-full sm:w-auto">
                    <FormLabel>Descrição*</FormLabel>
                    <FormControl>
                    <Input
                        placeholder="Ex: Reunião de apresentação"
                        {...field}
                    />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <Button type="submit" size="sm" className="w-full sm:w-auto self-end" disabled={!environmentDb}>
               <PlusCircle className="mr-2 h-4 w-4"/> Agendar
            </Button>
         </div>
      </form>
    </Form>
  );
}

  