
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { mainDb, type User, type UserRole, type UserStatus, type Environment } from '@/db/db'; // Import from MainDB
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
// Corrected icon import: Added ShieldCheck
import { PlusCircle, Edit, Trash2, MoreHorizontal, LockKeyhole, UserCheck, UserX, Building, Loader2, Briefcase, Target, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils'; // Import cn

// Zod schema for user form validation (interacts with MainDB)
const userSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    email: z.string().email('E-mail inválido'),
    jobTitle: z.string().optional(), // Added Job Title
    role: z.enum(['Padrão', 'Gerente', 'Proprietário', 'Admin', 'CRM']), // Added CRM
    status: z.enum(['Ativo', 'Inativo']).optional(), // Handled separately
    environmentId: z.coerce.number().int().positive('Selecione um ambiente').optional(), // Environment is optional ONLY for Admin role
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
    confirmPassword: z.string().optional(),
}).refine(data => {
    // Environment is required if role is not Admin
    if (data.role !== 'Admin' && !data.environmentId) return false;
    return true;
}, { message: "Ambiente é obrigatório para este tipo de usuário.", path: ["environmentId"], })
  .refine(data => data.password === data.confirmPassword, { message: "As senhas não coincidem", path: ["confirmPassword"], })
  .refine(data => !data.password || data.password.length >= 6, { message: "Nova senha deve ter pelo menos 6 caracteres.", path: ["password"], });


type UserFormData = z.infer<typeof userSchema>;

// Role Map
const assignableRoles: Exclude<UserRole, 'Admin'>[] = ['Padrão', 'Gerente', 'Proprietário', 'CRM']; // Added CRM
const roleMap: { [key in UserRole]: string } = {
    'Padrão': 'Padrão',
    'Gerente': 'Gerente',
    'Proprietário': 'Proprietário',
    'Admin': 'Admin Global',
    'CRM': 'CRM', // Added CRM
};

// Status Map and variants
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


