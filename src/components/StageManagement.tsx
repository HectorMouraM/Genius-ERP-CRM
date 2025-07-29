
"use client";

import { useState, useEffect, useCallback } from 'react';
import { type EnvironmentDB, type Stage, type TimeEntry, type StageImage, type StageTemplate, getEnvironmentSettings } from '@/db/db'; // Import EnvironmentDB and settings function
import { Button } from '@/components/ui/button';
import { PlusCircle, Calendar, Clock, Play, Pause, RotateCcw, Upload, Image as ImageIcon, Trash2, GripVertical, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, differenceInSeconds } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReportGenerator from './ReportGenerator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { useLiveQuery } from 'dexie-react-hooks'; // Import useLiveQuery

interface StageManagementProps {
  projectId: number;
  initialStages: Stage[];
  environmentDb: EnvironmentDB; // Accept the specific DB instance
}

// Definitions remain the same
const statusMap: { [key in Stage['status']]: string } = { 'Pendente': 'Pendente', 'Em Andamento': 'Em Andamento', 'Concluído': 'Concluído', 'Atrasado': 'Atrasado', };
const statusKeys = Object.keys(statusMap) as Stage['status'][];
const getStatusColorClass = (status: Stage['status'], deadline?: Date): string => { const isOverdue = deadline ? new Date() > deadline && status !== 'Concluído' : false; switch (status) { case 'Concluído': return 'bg-green-100 dark:bg-green-900'; case 'Em Andamento': return isOverdue ? 'bg-red-100 dark:bg-red-900' : 'bg-yellow-100 dark:bg-yellow-900'; case 'Atrasado': return 'bg-red-100 dark:bg-red-900'; case 'Pendente': return isOverdue ? 'bg-red-100 dark:bg-red-900' : 'bg-gray-100 dark:bg-gray-700'; default: return 'bg-gray-100 dark:bg-gray-700'; } };
const getStatusBorderClass = (status: Stage['status'], deadline?: Date): string => { const isOverdue = deadline ? new Date() > deadline && status !== 'Concluído' : false; switch (status) { case 'Concluído': return 'border-green-500'; case 'Em Andamento': return isOverdue ? 'border-red-500' : 'border-yellow-500'; case 'Atrasado': return 'border-red-500'; case 'Pendente': return isOverdue ? 'border-red-500' : 'border-gray-400'; default: return 'border-gray-400'; } };
function formatTime(totalSeconds: number): string { const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = Math.floor(totalSeconds % 60); return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; }
function parseTimeToSeconds(timeString: string): number { const parts = timeString.split(':').map(part => parseInt(part, 10) || 0); if (parts.length !== 3) return 0; const [hours, minutes, seconds] = parts; return hours * 3600 + minutes * 60 + seconds; }

// SortableStageItem Props including environmentDb
interface SortableStageItemProps {
  environmentDb: EnvironmentDB; // Pass DB instance
  stage: Stage;
  activeTimerId: number | null;
  elapsedTimes: { [key: number]: number };
  onTimerToggle: (stageId: number) => void;
  onTimerReset: (stageId: number) => void;
  onDeleteStage: (stageId: number) => void;
  onDeadlineChange: (stageId: number, date?: Date) => void;
  onImageUpload: (stageId: number, file: File) => void;
  onDeleteImage: (imageId: number) => void;
  onStatusChange: (stageId: number, status: Stage['status']) => void;
  onEditTime: (stageId: number) => void;
  imageRefreshTrigger: number;
}

