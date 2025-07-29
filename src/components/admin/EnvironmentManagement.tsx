
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { mainDb, getEnvironmentDB, type Environment, type User, type EnvironmentStatus, UserRole, EnvironmentSector } from '@/db/db'; // Removed Dexie from here
import Dexie from 'dexie'; // Import Dexie directly
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash2, MoreHorizontal, Building, Users, Eye, PowerOff, Power, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import EnvironmentSettingsForm from './EnvironmentSettingsForm'; // Import the new settings form component
import Link from 'next/link'; // Import Link

// Zod schema for environment form validation
const environmentSchema = z.object({
    name: z.string().min(1, 'Nome fantasia é obrigatório'),
    companyName: z.string().optional(),
    cnpj: z.string().optional(),
    sector: z.enum(['Arquitetura', 'Engenharia', 'Design Interiores', 'Construção', 'Outro']).optional(), // Added sector validation
    primaryContactName: z.string().min(1, 'Nome do responsável é obrigatório'),
    primaryContactEmail: z.string().email('E-mail do responsável inválido'),
    address: z.string().optional(),
    phone: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['Ativo', 'Inativo']).optional(), // Handled separately via actions
    logo: z.instanceof(Blob).optional().nullable(),
});

type EnvironmentFormData = z.infer<typeof environmentSchema>;

// Status Map and variants
const statusMap: { [key in EnvironmentStatus]: string } = { 'Ativo': 'Ativo', 'Inativo': 'Inativo', };
const getStatusVariant = (status: EnvironmentStatus): "default" | "secondary" | "outline" => { switch (status) { case 'Ativo': return 'default'; case 'Inativo': return 'secondary'; default: return 'outline'; } };
const environmentSectors: EnvironmentSector[] = ['Arquitetura', 'Engenharia', 'Design Interiores', 'Construção', 'Outro'];

// Helper to get data URL
const getImageDataUrl = (imageData?: Blob | string): string | null => { if (!imageData) return null; if (typeof imageData === 'string') return imageData; if (typeof window !== 'undefined' && imageData instanceof Blob) { try { return URL.createObjectURL(imageData); } catch (e) { console.error("Error creating object URL:", e); return null; } } return null; };

interface EnvironmentManagementProps {
  environments: Environment[]; // Receive environments from MainDB
}

