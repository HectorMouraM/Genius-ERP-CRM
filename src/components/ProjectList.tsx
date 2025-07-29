
"use client";

import type { Project, Stage, TimeEntry, StageImage, EnvironmentDB } from '@/db/db'; // Import EnvironmentDB
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Building, Home, Pencil, Trash2, Copy, Clock, Lock } from 'lucide-react'; // Added Clock and Lock icons
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
// No direct import of `db` needed here, use passed instance
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { cn } from '@/lib/utils'; // Import cn for conditional classes

// Translate statuses/types (remain the same)
const statusMap: { [key in Project['status']]: string } = { 'Pendente': 'Pendente', 'Em Andamento': 'Em Andamento', 'Concluído': 'Concluído', 'Atrasado': 'Atrasado' };
const projectTypeMap: { [key in Project['projectType']]: string } = { 'Commercial': 'Comercial', 'Residential': 'Residencial' };
const getStatusVariant = (status: Project['status']): "default" | "secondary" | "destructive" | "outline" => { switch (status) { case 'Concluído': return 'default'; case 'Em Andamento': return 'secondary'; case 'Pendente': return 'outline'; case 'Atrasado': return 'destructive'; default: return 'outline'; } };
const getProjectTypeIcon = (type: Project['projectType']) => { switch (type) { case 'Commercial': return <Building className="h-4 w-4 text-muted-foreground" />; case 'Residential': return <Home className="h-4 w-4 text-muted-foreground" />; default: return null; } };
function formatCurrency(amount?: number): string { if (amount === undefined || amount === null) return 'N/A'; return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// Helper for billing type badge
const getBillingTypeInfo = (type: Project['billingType']): { label: string; icon: React.ReactNode; variant: "outline" | "secondary" } => {
    switch (type) {
        case 'hourly': return { label: 'Por Hora', icon: <Clock className="h-3 w-3" />, variant: 'outline' };
        case 'fixed': return { label: 'Valor Fixo', icon: <Lock className="h-3 w-3" />, variant: 'secondary' };
        default: return { label: 'N/D', icon: null, variant: 'outline' };
    }
};


interface ProjectListProps {
  projects: Project[];
  onEditProject: (project: Project) => void;
  environmentDb: EnvironmentDB; // Accept the specific DB instance
}

export default function ProjectList({ projects, onEditProject, environmentDb }: ProjectListProps) {
  const { toast } = useToast();
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDeleteProject = async (project: Project) => {
      if (!project || project.id === undefined || !environmentDb) return; // Check for DB instance

      try {
          // Use the passed environmentDb instance for the transaction
           await environmentDb.transaction('rw', environmentDb.projects, environmentDb.stages, environmentDb.timeEntries, environmentDb.stageImages, async () => {
                const stagesToDelete = await environmentDb.stages.where('projectId').equals(project.id!).toArray();
                const stageIds = stagesToDelete.map(s => s.id!).filter(id => id !== undefined);
                if (stageIds.length > 0) {
                    await environmentDb.timeEntries.where('stageId').anyOf(stageIds).delete();
                    await environmentDb.stageImages.where('stageId').anyOf(stageIds).delete();
                }
                await environmentDb.stages.where('projectId').equals(project.id!).delete();
                await environmentDb.projects.delete(project.id!);
           });

          toast({ title: "Projeto Excluído", description: `Projeto "${project.clientName}" e seus dados foram removidos.`, });
          setIsDeleteDialogOpen(false);
          setProjectToDelete(null);
          // Re-fetching or state update will be handled by the parent's useLiveQuery
      } catch (error) {
          console.error('Falha ao excluir projeto:', error);
          toast({ title: "Erro", description: "Falha ao excluir projeto.", variant: "destructive" });
      }
  };

  const handleCloneProject = async (project: Project) => {
     if (!project || !environmentDb) return; // Check for DB instance

    try {
      const clonedProjectData: Omit<Project, 'id' | 'createdAt'> = {
        clientName: `${project.clientName} - Cópia`,
        description: project.description,
        projectType: project.projectType,
        subType: project.subType,
        status: 'Pendente',
        billingType: project.billingType, // Clone billing type
        hourlyRate: project.hourlyRate, // Clone rate
        totalValue: project.totalValue, // Clone fixed value
         // environmentId is implicit
      };

      // Use the passed environmentDb instance
      await environmentDb.projects.add({ ...clonedProjectData, createdAt: new Date() });

      toast({ title: "Projeto Clonado", description: `Projeto "${project.clientName}" clonado com sucesso.` });
      // Parent's useLiveQuery will update the list
    } catch (error) {
      console.error('Falha ao clonar projeto:', error);
      toast({ title: "Erro", description: "Falha ao clonar projeto.", variant: "destructive" });
    }
  };

   const openDeleteConfirmation = (project: Project) => { setProjectToDelete(project); setIsDeleteDialogOpen(true); };

  return (
    <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const translatedStatus = statusMap[project.status]; // Use statusMap for translation
            const translatedProjectType = projectTypeMap[project.projectType];
            const billingInfo = getBillingTypeInfo(project.billingType);
            return (
              <Card key={project.id} className="flex flex-col justify-between shadow-md hover:shadow-lg transition-shadow duration-200">
                <CardHeader className='pb-2'> {/* Reduce padding bottom */}
                  <div className="flex justify-between items-start mb-1">
                      <CardTitle className="text-lg font-semibold">{project.clientName}</CardTitle>
                      <Badge variant={getStatusVariant(project.status)}>{translatedStatus}</Badge> {/* Display translated status */}
                  </div>
                   <div className="flex justify-between items-center flex-wrap gap-1"> {/* Wrap badges */}
                        <CardDescription className="flex items-center gap-1 text-xs text-muted-foreground">
                            {getProjectTypeIcon(project.projectType)} {translatedProjectType} {project.subType ? `- ${project.subType}` : ''}
                        </CardDescription>
                         <Badge variant={billingInfo.variant} className='gap-1 px-1.5 py-0 text-xs'>
                            {billingInfo.icon}
                            {billingInfo.label}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow pt-2 pb-4"> {/* Adjust padding */}
                     <p className="text-sm text-muted-foreground line-clamp-3">{project.description || "Sem descrição."}</p>
                 </CardContent>
                <CardFooter className="flex justify-between items-center flex-wrap gap-2 pt-0"> {/* Adjust padding */}
                   <span className="text-sm font-medium text-nowrap">
                        {project.billingType === 'hourly' ? `${formatCurrency(project.hourlyRate)}/hr` : `${formatCurrency(project.totalValue)} (Fixo)`}
                   </span>
                  <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onEditProject(project)} title="Editar Projeto"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleCloneProject(project)} title="Clonar Projeto"><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openDeleteConfirmation(project)} title="Excluir Projeto"><Trash2 className="h-4 w-4" /></Button>
                      <Button asChild variant="ghost" size="sm" className='px-2'><Link href={`/project/${project.id}`}>Ver <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita. Isso excluirá permanentemente o projeto <span className="font-semibold"> "{projectToDelete?.clientName}" </span> e todos os seus dados associados neste ambiente.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel onClick={() => setProjectToDelete(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (projectToDelete) handleDeleteProject(projectToDelete); }} className={buttonVariants({ variant: "destructive" })}>Excluir Projeto</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}


  