export default function UserManagement() {
    const { toast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEnvironmentFilter, setSelectedEnvironmentFilter] = useState<string>('all'); // 'all', 'admin', or environmentId as string

    // Fetch all users and environments from MainDB
    const allUsers = useLiveQuery(() => mainDb.users.orderBy('name').toArray());
    const environments = useLiveQuery(() => mainDb.environments.orderBy('name').toArray());

    // Memoize environments map for quick lookup
    const environmentsMap = useMemo(() => {
        const map = new Map<number, string>();
        environments?.forEach(env => map.set(env.id!, env.name));
        return map;
    }, [environments]);

    // Filter users
    const filteredUsers = useMemo(() => {
        if (!allUsers) return [];
        return allUsers.filter(user => {
            const matchesSearch = searchTerm === '' ||
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.jobTitle && user.jobTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
                roleMap[user.role].toLowerCase().includes(searchTerm.toLowerCase()); // Search by role name

            const isAdminUser = user.role === 'Admin';
            const matchesAdminFilter = selectedEnvironmentFilter === 'admin';
            const matchesSpecificEnv = selectedEnvironmentFilter !== 'all' && selectedEnvironmentFilter !== 'admin' && user.environmentId?.toString() === selectedEnvironmentFilter;
            const matchesAll = selectedEnvironmentFilter === 'all';

            if (isAdminUser) return matchesSearch && (matchesAdminFilter || matchesAll);
            return matchesSearch && (matchesAll || matchesSpecificEnv);
        });
    }, [allUsers, searchTerm, selectedEnvironmentFilter]);

    const form = useForm<UserFormData>({ resolver: zodResolver(userSchema), defaultValues: { name: '', email: '', jobTitle: '', role: 'Padrão', environmentId: undefined, password: '', confirmPassword: '' }, });

    useEffect(() => {
        if (userToEdit) {
            form.reset({ name: userToEdit.name, email: userToEdit.email, jobTitle: userToEdit.jobTitle ?? '', role: userToEdit.role, environmentId: userToEdit.environmentId, password: '', confirmPassword: '' });
        } else {
            form.reset({ name: '', email: '', jobTitle: '', role: 'Padrão', environmentId: undefined, password: '', confirmPassword: '' });
        }
    }, [userToEdit, form]);

    const openModal = (user: User | null = null) => { setUserToEdit(user); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setUserToEdit(null); form.reset(); };

    const handleFormSubmit = async (data: UserFormData) => {
        try {
            // Prevent assigning Admin role manually
            if (data.role === 'Admin') { form.setError("role", { type: "manual", message: "Não é possível atribuir a função de Admin Global." }); return; }
            // Ensure environment is set unless role is Admin (prevented above)
            if (!data.environmentId) { form.setError("environmentId", { type: "manual", message: "Ambiente é obrigatório." }); return; }

            if (userToEdit?.id) {
                // --- Edit User ---
                if (userToEdit.role === 'Admin') { toast({ title: "Ação Inválida", description: "Não é possível editar o Admin Global aqui.", variant: "destructive" }); return; }
                const updates: Partial<User> = { name: data.name, role: data.role, jobTitle: data.jobTitle || undefined, environmentId: data.environmentId, };
                if (data.password) { updates.passwordHash = data.password; /* **SECURITY WARNING: HASH THIS** */ }
                await mainDb.users.update(userToEdit.id, updates);
                toast({ title: "Usuário Atualizado"});
            } else {
                // --- Create User ---
                if (!data.password) { form.setError("password", { type: "manual", message: "Senha é obrigatória para novos usuários." }); return; }
                const existingUser = await mainDb.users.get({ email: data.email });
                if (existingUser) { form.setError("email", { type: "manual", message: "E-mail já em uso." }); toast({ title: "Erro", description: "E-mail já cadastrado.", variant: "destructive" }); return; }

                const passwordHash = data.password; // **SECURITY WARNING: HASH THIS**
                const newUser: Omit<User, 'id'> = { name: data.name, email: data.email, passwordHash: passwordHash, jobTitle: data.jobTitle || undefined, role: data.role, status: 'Ativo', environmentId: data.environmentId, createdAt: new Date(), };
                await mainDb.users.add(newUser as User);
                toast({ title: "Usuário Criado" });
            }
            closeModal();
        } catch (error: any) { console.error("Falha ao salvar usuário:", error); if (error.name === 'ConstraintError') { form.setError('email', { type: 'manual', message: 'E-mail já em uso.' }); toast({ title: "Erro de E-mail", variant: "destructive" }); } else { toast({ title: "Erro ao Salvar", variant: "destructive" }); } }
    };

    const toggleUserStatus = async (user: User) => { if (!user.id || user.role === 'Admin') { toast({ title: "Ação Inválida", description: "Não é possível alterar o status do Admin Global.", variant: "destructive" }); return; } const newStatus: UserStatus = user.status === 'Ativo' ? 'Inativo' : 'Ativo'; try { await mainDb.users.update(user.id, { status: newStatus }); toast({ title: "Status Atualizado" }); } catch (error) { console.error("Falha atualizar status:", error); toast({ title: "Erro Status", variant: "destructive" }); } };
    const handleDeleteUser = async (user: User) => { if (!user.id || user.role === 'Admin') { toast({ title: "Ação Inválida", description: "Não é possível excluir o Admin Global.", variant: "destructive" }); return; } if (window.confirm(`Excluir ${user.name} (${user.email})?`)) { try { await mainDb.users.delete(user.id); toast({ title: "Usuário Excluído" }); } catch (error) { console.error("Falha excluir usuário:", error); toast({ title: "Erro Excluir", variant: "destructive" }); } } };
    const handleResetPassword = async (user: User) => { if (!user.id) return; const newPassword = prompt(`Nova senha para ${user.name} (mín. 6 caracteres):`); if (newPassword && newPassword.length >= 6) { try { const newPasswordHash = newPassword; /* **SECURITY WARNING: HASH THIS** */ await mainDb.users.update(user.id, { passwordHash: newPasswordHash }); toast({ title: "Senha Redefinida" }); } catch (error) { console.error("Falha redefinir senha:", error); toast({ title: "Erro Senha", variant: "destructive" }); } } else if (newPassword !== null) { toast({ title: "Senha Inválida", variant: "destructive" }); } };

    return (
        <Card>
            <CardHeader><CardTitle>Gerenciamento de Usuários (Global)</CardTitle><CardDescription>Adicione, edite ou remova usuários de todos os ambientes.</CardDescription></CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" /><Select value={selectedEnvironmentFilter} onValueChange={setSelectedEnvironmentFilter}><SelectTrigger className="w-[250px]"><SelectValue placeholder="Filtrar por Ambiente..." /></SelectTrigger><SelectContent><SelectItem value="all">Todos os Ambientes</SelectItem><SelectItem value="admin">Admin Global</SelectItem>{environments && environments.length > 0 && <DropdownMenuSeparator />}{environments?.map(env => (<SelectItem key={env.id} value={env.id!.toString()}>{env.name}</SelectItem>))}</SelectContent></Select>
                    </div><Input type="search" placeholder="Buscar por nome, e-mail, cargo, permissão..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" /><Button onClick={() => openModal()}><PlusCircle className="mr-2 h-4 w-4" /> Novo Usuário</Button>
                </div>
                <div className="border rounded-md"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>E-mail</TableHead><TableHead>Permissão</TableHead><TableHead>Ambiente</TableHead><TableHead>Status</TableHead><TableHead>Criado Em</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {allUsers === undefined && (<TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>)}
                            {allUsers && filteredUsers.length === 0 && (<TableRow><TableCell colSpan={8} className="h-24 text-center">Nenhum usuário encontrado{searchTerm || selectedEnvironmentFilter !== 'all' ? ' com os filtros aplicados' : ''}.</TableCell></TableRow>)}
                            {filteredUsers?.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell>{user.jobTitle ?? '-'}</TableCell> {/* Display Job Title */}
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell className='flex items-center gap-1'>
                                        {getRoleIcon(user.role)}
                                        {roleMap[user.role]}
                                    </TableCell>
                                    <TableCell>{user.environmentId ? environmentsMap.get(user.environmentId) : (user.role === 'Admin' ? <Badge variant="secondary">Global</Badge> : 'N/A')}</TableCell>
                                    <TableCell><Badge variant={getStatusVariant(user.status)}>{statusMap[user.status]}</Badge></TableCell>
                                    <TableCell>{user.createdAt ? format(user.createdAt, 'P', { locale: ptBR }) : 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0" disabled={user.role === 'Admin'}><span className="sr-only">Abrir menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Ações do Usuário</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => openModal(user)} disabled={user.role === 'Admin'}><Edit className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => toggleUserStatus(user)} disabled={user.role === 'Admin'}>{user.status === 'Ativo' ? <UserX className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />} {user.status === 'Ativo' ? 'Desativar' : 'Ativar'}</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleResetPassword(user)}><LockKeyhole className="mr-2 h-4 w-4" /> Redefinir Senha</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleDeleteUser(user)} disabled={user.role === 'Admin'} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table></div>

                {/* User Form Dialog */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}><DialogContent className="sm:max-w-[550px]"><DialogHeader><DialogTitle>{userToEdit ? 'Editar Usuário' : 'Criar Novo Usuário'}</DialogTitle><DialogDescription>{userToEdit ? `Edite as informações de ${userToEdit.name}.` : 'Preencha os dados para criar um novo usuário.'}</DialogDescription></DialogHeader>
                    <Form {...form}><form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome Completo*</FormLabel><FormControl><Input placeholder="Nome do usuário" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="jobTitle" render={({ field }) => (<FormItem><FormLabel>Cargo/Função</FormLabel><FormControl><Input placeholder="Ex: Arquiteto Pleno" {...field} /></FormControl><FormMessage /></FormItem>)} /> {/* Added Job Title Field */}
                        <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>E-mail*</FormLabel><FormControl><Input type="email" placeholder="email@exemplo.com" {...field} disabled={!!userToEdit} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="role" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Permissão*</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={userToEdit?.role === 'Proprietário' || userToEdit?.role === 'Admin'} // Prevent changing Owner or Admin role
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
                            <FormField control={form.control} name="environmentId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Ambiente*</FormLabel>
                                    <Select
                                        onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                                        value={field.value?.toString()}
                                        disabled={userToEdit?.role === 'Admin'} // Admin cannot have environment
                                    >
                                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione o ambiente" /></SelectTrigger></FormControl>
                                        <SelectContent>{environments?.map(env => (<SelectItem key={env.id} value={env.id!.toString()}>{env.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                             )} />
                        </div>
                        <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>{userToEdit ? 'Nova Senha (Opcional)' : 'Senha Inicial*'}</FormLabel><FormControl><Input type="password" placeholder={userToEdit ? 'Deixe em branco para não alterar' : 'Mínimo 6 caracteres'} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        {form.watch('password') && (<FormField control={form.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirmar Senha*</FormLabel><FormControl><Input type="password" placeholder="Repita a senha" {...field} /></FormControl><FormMessage /></FormItem>)} />)}
                        <DialogFooter className='pt-4'><DialogClose asChild><Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button></DialogClose><Button type="submit">{userToEdit ? 'Salvar Alterações' : 'Criar Usuário'}</Button></DialogFooter>
                    </form></Form>
                </DialogContent></Dialog>
            </CardContent>
        </Card>
    );
}
