'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { type EnvironmentDB, type Proposal, type Lead, getEnvironmentSettings, type EnvironmentSettings } from '@/db/db'; // Import Environment types
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Definitions remain the same
const proposalStatuses: Proposal['status'][] = ['Rascunho', 'Enviada', 'Aceita', 'Recusada'];
const proposalItemSchema = z.object({ id: z.string().optional(), name: z.string().min(1, 'Nome obrigatório'), description: z.string().optional(), value: z.coerce.number().min(0, 'Valor positivo') });
type ProposalItemFormData = z.infer<typeof proposalItemSchema>;
const proposalSchema = z.object({
    title: z.string().min(1, 'Título obrigatório'), chargeType: z.enum(['fixed', 'hourly']), hourlyRate: z.coerce.number().optional(), estimatedHours: z.coerce.number().optional(), totalValue: z.coerce.number().min(0, 'Valor total positivo'), status: z.enum(proposalStatuses), description: z.string().optional(), items: z.array(proposalItemSchema).min(1, 'Adicione pelo menos um item'), observations: z.string().optional(),
}).refine(data => !(data.chargeType === 'hourly' && (data.hourlyRate === undefined || data.hourlyRate <= 0)), { message: "Valor/hora obrigatório.", path: ["hourlyRate"] });
type ProposalFormData = z.infer<typeof proposalSchema>;
function formatCurrency(amount?: number): string { if (amount === undefined || amount === null || isNaN(amount)) return 'N/A'; return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
const getImageDataUrl = async (imageData?: Blob | string | null): Promise<string | null> => { if (!imageData) return null; if (typeof imageData === 'string') return imageData.startsWith('data:image') ? imageData : null; if (imageData instanceof Blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(imageData); }); } return null; };

interface ProposalFormProps {
    environmentDb: EnvironmentDB; // Accept the specific DB instance
    lead: Lead;
    proposalToEdit?: Proposal | null;
    onSuccess: () => void;
    onClose: () => void;
}

