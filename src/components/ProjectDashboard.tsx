
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { mainDb, getEnvironmentDB, type Project, type EnvironmentDB } from '@/db/db'; // Import necessary types/functions
import { Button } from '@/components/ui/button';
import { PlusCircle, LayoutDashboard, Archive, Loader2 } from 'lucide-react'; // Added Loader2
import ProjectForm from './ProjectForm';
import ProjectList from './ProjectList';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

// Translate statuses used for filtering
const statusMap: { [key in Project['status']]: string } = {
    'Pendente': 'Pendente',
    'Em Andamento': 'Em Andamento',
    'Concluído': 'Concluído',
    'Atrasado': 'Atrasado',
};

export default function ProjectDashboard() {
  const { user, isLoading: isAuthLoading, currentEnvironmentDb } = useAuth(); // Get user and environment DB from context
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  // No need for isMounted, useLiveQuery handles async loading

  // Fetch projects from the current environment's DB
  const projects = useLiveQuery(async () => {
    if (isAuthLoading || !currentEnvironmentDb) return undefined; // Wait for auth and DB instance
    return await currentEnvironmentDb.projects.orderBy('createdAt').reverse().toArray();
  }, [currentEnvironmentDb, isAuthLoading]); // Depend on the environment DB instance and auth loading state

  // Separate projects into active and completed lists
  const { activeProjects, completedProjects } = useMemo(() => {
    const active: Project[] = []; // Initialize local variables
    const completed: Project[] = []; // Initialize local variables
    if (!projects) {
         // If projects is undefined or null, return empty arrays immediately
        return { activeProjects: active, completedProjects: completed };
    }
    projects.forEach(p => {
      if (p.status === 'Concluído') completed.push(p);
      else active.push(p);
    });
     // Return the local variables with the correct keys
    return { activeProjects: active, completedProjects: completed };
  }, [projects]);

  const handleProjectAddedOrUpdated = () => {
    setIsModalOpen(false);
    setProjectToEdit(null);
  };

  const openCreateModal = () => {
    setProjectToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setProjectToEdit(project);
    setIsModalOpen(true);
  };

  // Show loading state while authentication or data fetching is in progress
  if (isAuthLoading || projects === undefined) {
    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 text-center">
             <div className="flex justify-center items-center gap-2 mt-10">
                 <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span>Carregando painel de projetos...</span>
            </div>
        </div>
    );
   }

   // Handle case where user is logged in but has no environment DB (should not happen for non-admins)
   if (!currentEnvironmentDb && user && user.role !== 'Admin') {
       return <div className="p-6 text-center text-destructive">Erro: Não foi possível carregar o ambiente de dados. Contacte o suporte.</div>;
   }

    // Handle case for Admin user (no environment projects to show directly)
    if (user?.role === 'Admin') {
        return <div className="container mx-auto p-4 md:p-6 lg:p-8 text-center text-muted-foreground mt-10">Administradores Globais não possuem um painel de projetos. Use o menu Admin para gerenciar ambientes.</div>;
    }


  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div className="flex items-center gap-2 mb-4 sm:mb-0">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Projetos Genius ERP+CRM</h1> {/* Changed from Painel */}
        </div>
        <Dialog open={isModalOpen} onOpenChange={(isOpen) => { setIsModalOpen(isOpen); if (!isOpen) setProjectToEdit(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreateModal} disabled={!currentEnvironmentDb}> {/* Disable if no env DB */}
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{projectToEdit ? 'Editar Projeto' : 'Criar Novo Projeto'}</DialogTitle>
              {projectToEdit && (<DialogDescription>Modifique os detalhes do projeto "{projectToEdit.clientName}".</DialogDescription>)}
            </DialogHeader>
             {/* Ensure ProjectForm receives the correct DB instance */}
             {currentEnvironmentDb && (
                 <ProjectForm
                    environmentDb={currentEnvironmentDb} // Pass the specific DB instance
                    onProjectAddedOrUpdated={handleProjectAddedOrUpdated}
                    projectToEdit={projectToEdit}
                 />
             )}
          </DialogContent>
        </Dialog>
      </header>

      {/* Conditional rendering based on projects */}
      {projects.length === 0 ? (
         <div className="text-center text-muted-foreground mt-10">
           <p>Nenhum projeto encontrado. Clique em "Novo Projeto" para começar.</p>
         </div>
       ) : (
        <>
          <section><h2 className="text-xl font-semibold mb-4 border-b pb-2">Projetos Ativos</h2>
            {activeProjects.length > 0 ? (
              <ProjectList projects={activeProjects} onEditProject={openEditModal} environmentDb={currentEnvironmentDb!} /> // Pass DB
            ) : (<p className="text-muted-foreground text-center mt-4">Nenhum projeto ativo.</p>)}
          </section>
          {completedProjects.length > 0 && (
            <>
              <Separator className="my-8" />
              <section>
                <h2 className="text-xl font-semibold mb-4 border-b pb-2 flex items-center gap-2"><Archive className="h-5 w-5 text-muted-foreground" /> Projetos Concluídos</h2>
                <ProjectList projects={completedProjects} onEditProject={openEditModal} environmentDb={currentEnvironmentDb!} /> {/* Pass DB */}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
