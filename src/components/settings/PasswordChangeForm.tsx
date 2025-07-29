
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { mainDb } from '@/db/db'; // Import mainDb
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth to get current user ID
import { Loader2, Shield } from 'lucide-react'; // Import icons

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'As novas senhas não coincidem',
  path: ['confirmPassword'], // Point error to the confirmation field
});

type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;

export default function PasswordChangeForm() {
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth(); // Get user from context
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handlePasswordChange = async (data: PasswordChangeFormData) => {
    if (!user || !user.userId) {
      toast({ title: 'Erro', description: 'Usuário não autenticado.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      // Fetch current user data from MainDB
      const currentUserData = await mainDb.users.get(user.userId);

      if (!currentUserData) {
        toast({ title: 'Erro', description: 'Usuário não encontrado no banco de dados.', variant: 'destructive' });
        setIsSaving(false);
        return;
      }

      // **SECURITY WARNING:** Comparing plaintext passwords. Implement hashing (e.g., bcrypt) in a real app.
      if (currentUserData.passwordHash !== data.currentPassword) {
        form.setError('currentPassword', { type: 'manual', message: 'Senha atual incorreta.' });
        toast({ title: 'Erro', description: 'Senha atual incorreta.', variant: 'destructive' });
        setIsSaving(false);
        return;
      }

      // **SECURITY WARNING:** Store the HASHED new password.
      const newPasswordHash = data.newPassword; // Replace with hashed password in production

      // Update password in MainDB
      await mainDb.users.update(user.userId, { passwordHash: newPasswordHash });

      toast({ title: 'Sucesso', description: 'Sua senha foi alterada com sucesso.' });
      form.reset(); // Clear the form

    } catch (error) {
      console.error('Falha ao alterar senha:', error);
      toast({ title: 'Erro', description: 'Ocorreu um erro ao tentar alterar sua senha.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthLoading) {
     return <Card><CardContent className='p-6 flex items-center gap-2'><Loader2 className='h-5 w-5 animate-spin text-primary'/> Carregando...</CardContent></Card>;
  }

  if (!user) {
      return <Card><CardContent className='p-6 text-muted-foreground'>Você precisa estar logado para alterar a senha.</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Alterar Senha</CardTitle>
        <CardDescription>Altere sua senha de acesso ao sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handlePasswordChange)} className="space-y-6">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha Atual*</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Digite sua senha atual" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova Senha*</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Nova Senha*</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Repita a nova senha" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSaving ? 'Salvando...' : 'Alterar Senha'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
