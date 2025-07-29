
"use client";

import { useState } from 'react';
import { type EnvironmentDB, type Project, type Stage, type TimeEntry, type StageImage, getEnvironmentSettings, type EnvironmentSettings } from '@/db/db'; // Import EnvironmentDB related types
import { Button } from '@/components/ui/button';
import { FileText, Loader2, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

// Definitions remain the same
const stageStatusMap: { [key in Stage['status']]: string } = { 'Pendente': 'Pendente', 'Em Andamento': 'Em Andamento', 'Concluído': 'Concluído', 'Atrasado': 'Atrasado' };
const projectStatusMap: { [key in Project['status']]: string } = { 'Pendente': 'Pendente', 'Em Andamento': 'Em Andamento', 'Concluído': 'Concluído', 'Atrasado': 'Atrasado' };
const projectTypeMap: { [key in Project['projectType']]: string } = { 'Commercial': 'Comercial', 'Residential': 'Residencial' };
function formatTimeReport(totalSeconds: number): string { if (!totalSeconds || totalSeconds < 0) return '0h 0m'; const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); return `${hours}h ${minutes}m`; }
function formatCurrency(amount?: number): string { if (amount === undefined || amount === null) return 'N/A'; return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
const getImageDataUrl = async (imageData?: Blob | string | null): Promise<string | null> => { if (!imageData) return null; if (typeof imageData === 'string') { if (imageData.startsWith('data:image')) return imageData; console.warn("String is not data URL:", imageData.substring(0, 50)); return null; } if (imageData instanceof Blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(imageData); }); } return null; };


interface ReportGeneratorProps {
  projectId: number;
  environmentDb: EnvironmentDB; // Accept the specific DB instance
}

