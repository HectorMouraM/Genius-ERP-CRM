
"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type Project, type Stage, getEnvironmentSettings } from '@/db/db'; // Import EnvironmentDB
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Building, Home, ArrowLeft, Calendar, Clock, ChevronDown, Loader2, DollarSign, Lock } from 'lucide-react'; // Added Loader2, DollarSign, Lock
import StageManagement from '@/components/StageManagement';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import ReportGenerator from '@/components/ReportGenerator'; // Import ReportGenerator

// Definitions remain the same
const projectStatuses: Project['status'][] = ['Pendente', 'Em Andamento', 'Concluído', 'Atrasado'];
const statusMap: { [key in Project['status']]: string } = { 'Pendente': 'Pendente', 'Em Andamento': 'Em Andamento', 'Concluído': 'Concluído', 'Atrasado': 'Atrasado', };
const getStatusVariant = (status: Project['status']): "default" | "secondary" | "destructive" | "outline" => { switch (status) { case 'Concluído': return 'default'; case 'Em Andamento': return 'secondary'; case 'Pendente': return 'outline'; case 'Atrasado': return 'destructive'; default: return 'outline'; } };
const projectTypeMap: { [key in Project['projectType']]: string } = { 'Commercial': 'Comercial', 'Residential': 'Residencial' };
const getProjectTypeIcon = (type: Project['projectType']) => { switch (type) { case 'Commercial': return <Building className="h-5 w-5 text-muted-foreground" />; case 'Residential': return <Home className="h-5 w-5 text-muted-foreground" />; default: return null; } };
function formatCurrency(amount?: number): string { if (amount === undefined || amount === null) return 'N/A'; return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }


export default function ProjectDetailPage() {
  const params = useParams();
  const projectIdStr = params?.projectId as string;
  const projectId = projectIdStr ? parseInt(projectIdStr, 10) : undefined;
  const { user, isLoading: isAuthLoading, currentEnvironmentDb } = useAuth(); // Get context
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setIsMounted(true); }, []);

  // Fetch project from the current environment's DB
  const project = useLiveQuery(async () => {
    if (!isMounted || isAuthLoading || !currentEnvironmentDb || projectId === undefined) return undefined;
    return await currentEnvironmentDb.projects.get(projectId);
  }, [projectId, isMounted, currentEnvironmentDb, isAuthLoading]); // Depend on DB instance

   // Fetch stages from the current environment's DB
   const stages = useLiveQuery(async () => {
    if (!isMounted || isAuthLoading || !currentEnvironmentDb || projectId === undefined) return [];
    return await currentEnvironmentDb.stages.where('projectId').equals(projectId).sortBy('order');
   }, [projectId, isMounted, currentEnvironmentDb, isAuthLoading]); // Depend on DB instance

   const handleStatusChange = async (newStatus: Project['status']) => {
       if (!project || project.id === undefined || !currentEnvironmentDb) return;
       try {
           await currentEnvironmentDb.projects.update(project.id, { status: newStatus });
           toast({ title: "Status Atualizado", description: `Status do projeto alterado para "${statusMap[newStatus]}".`, });
       } catch (error) {
           console.error("Falha ao atualizar status do projeto:", error);
           toast({ title: "Erro", description: "Falha ao atualizar status do projeto.", variant: "destructive" });
       }
   };

  // Loading States
  if (!isMounted || isAuthLoading) {
     return <div className="p-6 text-center flex justify-center items-center gap-2"><Loader2 className='h-5 w-5 animate-spin' /> Carregando dados...</div>;
  }
   if (!currentEnvironmentDb && user?.role !== 'Admin') {
     return <div className="p-6 text-center text-destructive">Erro: Ambiente de dados não disponível.</div>;
   }
    if (user?.role === 'Admin') {
        return <div className="p-6 text-center text-muted-foreground">Administradores não visualizam detalhes de projetos específicos de ambientes aqui.</div>;
    }
   if (projectId === undefined) {
    return <div className="p-6 text-center text-destructive">ID do Projeto Inválido.</div>;
   }
   // Wait for project data after mount and auth
   if (project === undefined && currentEnvironmentDb) {
       return <div className="p-6 text-center flex justify-center items-center gap-2"><Loader2 className='h-5 w-5 animate-spin' /> Carregando detalhes do projeto...</div>;
   }
   // Project not found in the current environment's DB
   if (project === null && currentEnvironmentDb) {
       return <div className="p-6 text-center text-destructive">Projeto não encontrado neste ambiente.</div>;
   }
    // Fallback if project is still undefined for some reason (e.g., DB error handled elsewhere)
   if (!project) {
        return <div className="p-6 text-center text-destructive">Não foi possível carregar os detalhes do projeto.</div>;
   }


  const translatedProjectType = projectTypeMap[project.projectType];
  const billingInfo = project.billingType === 'hourly'
        ? `${formatCurrency(project.hourlyRate)}/hr`
        : `${formatCurrency(project.totalValue)} (Fixo)`;
  const billingIcon = project.billingType === 'hourly' ? <Clock className="h-4 w-4 text-muted-foreground" /> : <Lock className="h-4 w-4 text-muted-foreground" />;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
       <div className="flex justify-between items-center mb-4">
           <Button asChild variant="outline" size="sm">
             <Link href="/">
               <ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos Projetos {/* Changed from Voltar ao Painel */}
             </Link>
           </Button>
            {/* Report Generator Button */}
           {currentEnvironmentDb && projectId !== undefined && (
             <ReportGenerator projectId={projectId} environmentDb={currentEnvironmentDb} />
           )}
       </div>


      <Card className="mb-6 shadow-md">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className='flex items-center gap-2'>
                {getProjectTypeIcon(project.projectType)}
                <CardTitle className="text-lg sm:text-xl font-bold">{project.clientName} - {translatedProjectType} {project.subType ? `(${project.subType})` : ''}</CardTitle>
            </div>
            <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                    <Button variant={getStatusVariant(project.status)} size="sm" className={cn("flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 h-auto py-1 min-w-[100px] justify-center")}>
                         {statusMap[project.status]} <ChevronDown className="h-3 w-3 opacity-70" /> {/* Use statusMap here */}
                     </Button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent align="end">
                     {projectStatuses.map((statusKey) => (<DropdownMenuItem key={statusKey} onSelect={() => handleStatusChange(statusKey)} disabled={project.status === statusKey} className="cursor-pointer">{statusMap[statusKey]}</DropdownMenuItem>))}
                 </DropdownMenuContent>
             </DropdownMenu>
          </div>
           <div className='flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 mt-1'> {/* Group details */}
                <CardDescription className="pt-1 flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="h-4 w-4" /> Criado em: {format(project.createdAt, 'PPP', { locale: ptBR })}</CardDescription>
                <CardDescription className="pt-1 flex items-center gap-2 text-sm">{billingIcon} Cobrança: {billingInfo}</CardDescription>
           </div>
        </CardHeader>
        <CardContent><p>{project.description || "Sem descrição detalhada."}</p></CardContent>
      </Card>

      {/* Pass the correct environment DB instance to StageManagement */}
      {currentEnvironmentDb && (
         <StageManagement
            projectId={projectId}
            initialStages={stages ?? []}
            environmentDb={currentEnvironmentDb} // Pass the specific DB instance
         />
      )}
    </div>
  );
}