export default function ProposalForm({ environmentDb, lead, proposalToEdit, onSuccess, onClose }: ProposalFormProps) {
    const { toast } = useToast();
    const isEditMode = !!proposalToEdit;
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [environmentSettings, setEnvironmentSettings] = useState<EnvironmentSettings | null>(null);

    // Fetch environment settings
    useEffect(() => {
        const loadSettings = async () => {
            if (environmentDb) {
                try {
                    const settings = await getEnvironmentSettings(environmentDb);
                    setEnvironmentSettings(settings);
                } catch (error) {
                    console.error("Failed to load environment settings for proposal form:", error);
                    // Handle error - maybe disable PDF generation or use defaults
                }
            }
        };
        loadSettings();
    }, [environmentDb]);

    const form = useForm<ProposalFormData>({
        resolver: zodResolver(proposalSchema),
        defaultValues: { title: '', chargeType: 'fixed', hourlyRate: undefined, estimatedHours: undefined, totalValue: 0, status: 'Rascunho', description: '', items: [{ name: '', description: '', value: 0 }], observations: '', },
    });
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

    // Populate form or set defaults
    useEffect(() => {
        // Use environment default rate if available and creating new proposal
        const defaultRate = environmentSettings?.defaultHourlyRate;
        if (isEditMode && proposalToEdit) {
            let parsedItems = [{ name: '', description: '', value: 0 }]; try { if (proposalToEdit.items) parsedItems = JSON.parse(proposalToEdit.items); } catch (e) { console.error("Parse items error:", e); }
            form.reset({ title: proposalToEdit.title, chargeType: proposalToEdit.chargeType, hourlyRate: proposalToEdit.hourlyRate, estimatedHours: proposalToEdit.estimatedHours, totalValue: proposalToEdit.totalValue, status: proposalToEdit.status, description: proposalToEdit.description ?? '', items: parsedItems, observations: proposalToEdit.observations ?? '' });
        } else {
            form.reset({ title: '', chargeType: 'fixed', hourlyRate: defaultRate, estimatedHours: undefined, totalValue: 0, status: 'Rascunho', description: '', items: [{ name: '', description: '', value: 0 }], observations: '' });
        }
    }, [proposalToEdit, isEditMode, form, environmentSettings]); // Add environmentSettings dependency

    // Watch values needed for hourly calculation
    const chargeType = form.watch('chargeType');
    const hourlyRate = form.watch('hourlyRate');
    const estimatedHours = form.watch('estimatedHours');

    // Calculate total for hourly type
    useEffect(() => {
        if (chargeType === 'hourly') {
            form.setValue('totalValue', (hourlyRate ?? 0) * (estimatedHours ?? 0), { shouldValidate: true });
        }
    }, [chargeType, hourlyRate, estimatedHours, form]);

     // Function to calculate and set total for fixed price (called on blur)
     const calculateAndSetFixedTotal = useCallback(() => {
        if (chargeType === 'fixed') {
            const currentItems = form.getValues('items'); // Get current item values
            // Ensure item.value is treated as a number before summing
            const sum = currentItems.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
            form.setValue('totalValue', sum, { shouldValidate: true });
            // console.log("Calculated Fixed Total on Blur:", sum); // Optional: Debug log
        }
    }, [chargeType, form]);


    // --- DB Operations using environmentDb ---
    async function onSubmit(data: ProposalFormData) {
        if (!environmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        try {
            // Ensure total is calculated before saving for fixed type
            if (data.chargeType === 'fixed') {
                calculateAndSetFixedTotal();
                data = form.getValues(); // Get potentially updated values after calculation
            }

            const proposalDataToSave: Omit<Proposal, 'id' | 'createdAt' | 'sentAt' | 'leadId'> & { id?: number, createdAt?: Date, leadId: number, sentAt?: Date } = {
                leadId: lead.id!, title: data.title, chargeType: data.chargeType, hourlyRate: data.chargeType === 'hourly' ? data.hourlyRate : undefined, estimatedHours: data.chargeType === 'hourly' ? data.estimatedHours : undefined, totalValue: data.totalValue, status: data.status, description: data.description || undefined, items: JSON.stringify(data.items), observations: data.observations || undefined,
                // environmentId removed
            };
            if (isEditMode && proposalToEdit?.id) {
                proposalDataToSave.id = proposalToEdit.id; proposalDataToSave.createdAt = proposalToEdit.createdAt; proposalDataToSave.sentAt = proposalToEdit.sentAt;
                if (data.status === 'Enviada' && !proposalDataToSave.sentAt) proposalDataToSave.sentAt = new Date();
                await environmentDb.proposals.put(proposalDataToSave as Proposal); toast({ title: "Proposta Atualizada"});
            } else {
                proposalDataToSave.createdAt = new Date();
                if (data.status === 'Enviada') proposalDataToSave.sentAt = new Date();
                await environmentDb.proposals.add(proposalDataToSave as Proposal); toast({ title: "Proposta Criada"});
            }
            onSuccess(); onClose();
        } catch (error) { console.error("Falha salvar prop:", error); toast({ title: "Erro Salvar Proposta", variant: "destructive" }); }
    }

    // PDF Generation using environmentSettings
    const generatePdf = async (proposalData: ProposalFormData) => {
         if (!environmentDb || !environmentSettings || isGeneratingPdf) {
             toast({ title: "Aguarde", description: "Carregando configurações ou PDF já em geração.", variant:"default" });
             return;
         }
        setIsGeneratingPdf(true); toast({ title: "Gerando PDF..." });
        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageHeight = doc.internal.pageSize.height; const pageWidth = doc.internal.pageSize.width; const margin = 15; let currentY = margin;
            const logoUrl = await getImageDataUrl(environmentSettings.logoImage);
            if (logoUrl) { try { const props = doc.getImageProperties(logoUrl); const w = 30; const h = (props.height * w) / props.width; doc.addImage(logoUrl, 'JPEG', pageWidth - margin - w, margin, w, h); } catch (e) { console.error("Erro logo PDF:", e); } }
            currentY += 10; doc.setFontSize(18); doc.text(proposalData.title, margin, currentY); currentY += 8;
            doc.setFontSize(12); doc.setTextColor(100); doc.text(`Proposta para: ${lead.name}`, margin, currentY); currentY += 5; doc.text(`Data: ${format(new Date(), 'PPP', { locale: ptBR })}`, margin, currentY); doc.setTextColor(0); currentY += 15;
            doc.setFontSize(11); if (proposalData.description) { doc.setFont(undefined, 'bold'); doc.text('Descrição:', margin, currentY); currentY += 5; doc.setFont(undefined, 'normal'); const splitDesc = doc.splitTextToSize(proposalData.description, pageWidth - 2 * margin); doc.text(splitDesc, margin, currentY); currentY += splitDesc.length * 4 + 5; }
            doc.setFont(undefined, 'bold'); doc.text('Condições:', margin, currentY); currentY += 5; doc.setFont(undefined, 'normal');
            if (proposalData.chargeType === 'fixed') { doc.text(`- Tipo: Valor Fechado`, margin + 5, currentY); currentY += 5; doc.text(`- Valor Total: ${formatCurrency(proposalData.totalValue)}`, margin + 5, currentY); }
            else { doc.text(`- Tipo: Por Hora`, margin + 5, currentY); currentY += 5; doc.text(`- Valor/Hora: ${formatCurrency(proposalData.hourlyRate)}`, margin + 5, currentY); currentY += 5; doc.text(`- Estimativa Horas: ${proposalData.estimatedHours ?? 'N/A'} h`, margin + 5, currentY); currentY += 5; doc.text(`- Valor Estimado Total: ${formatCurrency(proposalData.totalValue)}`, margin + 5, currentY); }
            currentY += 10;
            if (proposalData.items?.length > 0) {
                doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text('Itens Inclusos:', margin, currentY); doc.setFont(undefined, 'normal'); currentY += 7;
                // Ensure item.value is treated as number for formatting
                const tableBody = proposalData.items.map(item => [ item.name, item.description ?? '', proposalData.chargeType === 'fixed' ? formatCurrency(Number(item.value) || 0) : '-' ]);
                autoTable(doc, { startY: currentY, margin: { left: margin, right: margin }, head: [['Item', 'Descrição', proposalData.chargeType === 'fixed' ? 'Valor (R$)' : '']], body: tableBody, theme: 'grid', styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: [0, 128, 128], textColor: 255, fontSize: 10 }, bodyStyles: { textColor: 50 }, columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 'auto' }, 2: { halign: 'right', cellWidth: 30 } }, didDrawPage: (data) => { currentY = data.cursor?.y ?? currentY; } });
                // @ts-ignore - JsPDF-AutoTable types might be incomplete
                 currentY = (doc as any).lastAutoTable.finalY + 10;
            }
            if (proposalData.observations) { doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('Observações:', margin, currentY); currentY += 5; doc.setFont(undefined, 'normal'); const splitObs = doc.splitTextToSize(proposalData.observations, pageWidth - 2 * margin); doc.text(splitObs, margin, currentY); currentY += splitObs.length * 4 + 5; }
            currentY = pageHeight - margin - 30; doc.line(margin, currentY, margin + 80, currentY); currentY += 5; doc.setFontSize(10); doc.text('Assinatura Cliente', margin, currentY);
            const safeClient = lead.name.replace(/[^a-z0-9]/gi, '_').toLowerCase(); const safeTitle = proposalData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase(); const fileName = `proposta_${safeClient}_${safeTitle}_${format(new Date(), 'yyyyMMdd')}.pdf`; doc.save(fileName);
            toast({ title: "PDF Gerado", description: `Arquivo "${fileName}" baixado.` });
        } catch (error) { console.error("Erro gerar PDF:", error); toast({ title: "Erro PDF", variant: "destructive" }); } finally { setIsGeneratingPdf(false); }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1 pr-3 max-h-[80vh] overflow-y-auto">
                <Card><CardHeader><CardTitle>Detalhes</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Título*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{proposalStatuses.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descrição</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                            <FormField control={form.control} name="chargeType" render={({ field }) => (<FormItem><FormLabel>Cobrança*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="fixed">Valor Fechado</SelectItem><SelectItem value="hourly">Por Hora</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                            {chargeType === 'hourly' && (<>
                                <FormField control={form.control} name="hourlyRate" render={({ field }) => (<FormItem><FormLabel>Valor/Hora*</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="estimatedHours" render={({ field }) => (<FormItem><FormLabel>Estimativa Horas</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </>)}
                            <FormField control={form.control} name="totalValue" render={({ field }) => (<FormItem><FormLabel>Valor Total (R$)</FormLabel><FormControl><Input type="number" {...field} readOnly className="bg-muted/50" /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </CardContent>
                </Card>
                <Card><CardHeader><CardTitle className='flex justify-between items-center'><span>Itens</span><Button type="button" size="sm" variant="outline" onClick={() => append({ name: '', description: '', value: 0 })}><PlusCircle className="mr-2 h-4 w-4"/> Add</Button></CardTitle></CardHeader>
                     <CardContent className="space-y-3">
                         {fields.map((item, index) => (
                            <div key={item.id} className="flex flex-col md:flex-row gap-2 border p-2 rounded-md relative">
                                <FormField control={form.control} name={`items.${index}.name`} render={({ field }) => (<FormItem className='flex-grow-[2]'><FormLabel className="text-xs">Nome*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (<FormItem className='flex-grow-[3]'><FormLabel className="text-xs">Descrição</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                {chargeType === 'fixed' && (<FormField control={form.control} name={`items.${index}.value`} render={({ field }) => (<FormItem className='flex-grow-[1]'><FormLabel className="text-xs">Valor (R$)*</FormLabel><FormControl>
                                    {/* Added onBlur to trigger calculation */}
                                    <Input type="number" step="0.01" {...field} onBlur={calculateAndSetFixedTotal} />
                                    </FormControl><FormMessage /></FormItem>)} />)}
                                <Button type="button" variant="ghost" size="icon" onClick={() => fields.length > 1 && remove(index)} disabled={fields.length <= 1} className="absolute top-1 right-1 md:relative md:top-auto md:right-auto md:self-end h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                            </div> ))}
                         <FormMessage>{form.formState.errors.items?.message || form.formState.errors.items?.root?.message}</FormMessage>
                     </CardContent>
                </Card>
                <Card><CardHeader><CardTitle>Obs Gerais</CardTitle></CardHeader>
                     <CardContent><FormField control={form.control} name="observations" render={({ field }) => (<FormItem><FormControl><Textarea {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} /></CardContent>
                </Card>
                 <div className="flex justify-between items-center mt-6 gap-2 flex-wrap">
                    <Button type="button" variant="outline" onClick={() => generatePdf(form.getValues())} disabled={isGeneratingPdf || !environmentDb}>{isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />} Gerar PDF</Button>
                     <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={!form.formState.isValid || !environmentDb}>{isEditMode ? 'Salvar Alterações' : 'Salvar Proposta'}</Button></div>
                 </div>
            </form>
        </Form>
    );
}