export default function EnvironmentManagement({ environments }: EnvironmentManagementProps) {
    const { toast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); // State for settings modal
    const [environmentToEdit, setEnvironmentToEdit] = useState<Environment | null>(null);
    const [environmentToConfigure, setEnvironmentToConfigure] = useState<Environment | null>(null); // State for environment being configured
    const [searchTerm, setSearchTerm] = useState('');
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [userCounts, setUserCounts] = useState<{ [envId: number]: number }>({});
    const [isLoadingCounts, setIsLoadingCounts] = useState(false);

    // Fetch user counts for each environment
    useEffect(() => {
        const fetchCounts = async () => { if (!environments || environments.length === 0) return; setIsLoadingCounts(true); const counts: { [envId: number]: number } = {}; try { const countPromises = environments.map(async (env) => { if (env.id) { const count = await mainDb.users.where('environmentId').equals(env.id).count(); counts[env.id] = count; } }); await Promise.all(countPromises); setUserCounts(counts); } catch (error) { console.error("Failed to fetch user counts:", error); } finally { setIsLoadingCounts(false); } };
        fetchCounts();
    }, [environments]);

    // Filter environments based on search term
    const filteredEnvironments = environments.filter(env =>
        env.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (env.companyName && env.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (env.primaryContactName && env.primaryContactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (env.primaryContactEmail && env.primaryContactEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (env.cnpj && env.cnpj.includes(searchTerm)) ||
        (env.sector && env.sector.toLowerCase().includes(searchTerm.toLowerCase())) // Search by sector
    );

    const form = useForm<EnvironmentFormData>({ resolver: zodResolver(environmentSchema), defaultValues: { name: '', companyName: '', cnpj: '', sector: undefined, primaryContactName: '', primaryContactEmail: '', address: '', phone: '', notes: '', logo: null, }, });

    // Handle image preview and cleanup for Edit/Create Modal
    useEffect(() => {
        let objectUrl: string | null = null;
        if (environmentToEdit?.logo) { objectUrl = getImageDataUrl(environmentToEdit.logo); setLogoPreview(objectUrl); form.setValue('logo', environmentToEdit.logo instanceof Blob ? environmentToEdit.logo : null); } else { setLogoPreview(null); form.setValue('logo', null); }
        return () => { if (objectUrl && objectUrl.startsWith('blob:')) URL.revokeObjectURL(objectUrl); };
    }, [environmentToEdit, form]);

    // Reset form when environmentToEdit changes
    useEffect(() => {
        if (environmentToEdit) { form.reset({ name: environmentToEdit.name, companyName: environmentToEdit.companyName ?? '', cnpj: environmentToEdit.cnpj ?? '', sector: environmentToEdit.sector, primaryContactName: environmentToEdit.primaryContactName ?? '', primaryContactEmail: environmentToEdit.primaryContactEmail ?? '', address: environmentToEdit.address ?? '', phone: environmentToEdit.phone ?? '', notes: environmentToEdit.notes ?? '', logo: environmentToEdit.logo instanceof Blob ? environmentToEdit.logo : null }); } else { form.reset({ name: '', companyName: '', cnpj: '', sector: undefined, primaryContactName: '', primaryContactEmail: '', address: '', phone: '', notes: '', logo: null, }); setLogoPreview(null); }
    }, [environmentToEdit, form]);

    const openModal = (environment: Environment | null = null) => { setEnvironmentToEdit(environment); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setEnvironmentToEdit(null); setLogoPreview(null); form.reset(); };

    const openSettingsModal = (environment: Environment | null) => { if (!environment) return; setEnvironmentToConfigure(environment); setIsSettingsModalOpen(true); };
    const closeSettingsModal = () => { setIsSettingsModalOpen(false); setEnvironmentToConfigure(null); };

    const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file && file.type.startsWith('image/')) { const previewUrl = URL.createObjectURL(file); setLogoPreview(previewUrl); form.setValue('logo', file); } else if (file) { toast({ title: "Arquivo inválido", description: "Selecione um arquivo de imagem.", variant: "destructive" }); form.setValue('logo', null); setLogoPreview(null); } else { form.setValue('logo', null); setLogoPreview(null); } event.target.value = ''; };

    const handleFormSubmit = async (data: EnvironmentFormData) => {
        try {
            const logoData = data.logo;
            if (environmentToEdit?.id) {
                const updates: Partial<Environment> = { ...data, logo: logoData ?? environmentToEdit.logo, }; delete updates.status;
                await mainDb.environments.update(environmentToEdit.id, updates);
                toast({ title: "Ambiente Atualizado" });
            } else {
                const existingUser = await mainDb.users.get({ email: data.primaryContactEmail });
                if (existingUser) { form.setError("primaryContactEmail", { type: "manual", message: "Este e-mail já está cadastrado." }); toast({ title: "Erro", description: "E-mail do responsável já está em uso.", variant: "destructive" }); return; }

                const timestamp = Date.now(); const safeName = data.name.replace(/[^a-zA-Z0-9]/g, '_'); const dbName = `GeniusERPDB_Env_${safeName}_${timestamp}`;

                const newEnvironmentId = await mainDb.transaction('rw', mainDb.environments, mainDb.users, async () => {
                    const newEnvironmentData: Omit<Environment, 'id'> = { ...data, dbName: dbName, logo: logoData ?? undefined, status: 'Ativo', createdAt: new Date(), };
                    const createdEnvId = await mainDb.environments.add(newEnvironmentData as Environment);

                    // **SECURITY WARNING:** Handle password securely! NEVER hardcode.
                    const initialPasswordHash = 'senhaPadrao123!'; // REPLACE THIS
                    const initialUser: Omit<User, 'id'> = { name: data.primaryContactName, email: data.primaryContactEmail, passwordHash: initialPasswordHash, role: 'Proprietário', status: 'Ativo', environmentId: createdEnvId, createdAt: new Date(), jobTitle: 'Proprietário(a)' }; // Added jobTitle
                    await mainDb.users.add(initialUser as User);
                    toast({ title: "Usuário Proprietário Criado", description: `Usuário ${data.primaryContactName} criado. Use 'senhaPadrao123!' para o primeiro login.`, variant: "default", duration: 7000 });

                    return createdEnvId;
                });

                if (newEnvironmentId) {
                    try { await getEnvironmentDB(newEnvironmentId); console.log(`Environment DB ${dbName} initialized.`); toast({ title: "Ambiente Criado", description: `Ambiente "${data.name}" criado e DB inicializado.` }); } catch (dbInitError) { console.error(`Falha ao inicializar DB:`, dbInitError); toast({ title: "Erro Inicialização DB", variant: "destructive" }); }
                } else { throw new Error("Falha obter ID do novo ambiente."); }
            }
            closeModal();
        } catch (error: any) { console.error("Falha salvar ambiente:", error); if (error.name === 'ConstraintError') { toast({ title: "Erro de Duplicidade", variant: "destructive" }); } else { toast({ title: "Erro ao Salvar", variant: "destructive" }); } }
    };

    const toggleEnvironmentStatus = async (environment: Environment) => { if (!environment.id) return; const newStatus: EnvironmentStatus = environment.status === 'Ativo' ? 'Inativo' : 'Ativo'; try { await mainDb.environments.update(environment.id, { status: newStatus }); toast({ title: "Status Atualizado" }); } catch (error) { console.error("Falha atualizar status:", error); toast({ title: "Erro", variant: "destructive" }); } };
    const handleDeleteEnvironment = async (environment: Environment) => { if (!environment.id) return; const userCount = await mainDb.users.where('environmentId').equals(environment.id).count(); if (userCount > 0) { toast({ title: "Exclusão Bloqueada", description: `Existem ${userCount} usuários associados.`, variant: "destructive", duration: 7000 }); return; } if (window.confirm(`Tem certeza que deseja excluir ${environment.name}? Esta ação NÃO PODE ser desfeita e removerá o banco ${environment.dbName}.`)) { try { await mainDb.environments.delete(environment.id); try { await Dexie.delete(environment.dbName); console.log(`Banco ${environment.dbName} excluído.`); toast({ title: "Ambiente e Dados Excluídos" }); } catch (dbDeleteError) { console.error(`Erro excluir DB ${environment.dbName}:`, dbDeleteError); toast({ title: "Ambiente Excluído (Erro Parcial DB)", variant: "destructive"}); } } catch (error) { console.error("Falha excluir ambiente:", error); toast({ title: "Erro Excluir MainDB", variant: "destructive" }); } } };
    // const handleViewUsers = (environmentId?: number) => { if (!environmentId) return; toast({ title: "Ver Usuários (Em Breve)" }); }; // Removed
    const handleImpersonate = (environmentId?: number) => { if (!environmentId) return; toast({ title: "Acessar Ambiente (Em Breve)" }); };

    return (
        <Card>
            <CardHeader><CardTitle>Gerenciamento de Ambientes (Empresas)</CardTitle><CardDescription>Crie, edite ou desative ambientes no sistema.</CardDescription></CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-4 gap-2 flex-wrap"><Input type="search" placeholder="Buscar por nome, CNPJ, responsável, setor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" /><Button onClick={() => openModal()}><PlusCircle className="mr-2 h-4 w-4" /> Novo Ambiente</Button></div>
                <div className="border rounded-md"><Table><TableHeader><TableRow><TableHead className="w-[60px]">Logo</TableHead><TableHead>Nome Fantasia</TableHead><TableHead>Responsável</TableHead><TableHead className='text-center'>Usuários</TableHead><TableHead>Status</TableHead><TableHead>Criado Em</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {environments === undefined && (<TableRow><TableCell colSpan={7} className="h-24 text-center">Carregando...</TableCell></TableRow>)}
                            {environments && filteredEnvironments.length === 0 && (<TableRow><TableCell colSpan={7} className="h-24 text-center">Nenhum ambiente encontrado.</TableCell></TableRow>)}
                            {filteredEnvironments?.map((env) => (
                                <TableRow key={env.id}>
                                    <TableCell><Avatar className="h-8 w-8"><AvatarImage src={getImageDataUrl(env.logo) ?? undefined} alt={env.name} /><AvatarFallback className="text-xs">{env.name?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar></TableCell>
                                    <TableCell className="font-medium">{env.name} {env.sector && <span className='text-xs text-muted-foreground block'>({env.sector})</span>}</TableCell>
                                    <TableCell>{env.primaryContactName}<br /><span className='text-xs text-muted-foreground'>{env.primaryContactEmail}</span></TableCell>
                                    <TableCell className='text-center'>{isLoadingCounts ? <Loader2 className='h-4 w-4 animate-spin mx-auto' /> : (userCounts[env.id!] ?? 0)}</TableCell>
                                    <TableCell><Badge variant={getStatusVariant(env.status)}>{statusMap[env.status]}</Badge></TableCell>
                                    <TableCell>{env.createdAt ? format(env.createdAt, 'P', { locale: ptBR }) : 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Abrir menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Ações do Ambiente</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => openModal(env)}><Edit className="mr-2 h-4 w-4" /> Editar Dados</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openSettingsModal(env)}><SettingsIcon className="mr-2 h-4 w-4" /> Configurações</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => toggleEnvironmentStatus(env)}>{env.status === 'Ativo' ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}{env.status === 'Ativo' ? 'Desativar' : 'Ativar'}</DropdownMenuItem>
                                                {/* Updated Link to Environment Users Page */}
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/admin/environment-users/${env.id}`}>
                                                       <Users className="mr-2 h-4 w-4" /> Ver Usuários
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleImpersonate(env.id)} disabled><Eye className="mr-2 h-4 w-4" /> Acessar Como</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleDeleteEnvironment(env)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table></div>

                {/* Environment Create/Edit Form Dialog */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}><DialogContent className="sm:max-w-[650px]"><DialogHeader><DialogTitle>{environmentToEdit ? 'Editar Ambiente' : 'Criar Novo Ambiente'}</DialogTitle><DialogDescription>{environmentToEdit ? `Edite as informações do ambiente ${environmentToEdit.name}.` : 'Preencha os dados para criar um novo ambiente e o usuário proprietário inicial.'}</DialogDescription></DialogHeader>
                    <Form {...form}><form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome Fantasia*</FormLabel><FormControl><Input placeholder="Nome da Empresa" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="companyName" render={({ field }) => (<FormItem><FormLabel>Razão Social</FormLabel><FormControl><Input placeholder="Razão Social (Opcional)" {...field} /></FormControl><FormMessage /></FormItem>)} /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={form.control} name="cnpj" render={({ field }) => (<FormItem><FormLabel>CNPJ</FormLabel><FormControl><Input placeholder="00.000.000/0000-00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="sector" render={({ field }) => (<FormItem><FormLabel>Setor</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger></FormControl><SelectContent>{environmentSectors.map(sector => (<SelectItem key={sector} value={sector}>{sector}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} /></div>
                        <div className="space-y-2"><FormLabel>Logo da Empresa</FormLabel><div className='flex items-center gap-4'>{logoPreview ? (<Image src={logoPreview} alt="Pré-visualização" width={64} height={64} className="h-16 w-16 object-contain border rounded-md" />) : (<div className="h-16 w-16 border rounded-md flex items-center justify-center bg-muted text-muted-foreground"><Building className="h-8 w-8" /></div>)}<FormField control={form.control} name="logo" render={({ field }) => (<FormItem><FormControl><Input id="logo-upload-modal" type="file" accept="image/*" className="hidden" onChange={handleLogoChange}/></FormControl><Button asChild variant="outline" size="sm"><label htmlFor="logo-upload-modal" className="cursor-pointer">{logoPreview ? 'Alterar Logo' : 'Enviar Logo'}</label></Button><FormMessage /></FormItem>)} />{logoPreview && <Button type="button" variant="ghost" size="sm" onClick={() => {setLogoPreview(null); form.setValue('logo', null)}}>Remover</Button>}</div></div>
                        <hr className="my-4"/><h4 className="text-md font-medium mb-2">Responsável Principal (Usuário Proprietário)</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={form.control} name="primaryContactName" render={({ field }) => (<FormItem><FormLabel>Nome do Responsável*</FormLabel><FormControl><Input placeholder="Nome Completo" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="primaryContactEmail" render={({ field }) => (<FormItem><FormLabel>E-mail do Responsável*</FormLabel><FormControl><Input type="email" placeholder="email@responsavel.com" {...field} disabled={!!environmentToEdit} /></FormControl><FormMessage /></FormItem>)} /></div>{!environmentToEdit && <p className='text-xs text-muted-foreground'>Um usuário 'Proprietário' será criado com este e-mail/nome. Use a senha 'senhaPadrao123!' para o primeiro acesso.</p>}
                        <hr className="my-4"/><h4 className="text-md font-medium mb-2">Informações Adicionais</h4><FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Endereço</FormLabel><FormControl><Input placeholder="Endereço Comercial" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Telefone</FormLabel><FormControl><Input placeholder="(XX) XXXX-XXXX" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Observações (Admin)</FormLabel><FormControl><Textarea placeholder="Anotações internas..." {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter className='pt-4'><DialogClose asChild><Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button></DialogClose><Button type="submit">{environmentToEdit ? 'Salvar Alterações' : 'Criar Ambiente'}</Button></DialogFooter>
                    </form></Form>
                 </DialogContent></Dialog>

                 {/* Environment Settings Modal */}
                 <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
                     <DialogContent className="sm:max-w-[700px] md:max-w-[800px] lg:max-w-[900px]">
                         <DialogHeader>
                             <DialogTitle>Configurações do Ambiente: {environmentToConfigure?.name}</DialogTitle>
                             <DialogDescription>Ajuste os parâmetros operacionais e de identidade visual para este ambiente.</DialogDescription>
                         </DialogHeader>
                         {environmentToConfigure && environmentToConfigure.id ? (
                             <EnvironmentSettingsForm environmentId={environmentToConfigure.id} />
                         ) : (
                             <p>Erro: ID do ambiente não encontrado.</p>
                         )}
                         <DialogFooter>
                             <DialogClose asChild>
                                 <Button type="button" variant="outline" onClick={closeSettingsModal}>Fechar</Button>
                             </DialogClose>
                             {/* Save button might be inside EnvironmentSettingsForm if needed */}
                         </DialogFooter>
                     </DialogContent>
                 </Dialog>

            </CardContent>
        </Card>
    );
}


    