
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { mainDb, type User, type UserRole, type UserStatus, type Environment } from '@/db/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash2, MoreHorizontal, LockKeyhole, UserCheck, UserX, Loader2, ArrowLeft, Briefcase, Target, ShieldCheck } from 'lucide-react'; // Added ArrowLeft, Target, ShieldCheck
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link'; // Import Link
import { cn } from '@/lib/utils'; // Import cn utility function

// Zod schema for user form validation (specific to environment user management)
const userSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    email: z.string().email('E-mail inválido'),
    jobTitle: z.string().optional(),
    role: z.enum(['Padrão', 'Gerente', 'Proprietário', 'CRM']), // Only assignable roles within an environment, added CRM
    status: z.enum(['Ativo', 'Inativo']).optional(), // Handled separately
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
    confirmPassword: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, { message: "As senhas não coincidem", path: ["confirmPassword"], })
  .refine(data => !data.password || data.password.length >= 6, { message: "Nova senha deve ter pelo menos 6 caracteres.", path: ["password"], });

type UserFormData = z.infer<typeof userSchema>;

// Assignable roles within an environment
const assignableRoles: Exclude<UserRole, 'Admin'>[] = ['Padrão', 'Gerente', 'Proprietário', 'CRM']; // Added CRM
const roleMap: { [key in UserRole]: string } = {
    'Padrão': 'Padrão',
    'Gerente': 'Gerente',
    'Proprietário': 'Proprietário',
    'Admin': 'Admin Global',
    'CRM': 'CRM', // Added CRM mapping
};
const statusMap: { [key in UserStatus]: string } = { 'Ativo': 'Ativo', 'Inativo': 'Inativo', };
const getStatusVariant = (status: UserStatus): "default" | "secondary" => status === 'Ativo' ? 'default' : 'secondary';

// Get icon for role
const getRoleIcon = (role: UserRole) => {
    switch (role) {
        case 'Proprietário': return <Briefcase className="h-4 w-4 inline-block mr-1" />;
        case 'Gerente': return <Briefcase className="h-4 w-4 inline-block mr-1" />;
        case 'CRM': return <Target className="h-4 w-4 inline-block mr-1" />;
        case 'Padrão': return <UserCheck className="h-4 w-4 inline-block mr-1" />;
        case 'Admin': return <ShieldCheck className="h-4 w-4 inline-block mr-1" />; // Added Admin Icon
        default: return null;
    }
};

