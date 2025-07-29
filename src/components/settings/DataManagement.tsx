
"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, UploadCloud, DatabaseZap, Loader2 } from 'lucide-react';
import { type EnvironmentDB } from '@/db/db'; // Import EnvironmentDB type
import { format } from 'date-fns';
import JSZip from 'jszip';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

export default function DataManagement() {
    const { toast } = useToast();
    const { user, isLoading: isAuthLoading, currentEnvironmentDb } = useAuth(); // Get context
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const exportData = async (formatType: 'json' | 'zip') => {
        if (!currentEnvironmentDb) {
            toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
            return;
        }
        setIsExporting(true);
        toast({ title: "Exportando Dados", description: `Gerando arquivo ${formatType.toUpperCase()}...` });

        try {
            // Fetch all data from the current environment's DB
            const projects = await currentEnvironmentDb.projects.toArray();
            const stages = await currentEnvironmentDb.stages.toArray();
            const timeEntries = await currentEnvironmentDb.timeEntries.toArray();
            const stageImages = await currentEnvironmentDb.stageImages.toArray();
            const stageTemplates = await currentEnvironmentDb.stageTemplates.toArray();
            const environmentSettings = await currentEnvironmentDb.environmentSettings.get(1); // Assuming ID 1
            const leads = await currentEnvironmentDb.leads.toArray();
            const kanbanColumns = await currentEnvironmentDb.kanbanColumns.toArray();
            const proposals = await currentEnvironmentDb.proposals.toArray();
            const interactions = await currentEnvironmentDb.interactions.toArray();
            const appointments = await currentEnvironmentDb.appointments.toArray();


            const exportObject = {
                environmentDbName: currentEnvironmentDb.name, // Include DB name for context
                projects,
                stages,
                timeEntries,
                stageImagesMetadata: stageImages.map(({ id, stageId, uploadedAt, fileName }) => ({ id, stageId, uploadedAt, fileName })), // Only metadata for JSON
                stageTemplates,
                environmentSettings,
                leads,
                kanbanColumns,
                proposals,
                interactions,
                appointments,
                exportTimestamp: new Date().toISOString(),
            };

             // Handle potential Blobs in settings for JSON export
            if (formatType === 'json') {
                const settingsForJson = { ...exportObject.environmentSettings };
                delete settingsForJson?.logoImage; // Omit blob
                delete settingsForJson?.signatureImage; // Omit blob
                exportObject.environmentSettings = settingsForJson;
            }


            if (formatType === 'json') {
                const jsonString = JSON.stringify(exportObject, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${currentEnvironmentDb.name}_backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                toast({ title: "Exportação Concluída (JSON)", description: "Arquivo de backup baixado." });

            } else if (formatType === 'zip') {
                const zip = new JSZip();
                zip.file("data.json", JSON.stringify(exportObject, null, 2));
                const imgFolder = zip.folder("images");
                 if (imgFolder) {
                    for (const image of stageImages) {
                        if (image.imageData instanceof Blob && image.id) {
                            const filename = `${image.stageId}_${image.id}_${image.fileName}`;
                            imgFolder.file(filename, image.imageData);
                        }
                    }
                    // Add logo/signature if they exist
                    if(environmentSettings?.logoImage instanceof Blob) imgFolder.file('environment_logo', environmentSettings.logoImage);
                    if(environmentSettings?.signatureImage instanceof Blob) imgFolder.file('environment_signature', environmentSettings.signatureImage);
                 }
                const zipBlob = await zip.generateAsync({ type: "blob" });
                const url = URL.createObjectURL(zipBlob);
                const link = document.createElement('a'); link.href = url;
                link.download = `${currentEnvironmentDb.name}_backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.zip`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                toast({ title: "Exportação Concluída (ZIP)", description: "Arquivo de backup com imagens baixado." });
            }

        } catch (error) {
            console.error("Falha ao exportar dados:", error); toast({ title: "Falha na Exportação", variant: "destructive" });
        } finally { setIsExporting(false); }
    };

    const handleImportClick = () => { document.getElementById('import-file-input')?.click(); };

     const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
         if (!currentEnvironmentDb) { toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" }); return; }
         const file = event.target.files?.[0];
         if (!file) return;

         setIsImporting(true);
         toast({ title: "Importando Dados", description: "Processando arquivo..." });
         event.target.value = ''; // Reset input

         try {
             if (file.name.endsWith('.json')) {
                 const reader = new FileReader();
                 reader.onload = async (e) => {
                     try {
                         const jsonString = e.target?.result as string;
                         const data = JSON.parse(jsonString);

                         // --- Basic Validation ---
                         if (data.environmentDbName && data.environmentDbName !== currentEnvironmentDb.name) {
                            throw new Error(`Backup é para o ambiente '${data.environmentDbName}', mas o ambiente atual é '${currentEnvironmentDb.name}'.`);
                         }
                          if (!data.projects || !Array.isArray(data.projects)) throw new Error("JSON inválido: 'projects' ausente.");
                         // Add more specific checks for other arrays...

                         // --- Date Parsing ---
                         const parseDates = (items: any[], dateFields: string[]) => items.map(item => { const newItem = { ...item }; dateFields.forEach(field => { if (newItem[field] && typeof newItem[field] === 'string') newItem[field] = new Date(newItem[field]); }); return newItem; });
                         const projectsWithDates = parseDates(data.projects || [], ['createdAt']);
                         const stagesWithDates = parseDates(data.stages || [], ['deadline']);
                         const timeEntriesWithDates = parseDates(data.timeEntries || [], ['startTime', 'endTime']);
                         const leadsWithDates = parseDates(data.leads || [], ['createdAt']);
                         const proposalsWithDates = parseDates(data.proposals || [], ['createdAt', 'sentAt']);
                         const interactionsWithDates = parseDates(data.interactions || [], ['date']);
                         const appointmentsWithDates = parseDates(data.appointments || [], ['dateTime']);
                         // Note: Images are not imported from JSON in this version

                         // --- Transactional Import ---
                         await currentEnvironmentDb.transaction('rw', currentEnvironmentDb.tables , async () => {
                             // Option 1: Clear existing data ( uncomment if replacing)
                              // console.warn("Limpando tabelas antes da importação...");
                              // await Promise.all(currentEnvironmentDb.tables.map(table => table.clear()));

                             // Option 2: Use bulkPut (upsert - replaces items with same primary key, adds new ones)
                             console.log("Iniciando importação com bulkPut...");
                             if (projectsWithDates.length > 0) await currentEnvironmentDb.projects.bulkPut(projectsWithDates);
                             if (stagesWithDates.length > 0) await currentEnvironmentDb.stages.bulkPut(stagesWithDates);
                             if (timeEntriesWithDates.length > 0) await currentEnvironmentDb.timeEntries.bulkPut(timeEntriesWithDates);
                             if (data.stageTemplates?.length > 0) await currentEnvironmentDb.stageTemplates.bulkPut(data.stageTemplates);
                             if (leadsWithDates.length > 0) await currentEnvironmentDb.leads.bulkPut(leadsWithDates);
                             if (data.kanbanColumns?.length > 0) await currentEnvironmentDb.kanbanColumns.bulkPut(data.kanbanColumns);
                             if (proposalsWithDates.length > 0) await currentEnvironmentDb.proposals.bulkPut(proposalsWithDates);
                             if (interactionsWithDates.length > 0) await currentEnvironmentDb.interactions.bulkPut(interactionsWithDates);
                             if (appointmentsWithDates.length > 0) await currentEnvironmentDb.appointments.bulkPut(appointmentsWithDates);

                             // Import settings (use put for singleton)
                             if (data.environmentSettings) {
                                 const settingsToPut = { ...data.environmentSettings, id: 1 }; // Ensure ID is 1
                                 // Handle potential base64 images if needed (or expect blobs if exported differently)
                                 await currentEnvironmentDb.environmentSettings.put(settingsToPut);
                             }
                              console.log("Importação bulkPut concluída.");
                         });

                         toast({ title: "Importação Concluída", description: "Dados importados do JSON para este ambiente." });
                         window.location.reload(); // Reload to reflect changes
                     } catch (parseError) {
                         console.error("Falha ao importar JSON:", parseError);
                         toast({ title: "Falha na Importação", description: (parseError as Error).message || "Erro ao processar arquivo.", variant: "destructive" });
                     } finally {
                         setIsImporting(false);
                     }
                 };
                 reader.readAsText(file);
             } else if (file.name.endsWith('.zip')) {
                 toast({ title: "Importação ZIP (Não Implementada)", variant: "default" });
                 setIsImporting(false);
             } else {
                 toast({ title: "Tipo de Arquivo Inválido", variant: "destructive" });
                 setIsImporting(false);
             }
         } catch (error) {
             console.error("Erro importação:", error); toast({ title: "Falha na Importação", variant: "destructive" }); setIsImporting(false);
         }
     };

     // Render loading or different states
    if (isAuthLoading) {
        return <Card><CardContent className='p-6 flex items-center gap-2'><Loader2 className='h-5 w-5 animate-spin text-primary'/> Carregando...</CardContent></Card>;
    }
     if (user?.role === 'Admin') {
          return <Card><CardContent className='p-6 text-muted-foreground'>Administradores Globais não gerenciam dados de ambientes específicos aqui.</CardContent></Card>;
     }
    if (!currentEnvironmentDb) {
         return <Card><CardContent className='p-6 text-destructive'>Erro: Ambiente de dados não encontrado.</CardContent></Card>;
     }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><DatabaseZap className="h-5 w-5" /> Gerenciamento de Dados (Ambiente)</CardTitle>
                <CardDescription>Faça backup dos dados deste ambiente ou importe de um backup anterior.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export Section */}
                <div className='space-y-3'>
                     <h3 className="font-medium">Exportar Dados do Ambiente</h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={() => exportData('json')} disabled={isExporting} className="flex-1">{isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Exportar JSON</Button>
                        <Button onClick={() => exportData('zip')} disabled={isExporting} className="flex-1">{isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Exportar ZIP (c/ Imagens)</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Exporta dados apenas deste ambiente. ZIP inclui imagens.</p>
                </div>

                {/* Import Section */}
                <div className='space-y-3'>
                     <h3 className="font-medium">Importar Dados para este Ambiente</h3>
                    <Button onClick={handleImportClick} disabled={isImporting} className="w-full">{isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />} Importar de Arquivo (.json)</Button>
                    <input type="file" id="import-file-input" accept=".json" className="hidden" onChange={importData} />
                    <p className="text-xs text-muted-foreground">Importa dados de um backup JSON para <span className='font-medium'>este ambiente atual</span>. <span className="font-semibold text-destructive">Use com cautela.</span></p>
                </div>
            </CardContent>
        </Card>
    );
}