// --- SortableStageItem Component ---
function SortableStageItem({ environmentDb, stage, activeTimerId, elapsedTimes, onTimerToggle, onTimerReset, onDeleteStage, onDeadlineChange, onImageUpload, onDeleteImage, onStatusChange, onEditTime, imageRefreshTrigger }: SortableStageItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id! });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const { toast } = useToast();
    const isTimerRunning = activeTimerId === stage.id;

    // Fetch images using useLiveQuery bound to the specific environmentDb
    const images = useLiveQuery(async () => {
        if (stage.id !== undefined && environmentDb) {
            return await environmentDb.stageImages.where('stageId').equals(stage.id).toArray();
        }
        return [];
    }, [environmentDb, stage.id, imageRefreshTrigger]); // Depend on db, stage id, and trigger

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && stage.id !== undefined) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                toast({ title: "Tipo de Arquivo Inválido", description: "Por favor, envie um arquivo de imagem.", variant: "destructive" });
                return;
            }
            onImageUpload(stage.id, file);
        }
        e.target.value = '';
    };

    const handleDeleteImageInternal = (imageId: number) => {
        onDeleteImage(imageId); // Parent handles deletion and triggers refresh
    };

    const statusColorClass = getStatusColorClass(stage.status, stage.deadline);
    const statusBorderClass = getStatusBorderClass(stage.status, stage.deadline);

    return (
        <div ref={setNodeRef} style={style} className={`mb-4 p-4 border-l-4 ${statusBorderClass} ${statusColorClass} rounded-md shadow`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                    <button {...attributes} {...listeners} className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground"><GripVertical className="h-5 w-5" /></button>
                    <h3 className="text-lg font-semibold">{stage.name}</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDeleteStage(stage.id!)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
            </div>

            {/* Grid for Status, Deadline, Timer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Status */}
                <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <Select value={stage.status} onValueChange={(value) => onStatusChange(stage.id!, value as Stage['status'])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{statusKeys.map(key => (<SelectItem key={key} value={key}>{statusMap[key]}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                {/* Deadline */}
                <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">Prazo</label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={'outline'} className="w-full justify-start text-left font-normal">
                                <Calendar className="mr-2 h-4 w-4" />{stage.deadline ? format(stage.deadline, 'PPP', { locale: ptBR }) : <span>Escolha data</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={stage.deadline} onSelect={(date) => onDeadlineChange(stage.id!, date)} initialFocus locale={ptBR} /></PopoverContent>
                    </Popover>
                </div>
                {/* Timer */}
                <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">Controle de Tempo</label>
                    <div className="flex items-center gap-1 bg-muted p-2 rounded-md">
                        <Clock className="h-5 w-5 text-primary" />
                        <span className="font-mono text-lg flex-grow">{formatTime(elapsedTimes[stage.id!] ?? stage.accumulatedTime ?? 0)}</span>
                        <Button variant="ghost" size="icon" onClick={() => onTimerToggle(stage.id!)} className="w-8 h-8">{isTimerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
                        <Button variant="ghost" size="icon" onClick={() => onTimerReset(stage.id!)} disabled={isTimerRunning} className="w-8 h-8"><RotateCcw className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => onEditTime(stage.id!)} disabled={isTimerRunning} className="w-8 h-8"><Pencil className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>

            {/* Image Upload & Gallery */}
            <div className="mt-4">
                <label className="block text-sm font-medium text-muted-foreground mb-2">Imagens</label>
                <div className="flex items-center gap-4 mb-2">
                    <Button asChild variant="outline" size="sm"><label htmlFor={`image-upload-${stage.id}`} className="cursor-pointer"><Upload className="mr-2 h-4 w-4" /> Enviar</label></Button>
                    <input id={`image-upload-${stage.id}`} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </div>
                {images && images.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {images.map((image) => {
                            const imageUrl = typeof image.imageData === 'string' ? image.imageData : image.imageData instanceof Blob ? URL.createObjectURL(image.imageData) : '/placeholder.png';
                            const revokeUrl = () => { if (typeof image.imageData !== 'string' && imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl); };
                            return (
                                <div key={image.id} className="relative group border rounded-md overflow-hidden aspect-square">
                                    <Image src={imageUrl} alt={`Imagem ${image.fileName}`} layout="fill" objectFit="cover" data-ai-hint="architectural design drawing" onLoad={revokeUrl} onError={(e) => { console.error("Falha img:", e); revokeUrl(); (e.target as HTMLImageElement).src = '/placeholder.png'; }} />
                                    <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteImageInternal(image.id!)}><Trash2 className="h-3 w-3" /></Button>
                                </div>
                            );
                        })}
                    </div>
                )}
                {(!images || images.length === 0) && <p className="text-xs text-muted-foreground">Nenhuma imagem enviada.</p>}
            </div>
        </div>
    );
}


// --- StageManagement Component ---
export default function StageManagement({ projectId, initialStages = [], environmentDb }: StageManagementProps) {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [newStageName, setNewStageName] = useState('');
  const [activeTimerId, setActiveTimerId] = useState<number | null>(null);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [elapsedTimes, setElapsedTimes] = useState<{ [key: number]: number }>({});
  const [timerStartTimes, setTimerStartTimes] = useState<{ [key: number]: Date }>({});
  const [imageRefreshTrigger, setImageRefreshTrigger] = useState(0);
  const [defaultStageTemplates, setDefaultStageTemplates] = useState<string[]>([]);
  const [isEditTimeModalOpen, setIsEditTimeModalOpen] = useState(false);
  const [stageToEditTime, setStageToEditTime] = useState<Stage | null>(null);
  const [editedTimeValue, setEditedTimeValue] = useState<string>('');
  const { toast } = useToast();

  // Sync state with initialStages prop
   useEffect(() => {
       setStages(initialStages);
        const initialElapsedTimes: { [key: number]: number } = {};
        initialStages.forEach(stage => { if (stage.id !== undefined) initialElapsedTimes[stage.id] = stage.accumulatedTime ?? 0; });
        setElapsedTimes(initialElapsedTimes);
   }, [initialStages]);

    // Fetch stage templates from the specific environment DB
   useEffect(() => {
        const loadTemplates = async () => {
            if (environmentDb) {
                const templates = await environmentDb.stageTemplates.orderBy('order').toArray();
                setDefaultStageTemplates(templates.map(t => t.name));
            }
        };
        loadTemplates();
    }, [environmentDb]); // Depend on environmentDb


   const sensors = useSensors(useSensor(PointerSensor));

   // --- DB Operations using environmentDb ---
  const handleAddStage = async (stageName?: string) => {
    if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
    const nameToAdd = stageName || newStageName;
    if (!nameToAdd.trim()) return;
    try {
      const currentOrder = stages.length;
      const newStage: Omit<Stage, 'id'> = { projectId, name: nameToAdd.trim(), order: currentOrder, status: 'Pendente', accumulatedTime: 0 };
      const id = await environmentDb.stages.add(newStage as Stage);
      const addedStage = { ...newStage, id };
      setStages(prevStages => [...prevStages, addedStage]);
      setElapsedTimes(prev => ({ ...prev, [id]: 0 }));
      if (!stageName) setNewStageName('');
      toast({ title: "Etapa Adicionada", description: `Etapa "${nameToAdd.trim()}" criada.` });
    } catch (error) {
      console.error('Falha ao adicionar etapa:', error); toast({ title: "Erro", description: "Falha ao adicionar etapa.", variant: "destructive" });
    }
  };

   const handleAddDefaultStages = async () => {
        if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        if (defaultStageTemplates.length === 0) return toast({ title: "Sem Modelos", variant: "default" });
        toast({ title: "Adicionando Modelos"});
        try {
            for (const templateName of defaultStageTemplates) await handleAddStage(templateName);
            toast({ title: "Modelos Adicionados"});
        } catch (error) { console.error('Falha add modelos:', error); toast({ title: "Erro", variant: "destructive" }); }
   };

  const handleDeleteStage = async (stageId: number) => {
    if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
     if (activeTimerId === stageId) await handleTimerToggle(stageId);
    try {
      await environmentDb.transaction('rw', environmentDb.stages, environmentDb.timeEntries, environmentDb.stageImages, async () => {
          await environmentDb.stages.delete(stageId);
          await environmentDb.timeEntries.where('stageId').equals(stageId).delete();
          await environmentDb.stageImages.where('stageId').equals(stageId).delete();
      });
       // Update local state AFTER DB success
       setStages(prevStages => prevStages.filter((s) => s.id !== stageId).map((s, index) => ({ ...s, order: index })));
       setElapsedTimes(prev => { const newState = { ...prev }; delete newState[stageId]; return newState; });
       setTimerStartTimes(prev => { const newState = { ...prev }; delete newState[stageId]; return newState; });
      toast({ title: "Etapa Excluída"});
      // Re-order remaining in DB
      const remainingStages = await environmentDb.stages.where('projectId').equals(projectId).sortBy('order');
      await environmentDb.transaction('rw', environmentDb.stages, async () => {
         for (let i = 0; i < remainingStages.length; i++) await environmentDb.stages.update(remainingStages[i].id!, { order: i });
      });
    } catch (error) { console.error('Falha excluir etapa:', error); toast({ title: "Erro", variant: "destructive" }); }
  };

  const updateStageOrder = async (newStages: Stage[]) => {
     if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
    try {
        const finalStages = newStages.map((stage, index) => ({ ...stage, order: index }));
        setStages(finalStages); // Optimistic UI update
        await environmentDb.transaction('rw', environmentDb.stages, async () => {
            for (const stage of finalStages) await environmentDb.stages.update(stage.id!, { order: stage.order });
        });
    } catch (error) {
        console.error("Falha reordenar:", error); toast({ title: "Erro ao Reordenar", variant: "destructive" });
        const refreshedStages = await environmentDb.stages.where('projectId').equals(projectId).sortBy('order'); setStages(refreshedStages); // Revert
    }
  };

 const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (active.id !== over?.id && over) {
          const oldIndex = stages.findIndex((item) => item.id === active.id);
          const newIndex = stages.findIndex((item) => item.id === over.id);
          if (oldIndex === -1 || newIndex === -1) return;
          const newOrderedStages = arrayMove(stages, oldIndex, newIndex);
          updateStageOrder(newOrderedStages);
      }
  };

  // --- Timer Logic (using environmentDb) ---
    useEffect(() => {
      if (activeTimerId !== null) {
        const interval = setInterval(() => {
          setElapsedTimes((prev) => {
            const startTime = timerStartTimes[activeTimerId];
            const stageFromState = stages.find(s => s.id === activeTimerId);
            const accumulated = stageFromState?.accumulatedTime ?? 0;
            const currentElapsed = startTime ? differenceInSeconds(new Date(), startTime) : 0;
            return { ...prev, [activeTimerId]: accumulated + currentElapsed };
          });
        }, 1000);
        setTimerInterval(interval);
      } else if (timerInterval) {
        clearInterval(timerInterval); setTimerInterval(null);
      }
      return () => { if (timerInterval) clearInterval(timerInterval); };
    }, [activeTimerId, timerStartTimes, stages]);

   const handleTimerToggle = async (stageId: number) => {
        if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        if (activeTimerId === stageId) { // Stop Timer
            const endTime = new Date(); const startTime = timerStartTimes[stageId];
            setActiveTimerId(null);
            if (startTime && stageId !== undefined) {
                const duration = differenceInSeconds(endTime, startTime);
                const stage = stages.find(s => s.id === stageId); if (!stage) return;
                const newAccumulatedTime = (stage.accumulatedTime ?? 0) + duration;
                try {
                   await environmentDb.transaction('rw', environmentDb.stages, environmentDb.timeEntries, async () => {
                      await environmentDb.timeEntries.add({ stageId, startTime, endTime, duration });
                      await environmentDb.stages.update(stageId, { accumulatedTime: newAccumulatedTime });
                   });
                    setStages(prev => prev.map(s => s.id === stageId ? { ...s, accumulatedTime: newAccumulatedTime } : s));
                    setElapsedTimes(prev => ({ ...prev, [stageId]: newAccumulatedTime }));
                    setTimerStartTimes(prev => { const newState = { ...prev }; delete newState[stageId]; return newState; });
                   toast({ title: "Cronômetro Parado", description: `Registrado ${formatTime(duration)}.` });
                } catch (error) { console.error("Falha salvar tempo:", error); toast({ title: "Erro Salvar Tempo", variant: "destructive" }); setActiveTimerId(stageId); }
            }
        } else { // Start Timer
            if (activeTimerId !== null) await handleTimerToggle(activeTimerId);
             setActiveTimerId(stageId); setTimerStartTimes(prev => ({ ...prev, [stageId]: new Date() }));
             toast({ title: "Cronômetro Iniciado" });
             const currentStage = stages.find(s => s.id === stageId);
             if (currentStage?.status === 'Pendente') handleStatusChange(stageId, 'Em Andamento');
        }
    };

   const handleTimerReset = async (stageId: number) => {
     if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
     if (activeTimerId === stageId) return toast({ title: "Pare o Cronômetro", variant: "default" });
     try {
       await environmentDb.transaction('rw', environmentDb.stages, environmentDb.timeEntries, async () => {
           await environmentDb.stages.update(stageId, { accumulatedTime: 0 });
           await environmentDb.timeEntries.where('stageId').equals(stageId).delete();
       });
       setStages(prev => prev.map(s => s.id === stageId ? { ...s, accumulatedTime: 0 } : s));
       setElapsedTimes(prev => ({ ...prev, [stageId]: 0 }));
       toast({ title: "Cronômetro Resetado" });
     } catch (error) { console.error("Falha resetar:", error); toast({ title: "Erro Resetar", variant: "destructive" }); }
   };

   // --- Edit Time (using environmentDb) ---
   const openEditTimeModal = (stageId: number) => {
       const stage = stages.find(s => s.id === stageId);
       if (stage && activeTimerId !== stageId) {
           setStageToEditTime(stage); setEditedTimeValue(formatTime(stage.accumulatedTime ?? 0)); setIsEditTimeModalOpen(true);
       } else if (activeTimerId === stageId) { toast({ title: "Cronômetro Ativo", variant: "default"}); }
   };

   const handleSaveEditedTime = async () => {
        if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        if (!stageToEditTime || stageToEditTime.id === undefined) return;
        const newAccumulatedTimeInSeconds = parseTimeToSeconds(editedTimeValue);
        if (isNaN(newAccumulatedTimeInSeconds) || newAccumulatedTimeInSeconds < 0) return toast({ title: "Formato Inválido", variant: "destructive"});
        try {
            await environmentDb.stages.update(stageToEditTime.id, { accumulatedTime: newAccumulatedTimeInSeconds });
            setStages(prev => prev.map(s => s.id === stageToEditTime.id ? { ...s, accumulatedTime: newAccumulatedTimeInSeconds } : s));
            setElapsedTimes(prev => ({ ...prev, [stageToEditTime.id!]: newAccumulatedTimeInSeconds }));
            toast({ title: "Tempo Atualizado" }); setIsEditTimeModalOpen(false); setStageToEditTime(null); setEditedTimeValue('');
        } catch (error) { console.error("Falha atualizar tempo:", error); toast({ title: "Erro Salvar Tempo", variant: "destructive"}); }
    };

   // --- Deadline & Status Updates (using environmentDb) ---
   const handleDeadlineChange = async (stageId: number, date?: Date) => {
      if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
      try {
          await environmentDb.stages.update(stageId, { deadline: date });
          setStages(prev => prev.map(s => s.id === stageId ? { ...s, deadline: date } : s));
          toast({ title: "Prazo Atualizado"});
      } catch (error) { console.error("Falha atualizar prazo:", error); toast({ title: "Erro Prazo", variant: "destructive" }); }
  };

   const handleStatusChange = async (stageId: number, status: Stage['status']) => {
       if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
       try {
           await environmentDb.stages.update(stageId, { status: status });
           setStages(prev => prev.map(s => s.id === stageId ? { ...s, status: status } : s));
           toast({ title: "Status Atualizado"});
       } catch (error) { console.error("Falha atualizar status:", error); toast({ title: "Erro Status", variant: "destructive" }); }
   };

    // --- Image Handling (using environmentDb) ---
   const handleImageUpload = async (stageId: number, file: File) => {
       if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
       try {
           const imageData = new Blob([file], { type: file.type });
           await environmentDb.stageImages.add({ stageId, imageData: imageData, uploadedAt: new Date(), fileName: file.name });
           toast({ title: "Imagem Enviada" }); setImageRefreshTrigger(prev => prev + 1);
       } catch (error) { console.error("Falha enviar imagem:", error); toast({ title: "Erro Enviar Imagem", variant: "destructive" }); }
   };

   const handleDeleteImage = async (imageId: number) => {
       if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
       try {
           await environmentDb.stageImages.delete(imageId);
           toast({ title: "Imagem Excluída" }); setImageRefreshTrigger(prev => prev + 1);
       } catch (error) { console.error("Falha excluir imagem:", error); toast({ title: "Erro Excluir Imagem", variant: "destructive" }); }
   };


  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4">Etapas do Projeto & Cronograma</h2>

      {/* Add Stage Form */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Input type="text" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="Nome da nova etapa" className="flex-grow min-w-[200px]" onKeyDown={(e) => { if (e.key === 'Enter') handleAddStage() }} />
        <Button onClick={() => handleAddStage()} disabled={!environmentDb}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Etapa</Button>
         {stages.length === 0 && defaultStageTemplates.length > 0 && (<Button variant="outline" onClick={handleAddDefaultStages} disabled={!environmentDb}>Adicionar Etapas Padrão</Button>)}
      </div>

       {/* Report Generation Button - Pass environmentDb */}
       <div className="mb-6">
           {environmentDb && <ReportGenerator projectId={projectId} environmentDb={environmentDb} />}
       </div>

      {/* Stage List */}
      {environmentDb ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stages.map(s => s.id!).filter(id => id !== undefined)} strategy={verticalListSortingStrategy}>
                  {stages.map(stage => (stage.id !== undefined ? (
                        <SortableStageItem
                            key={stage.id}
                            environmentDb={environmentDb} // Pass DB down
                            stage={stage}
                            activeTimerId={activeTimerId}
                            elapsedTimes={elapsedTimes}
                            onTimerToggle={handleTimerToggle}
                            onTimerReset={handleTimerReset}
                            onDeleteStage={handleDeleteStage}
                            onDeadlineChange={handleDeadlineChange}
                            onImageUpload={handleImageUpload}
                            onDeleteImage={handleDeleteImage}
                            onStatusChange={handleStatusChange}
                            onEditTime={openEditTimeModal}
                            imageRefreshTrigger={imageRefreshTrigger}
                        />
                    ) : null ))}
              </SortableContext>
          </DndContext>
      ) : (
         <p className="text-muted-foreground text-center mt-4">Carregando banco de dados do ambiente...</p>
      )}
       {stages.length === 0 && environmentDb && (<p className="text-muted-foreground text-center mt-4">Nenhuma etapa definida.</p>)}

        {/* Edit Time Dialog */}
         <Dialog open={isEditTimeModalOpen} onOpenChange={(isOpen) => { setIsEditTimeModalOpen(isOpen); if (!isOpen) { setStageToEditTime(null); setEditedTimeValue(''); } }}>
             <DialogContent className="sm:max-w-[425px]">
                 <DialogHeader><DialogTitle>Editar Tempo Acumulado</DialogTitle><DialogDescription>Edite o tempo total para "{stageToEditTime?.name}". Formato HH:MM:SS.</DialogDescription></DialogHeader>
                 <div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="edited-time" className="text-right">Tempo</Label><Input id="edited-time" value={editedTimeValue} onChange={(e) => setEditedTimeValue(e.target.value)} className="col-span-3" placeholder="00:00:00" /></div></div>
                 <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="button" onClick={handleSaveEditedTime}>Salvar</Button></DialogFooter>
             </DialogContent>
         </Dialog>
    </div>
  );
}