export default function EnvironmentUsersPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const environmentIdStr = params?.environmentId as string;
    const environmentId = environmentIdStr ? parseInt(environmentIdStr, 10) : undefined;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch the specific environment details
    const environment = useLiveQuery(async () => {
        if (!environmentId) return undefined;
        return await mainDb.environments.get(environmentId);
    }, [environmentId]);

    // Fetch users for this specific environment
    const users = useLiveQuery(async () => {
        if (!environmentId) return [];
        return await mainDb.users.where('environmentId').equals(environmentId).sortBy('name');
    }, [environmentId]);

    // Filter users based on search term
    const filteredUsers = useMemo(() => {
        if (!users) return [];
        return users.filter(user =>
            user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.jobTitle && user.jobTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
            roleMap[user.role].toLowerCase().includes(searchTerm.toLowerCase()) // Search by role name
        );
    }, [users, searchTerm]);

    const form = useForm<UserFormData>({ resolver: zodResolver(userSchema), defaultValues: { name: '', email: '', jobTitle: '', role: 'Padrão', password: '', confirmPassword: '' }, });

    useEffect(() => {
        if (userToEdit) {
            form.reset({ name: userToEdit.name, email: userToEdit.email, jobTitle: userToEdit.jobTitle ?? '', role: userToEdit.role as Exclude<UserRole, 'Admin'>, password: '', confirmPassword: '' });
        } else {
            form.reset({ name: '', email: '', jobTitle: '', role: 'Padrão', password: '', confirmPassword: '' });
        }
    }, [userToEdit, form]);

    const openModal = (user: User | null = null) => { setUserToEdit(user); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setUserToEdit(null); form.reset(); };

    const handleFormSubmit = async (data: UserFormData) => {
        if (!environmentId) { toast({ title: "Erro", description: "ID do ambiente inválido.", variant: "destructive" }); return; }
        try {
            if (userToEdit?.id) {
                // --- Edit User ---
                const updates: Partial<User> = { name: data.name, role: data.role, jobTitle: data.jobTitle || undefined, };
                if (data.password) { updates.passwordHash = data.password; /* **SECURITY WARNING: HASH THIS** */ }
                await mainDb.users.update(userToEdit.id, updates);
                toast({ title: "Usuário Atualizado"});
            } else {
                // --- Create User ---
                if (!data.password) { form.setError("password", { type: "manual", message: "Senha é obrigatória para novos usuários." }); return; }
                const existingUser = await mainDb.users.get({ email: data.email });
                if (existingUser) { form.setError("email", { type: "manual", message: "E-mail já em uso." }); toast({ title: "Erro", description: "E-mail já cadastrado.", variant: "destructive" }); return; }

                const passwordHash = data.password; // **SECURITY WARNING: HASH THIS**
                const newUser: Omit<User, 'id'> = { name: data.name, email: data.email, passwordHash: passwordHash, jobTitle: data.jobTitle || undefined, role: data.role, status: 'Ativo', environmentId: environmentId, createdAt: new Date(), };
                await mainDb.users.add(newUser as User);
                toast({ title: "Usuário Criado" });
            }
            closeModal();
        } catch (error: any) { console.error("Falha ao salvar usuário:", error); if (error.name === 'ConstraintError') { form.setError('email', { type: 'manual', message: 'E-mail já em uso.' }); toast({ title: "Erro de E-mail", variant: "destructive" }); } else { toast({ title: "Erro ao Salvar", variant: "destructive" }); } }
    };

    const toggleUserStatus = async (user: User) => { if (!user.id || user.role === 'Admin') return; const newStatus: UserStatus = user.status === 'Ativo' ? 'Inativo' : 'Ativo'; try { await mainDb.users.update(user.id, { status: newStatus }); toast({ title: "Status Atualizado" }); } catch (error) { console.error("Falha atualizar status:", error); toast({ title: "Erro Status", variant: "destructive" }); } };
    const handleDeleteUser = async (user: User) => { if (!user.id || user.role === 'Admin') return; if (window.confirm(`Excluir ${user.name} (${user.email}) deste ambiente?`)) { try { await mainDb.users.delete(user.id); toast({ title: "Usuário Removido" }); } catch (error) { console.error("Falha excluir usuário:", error); toast({ title: "Erro Excluir", variant: "destructive" }); } } };
    const handleResetPassword = async (user: User) => { if (!user.id) return; const newPassword = prompt(`Nova senha para ${user.name} (mín. 6 caracteres):`); if (newPassword && newPassword.length >= 6) { try { const newPasswordHash = newPassword; /* **SECURITY WARNING: HASH THIS** */ await mainDb.users.update(user.id, { passwordHash: newPasswordHash }); toast({ title: "Senha Redefinida" }); } catch (error) { console.error("Falha redefinir senha:", error); toast({ title: "Erro Senha", variant: "destructive" }); } } else if (newPassword !== null) { toast({ title: "Senha Inválida", variant: "destructive" }); } };

    if (!environmentId) {
        return <div className="container mx-auto p-4 md:p-6 lg:p-8 text-destructive">ID do Ambiente inválido ou não fornecido.</div>;
    }
    if (environment === undefined) {
        return <div className="container mx-auto p-4 md:p-6 lg:p-8 text-center flex justify-center items-center gap-2"><Loader2 className='h-5 w-5 animate-spin' /> Carregando dados do ambiente...</div>;
    }
    if (environment === null) {
        return <div className="container mx-auto p-4 md:p-6 lg:p-8 text-destructive">Ambiente não encontrado.</div>;
    }


    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <header className="flex justify-between items-center mb-6">
                <div>
                   <Button variant="outline" size="sm" asChild>
                       <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos Ambientes</Link>
                   </Button>
                   <h1 className="text-2xl font-bold mt-2">Usuários do Ambiente: {environment.name}</h1>
                   <p className="text-muted-foreground">Gerencie os colaboradores que têm acesso a este ambiente.</p>
                </div>
                <Button onClick={() => openModal()}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Colaborador</Button>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Lista de Usuários ({filteredUsers.length})</CardTitle>
                    <Input type="search" placeholder="Buscar por nome, e-mail, cargo, permissão..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead>E-mail</TableHead>
                                    <TableHead>Permissão</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Criado Em</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users === undefined && (<TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>)}
                                {users && filteredUsers.length === 0 && (<TableRow><TableCell colSpan={7} className="h-24 text-center">Nenhum usuário encontrado neste ambiente{searchTerm ? ' com os filtros aplicados' : ''}.</TableCell></TableRow>)}
                                {filteredUsers?.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>{user.jobTitle ?? '-'}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell className="flex items-center gap-1">
                                            {getRoleIcon(user.role)}
                                            {roleMap[user.role]}
                                        </TableCell>
                                        <TableCell><Badge variant={getStatusVariant(user.status)}>{statusMap[user.status]}</Badge></TableCell>
                                        <TableCell>{user.createdAt ? format(user.createdAt, 'P', { locale: ptBR }) : 'N/A'}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Abrir menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Ações do Usuário</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => openModal(user)}><Edit className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => toggleUserStatus(user)}>{user.status === 'Ativo' ? <UserX className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />} {user.status === 'Ativo' ? 'Desativar' : 'Ativar'}</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleResetPassword(user)}><LockKeyhole className="mr-2 h-4 w-4" /> Redefinir Senha</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {/* Prevent deletion of the environment owner */}
                                                     <DropdownMenuItem
                                                        onClick={() => handleDeleteUser(user)}
                                                        disabled={user.role === 'Proprietário'}
                                                        className={cn("text-destructive focus:text-destructive focus:bg-destructive/10", user.role === 'Proprietário' && "opacity-50 cursor-not-allowed")}
                                                    >
                                                       <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* User Form Dialog */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle>{userToEdit ? 'Editar Usuário' : 'Adicionar Novo Colaborador'}</DialogTitle>
                        <DialogDescription>{userToEdit ? `Edite os dados de ${userToEdit.name}.` : `Adicione um novo colaborador ao ambiente ${environment.name}.`}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome Completo*</FormLabel><FormControl><Input placeholder="Nome do colaborador" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="jobTitle" render={({ field }) => (<FormItem><FormLabel>Cargo/Função</FormLabel><FormControl><Input placeholder="Ex: Arquiteto Jr." {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>E-mail*</FormLabel><FormControl><Input type="email" placeholder="email@empresa.com" {...field} disabled={!!userToEdit} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="role" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Permissão*</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={userToEdit?.role === 'Proprietário'} // Can't change owner's role
                                    >
                                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {assignableRoles.map(role => (
                                                <SelectItem key={role} value={role} disabled={role === 'Proprietário' && !userToEdit}> {/* Prevent assigning new owner */}
                                                    {getRoleIcon(role)}
                                                    {roleMap[role]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                             )} />
                            <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>{userToEdit ? 'Nova Senha (Opcional)' : 'Senha Inicial*'}</FormLabel><FormControl><Input type="password" placeholder={userToEdit ? 'Deixe em branco para não alterar' : 'Mínimo 6 caracteres'} {...field} /></FormControl><FormMessage /></FormItem>)} />
                            {form.watch('password') && (<FormField control={form.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirmar Senha*</FormLabel><FormControl><Input type="password" placeholder="Repita a senha" {...field} /></FormControl><FormMessage /></FormItem>)} />)}
                            <DialogFooter className='pt-4'>
                                <DialogClose asChild><Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button></DialogClose>
                                <Button type="submit">{userToEdit ? 'Salvar Alterações' : 'Adicionar Colaborador'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