export default function ReportGenerator({ projectId, environmentDb }: ReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateReport = async () => {
    if (!environmentDb) {
        toast({ title: "Erro", description: "Banco de dados do ambiente não encontrado.", variant: "destructive"});
        return;
    }
    setIsGenerating(true);
    toast({ title: "Gerando Relatório", description: "Coletando dados..." });

    try {
      // Fetch data from the specific environmentDb instance
      const [project, stages, allImages, settings] = await Promise.all([
        environmentDb.projects.get(projectId),
        environmentDb.stages.where('projectId').equals(projectId).sortBy('order'),
        // Fetch images associated with stages of this project
        environmentDb.stageImages.where('stageId').anyOf((await environmentDb.stages.where('projectId').equals(projectId).toArray()).map(s => s.id!).filter(id => id !== undefined)).toArray(),
        getEnvironmentSettings(environmentDb) // Fetch settings for this environment
      ]);

      if (!project) {
        toast({ title: "Erro", description: "Projeto não encontrado neste ambiente.", variant: "destructive" }); setIsGenerating(false); return;
      }

      toast({ description: "Gerando conteúdo do PDF..." });

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin;
      let currentY = margin + 10;

      const logoUrl = await getImageDataUrl(settings.logoImage);
      const signatureUrl = await getImageDataUrl(settings.signatureImage);

      const checkAddPage = (neededHeight: number) => {
          if (currentY + neededHeight > pageHeight - margin) {
              doc.addPage(); currentY = margin;
              if (logoUrl) { try { const imgProps = doc.getImageProperties(logoUrl); const imgWidth = 25; const imgHeight = (imgProps.height * imgWidth) / imgProps.width; doc.addImage(logoUrl, 'JPEG', pageWidth - margin - imgWidth, margin, imgWidth, imgHeight); } catch (e) { console.error("Erro logo (nova pág.):", e); } }
              currentY += 15; // Add space after header on new page
          }
      };

      // --- Header ---
      if (logoUrl) { try { const imgProps = doc.getImageProperties(logoUrl); const imgWidth = 25; const imgHeight = (imgProps.height * imgWidth) / imgProps.width; doc.addImage(logoUrl, 'JPEG', pageWidth - margin - imgWidth, margin, imgWidth, imgHeight); } catch (e) { console.error("Erro logo:", e); doc.setFontSize(8); doc.text("[Erro logo]", pageWidth - margin - 20, margin + 5); } }
      doc.setFontSize(18); doc.text(`Relatório do Projeto: ${project.clientName}`, margin, currentY, { align: 'left' }); currentY += 8;
      doc.setFontSize(12); doc.setTextColor(100); doc.text(`Gerado em: ${format(new Date(), 'PPP p', { locale: ptBR })}`, margin, currentY); doc.setTextColor(0); currentY += 15;

      // --- Project Summary ---
      checkAddPage(40); doc.setFontSize(14); doc.text('Resumo do Projeto', margin, currentY); currentY += 8; doc.setFontSize(10);
      const totalProjectSeconds = stages.reduce((sum, stage) => sum + (stage.accumulatedTime ?? 0), 0);
      const totalProjectCost = project.billingType === 'hourly'
          ? (totalProjectSeconds / 3600) * (project.hourlyRate ?? 0)
          : project.totalValue ?? 0;
      const translatedProjectType = projectTypeMap[project.projectType];
      const translatedProjectStatus = projectStatusMap[project.status];
      const billingLabel = project.billingType === 'hourly' ? `Por Hora (${formatCurrency(project.hourlyRate)}/hr)` : `Valor Fixo (${formatCurrency(project.totalValue)})`;

      const summaryBody = [
          ['Cliente', project.clientName],
          ['Descrição', project.description],
          ['Tipo', `${translatedProjectType} ${project.subType ? `(${project.subType})` : ''}`],
          ['Status Atual', translatedProjectStatus],
          ['Tipo de Cobrança', billingLabel], // Updated billing info
          ['Criado em', format(project.createdAt, 'PPP', { locale: ptBR })],
          ['Tempo Total Gasto', formatTimeReport(totalProjectSeconds)],
          ['Custo Estimado Total', formatCurrency(totalProjectCost)], // Reflects fixed or hourly cost
      ];

      autoTable(doc, {
        startY: currentY, margin: { left: margin, right: margin }, head: [['Detalhe', 'Informação']],
        body: summaryBody,
        theme: 'grid', styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: [0, 128, 128], textColor: 255, fontSize: 10 }, bodyStyles: { textColor: 50 },
        didDrawPage: (data) => { currentY = data.cursor?.y ?? currentY + 10; } // Update Y after table draw
      });
      // Explicitly set Y after autoTable if didDrawPage didn't update it correctly
      // @ts-ignore autoTable typings might be incomplete
      currentY = (doc as any).lastAutoTable.finalY + 10;

       // --- Stages Overview Table ---
        if (stages.length > 0) {
            checkAddPage(30 + stages.length * 8); doc.setFontSize(14); doc.text('Visão Geral das Etapas', margin, currentY); currentY += 8; doc.setFontSize(10);
            const stageTableBody = stages.map(stage => {
                 const stageSeconds = stage.accumulatedTime ?? 0;
                 // Stage cost depends on project billing type
                 const stageCost = project.billingType === 'hourly'
                     ? (stageSeconds / 3600) * (project.hourlyRate ?? 0)
                     : 'N/A (Valor Fixo)'; // Show N/A for fixed projects
                 const translatedStageStatus = stageStatusMap[stage.status];
                 return [
                    stage.order + 1,
                    stage.name,
                    translatedStageStatus,
                    stage.deadline ? format(stage.deadline, 'P', { locale: ptBR }) : 'N/A',
                    formatTimeReport(stageSeconds),
                    typeof stageCost === 'string' ? stageCost : formatCurrency(stageCost) // Format if number
                 ];
            });
            autoTable(doc, {
                startY: currentY, margin: { left: margin, right: margin }, head: [['#', 'Nome da Etapa', 'Status', 'Prazo', 'Tempo Gasto', 'Custo (Est.)']], body: stageTableBody, theme: 'grid', styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: [0, 128, 128], textColor: 255, fontSize: 10 }, bodyStyles: { textColor: 50 },
                columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 25 }, 3: { cellWidth: 20, halign: 'center' }, 4: { cellWidth: 25, halign: 'right' }, 5: { cellWidth: 25, halign: 'right' } },
                didDrawPage: (data) => { currentY = data.cursor?.y ?? currentY + 10; } // Update Y after table draw
            });
            // @ts-ignore
            currentY = (doc as any).lastAutoTable.finalY + 10;
        }

       // --- Time Allocation (Table instead of Chart) ---
        if (stages.length > 0 && stages.some(s => s.accumulatedTime && s.accumulatedTime > 0)) {
           checkAddPage(25); doc.setFontSize(14); doc.text('Alocação de Tempo por Etapa (Horas)', margin, currentY); currentY += 8; doc.setFontSize(10);
           const chartData = stages.filter(s => s.accumulatedTime && s.accumulatedTime > 0).map(stage => ({ name: stage.name, hours: parseFloat(((stage.accumulatedTime ?? 0) / 3600).toFixed(2)) }));
            if (chartData.length > 0) {
                checkAddPage(15 + chartData.length * 7);
                autoTable(doc, {
                    startY: currentY, margin: { left: margin, right: margin }, head: [['Etapa', 'Tempo (Horas)']], body: chartData.map(d => [d.name, d.hours.toFixed(2)]), theme: 'striped', styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: [0, 128, 128], textColor: 255, fontSize: 10 }, bodyStyles: { textColor: 50 }, columnStyles: { 1: { halign: 'right', cellWidth: 30 } },
                    didDrawPage: (data) => { currentY = data.cursor?.y ?? currentY + 10; }
                });
                // @ts-ignore
                currentY = (doc as any).lastAutoTable.finalY + 10;
            } else { doc.text("Nenhum tempo registrado.", margin, currentY); currentY += 10; }
        }

       // --- Image Gallery ---
        if (allImages.length > 0 && settings.reportLayout !== 'simple') {
            checkAddPage(25); doc.setFontSize(14); doc.text('Galeria de Imagens', margin, currentY); currentY += 8; doc.setFontSize(10);
            const imagesPerStage = stages.reduce((acc, stage) => { if (stage.id !== undefined) acc[stage.id] = allImages.filter(img => img.stageId === stage.id); return acc; }, {} as { [key: number]: StageImage[] });
            const imageSize = 45; const padding = 5; const imagesPerRow = Math.floor((contentWidth + padding) / (imageSize + padding));
            for (const stage of stages) {
                if (!stage.id) continue; const stageImages = imagesPerStage[stage.id];
                if (stageImages && stageImages.length > 0) {
                    checkAddPage(15); doc.setFontSize(12); doc.setTextColor(80); doc.text(`Etapa: ${stage.name}`, margin, currentY); doc.setTextColor(0); currentY += 7; doc.setFontSize(10);
                    let currentX = margin; let imageCounterInRow = 0; let rowStartY = currentY;
                    for (const img of stageImages) {
                        // Need checkAddPage inside loop in case images span pages
                        checkAddPage(imageSize + padding + 5);
                        // Reset row if new page added
                        if (currentY < rowStartY) {
                             rowStartY = currentY;
                             currentX = margin;
                             imageCounterInRow = 0;
                             doc.setFontSize(12); doc.setTextColor(80); doc.text(`Etapa: ${stage.name} (cont.)`, margin, currentY); doc.setTextColor(0); currentY += 7; rowStartY = currentY; doc.setFontSize(10);
                        }
                        // Reset position if row is full
                        if (imageCounterInRow >= imagesPerRow) {
                             currentY = rowStartY + imageSize + padding + 4;
                             currentX = margin;
                             imageCounterInRow = 0;
                             rowStartY = currentY;
                             // Check page again after advancing Y
                             checkAddPage(imageSize + padding + 5);
                             // Repeat header if new page started after Y advance
                             if (currentY < rowStartY) { // Rare case, but possible
                                 rowStartY = currentY;
                                 doc.setFontSize(12); doc.setTextColor(80); doc.text(`Etapa: ${stage.name} (cont.)`, margin, currentY); doc.setTextColor(0); currentY += 7; rowStartY = currentY; doc.setFontSize(10);
                            }
                        }


                        try {
                            const dataUrl = await getImageDataUrl(img.imageData);
                            if (dataUrl) {
                                doc.addImage(dataUrl, 'JPEG', currentX, currentY, imageSize, imageSize); doc.setFontSize(7); doc.setTextColor(150);
                                const textWidth = doc.getTextWidth(img.fileName); const textX = currentX + (imageSize - Math.min(textWidth, imageSize)) / 2;
                                doc.text(img.fileName, textX, currentY + imageSize + 3, { maxWidth: imageSize }); doc.setTextColor(0); currentX += imageSize + padding; imageCounterInRow++;
                            } else { console.warn(`URL nula para: ${img.fileName}`); doc.setFontSize(8); doc.setTextColor(150); doc.text(`[Sem visualização: ${img.fileName}]`, currentX + 5, currentY + imageSize / 2, {align: 'left'}); doc.setTextColor(0); currentX += imageSize + padding; imageCounterInRow++; }
                        } catch (error) { console.error("Erro add imagem:", error); doc.setFontSize(8); doc.setTextColor(150); doc.text(`[Erro: ${img.fileName}]`, currentX + 5, currentY + imageSize / 2, {align: 'left'}); doc.setTextColor(0); currentX += imageSize + padding; imageCounterInRow++; }
                    }
                    // Advance Y after the last row of images for this stage
                    currentY = rowStartY + imageSize + padding + 8;
                }
            }
        }

       // --- Automated Progress Summary ---
         if (settings.reportLayout !== 'simple') {
             checkAddPage(30); doc.setFontSize(14); doc.text('Resumo do Progresso', margin, currentY); currentY += 8; doc.setFontSize(10);
             const progressText = `O projeto "${project.clientName}" encontra-se ${projectStatusMap[project.status]}. Total de ${formatTimeReport(totalProjectSeconds)} dedicado através de ${stages.length} etapas, resultando em custo estimado de ${formatCurrency(totalProjectCost)}. As etapas chave concluídas ou em andamento incluem: ${stages.filter(s => s.status === 'Concluído' || s.status === 'Em Andamento').slice(0, 3).map(s => s.name).join(', ')}...`;
             const splitText = doc.splitTextToSize(progressText, contentWidth); doc.text(splitText, margin, currentY); currentY += splitText.length * 4 + 5;
         }

        // --- Signature ---
        if (signatureUrl) {
            checkAddPage(35);
            try {
                const sigProps = doc.getImageProperties(signatureUrl); const sigWidth = 40; const sigHeight = (sigProps.height * sigWidth) / sigProps.width; currentY += 10;
                doc.setFontSize(11); doc.setTextColor(50); doc.text("Atenciosamente,", margin, currentY); doc.setTextColor(0); currentY += 5;
                doc.addImage(signatureUrl, 'JPEG', margin, currentY, sigWidth, sigHeight); currentY += sigHeight + 5; doc.setFontSize(9); doc.setTextColor(100);
                // TODO: Add architect name from env settings if available
                doc.text("Arquiteto(a) Responsável", margin, currentY); doc.setTextColor(0);
            } catch(e) { console.error("Erro assinatura:", e); doc.text("[Erro assinatura]", margin, currentY); currentY += 10; }
        }

      // --- Save PDF ---
      const safeClientName = project.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `GeniusERPCRM_Relatorio_${safeClientName}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(fileName);
      toast({ title: "Relatório Gerado", description: `Relatório PDF "${fileName}" baixado.` });
    } catch (error) {
      console.error('Falha ao gerar relatório:', error); toast({ title: "Erro", description: "Falha ao gerar relatório.", variant: "destructive" });
    } finally { setIsGenerating(false); }
  };

  return (
    <Button onClick={generateReport} disabled={isGenerating || !environmentDb} variant="outline" size="sm"> {/* Disable if no DB */}
      {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
      Baixar Relatório PDF
    </Button>
  );
}
