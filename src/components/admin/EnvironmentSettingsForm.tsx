
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getEnvironmentDB, type EnvironmentDB, type EnvironmentSettings, getEnvironmentSettings } from '@/db/db';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Upload, Trash2, Image as ImageIcon, BellRing, LayoutList, Loader2, DollarSign } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

// Helper remains the same
const getImageDataUrl = (imageData?: Blob | string): string | null => { if (!imageData) return null; if (typeof imageData === 'string') return imageData; if (imageData instanceof Blob) { try { return URL.createObjectURL(imageData); } catch (e) { console.error("Erro URL:", e); return null; } } return null; };

// Definitions remain the same
const reportLayoutMap: { [key in NonNullable<EnvironmentSettings['reportLayout']>]: string } = { 'simple': 'Layout Simples', 'detailed': 'Layout Detalhado' };
const reportLayoutKeys = Object.keys(reportLayoutMap) as (keyof typeof reportLayoutMap)[];
const billingTypeMap: { [key in NonNullable<EnvironmentSettings['defaultBillingType']>]: string } = { 'fixed': 'Valor Fechado', 'hourly': 'Por Hora' };
const billingTypeKeys = Object.keys(billingTypeMap) as (keyof typeof billingTypeMap)[];

interface EnvironmentSettingsFormProps {
  environmentId: number;
}

export default function EnvironmentSettingsForm({ environmentId }: EnvironmentSettingsFormProps) {
  const { toast } = useToast();
  const [environmentDb, setEnvironmentDb] = useState<EnvironmentDB | null>(null);
  const [settings, setSettings] = useState<EnvironmentSettings | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Get DB instance and load settings
  useEffect(() => {
    let isMounted = true;
    const initDbAndLoadSettings = async () => {
      try {
        setIsLoadingSettings(true);
        const db = await getEnvironmentDB(environmentId);
        if (!isMounted) return;
        setEnvironmentDb(db);
        const currentSettings = await getEnvironmentSettings(db);
        if (!isMounted) return;
        setSettings(currentSettings);
      } catch (error) {
        console.error("Failed to initialize DB or load settings:", error);
        toast({ title: "Erro", description: "Não foi possível carregar o banco ou as configurações do ambiente.", variant: "destructive" });
      } finally {
        if (isMounted) setIsLoadingSettings(false);
      }
    };
    initDbAndLoadSettings();
    return () => { isMounted = false; }; // Cleanup on unmount
  }, [environmentId, toast]);

  // Update previews when settings change
  useEffect(() => {
    let logoUrl: string | null = null; if (settings?.logoImage) { logoUrl = getImageDataUrl(settings.logoImage); setLogoPreview(logoUrl); } else { setLogoPreview(null); }
    return () => { if (logoUrl && logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl); };
  }, [settings?.logoImage]);
  useEffect(() => {
    let sigUrl: string | null = null; if (settings?.signatureImage) { sigUrl = getImageDataUrl(settings.signatureImage); setSignaturePreview(sigUrl); } else { setSignaturePreview(null); }
    return () => { if (sigUrl && sigUrl.startsWith('blob:')) URL.revokeObjectURL(sigUrl); };
  }, [settings?.signatureImage]);

  // Debounced update function
  const debouncedUpdateSettings = useDebounce(async (newSettings: Partial<EnvironmentSettings>) => {
    if (!environmentDb) return;
    try { await environmentDb.environmentSettings.update(1, newSettings); } catch (error) { console.error("Falha ao atualizar config:", error); toast({ title: "Erro Salvar", variant: "destructive" }); }
  }, 500);

  // Generic handler for setting changes
  const handleSettingChange = useCallback((key: keyof EnvironmentSettings, value: any) => {
    setSettings(prev => {
      if (!prev) return null;
      const updatedSettings = { ...prev, [key]: value };
      if (environmentDb) debouncedUpdateSettings(updatedSettings);
      return updatedSettings;
    });
  }, [debouncedUpdateSettings, environmentDb]);

  // Image upload/delete handlers
  const handleImageUpload = async (field: 'logoImage' | 'signatureImage', file: File) => { if (!environmentDb) return toast({ title: "Erro", description: "DB não disponível.", variant: "destructive" }); if (!file.type.startsWith('image/')) return toast({ title: "Arquivo Inválido", variant: "destructive" }); try { const imageData = new Blob([file], { type: file.type }); handleSettingChange(field, imageData); const previewUrl = URL.createObjectURL(imageData); if (field === 'logoImage') setLogoPreview(previewUrl); else setSignaturePreview(previewUrl); toast({ title: "Imagem Enviada" }); } catch (error) { console.error("Erro upload:", error); toast({ title: "Erro Upload", variant: "destructive" }); } };
  const handleImageDelete = (field: 'logoImage' | 'signatureImage') => { if (!environmentDb) return toast({ title: "Erro", description: "DB não disponível.", variant: "destructive" }); handleSettingChange(field, undefined); if (field === 'logoImage') { if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview); setLogoPreview(null); } else { if (signaturePreview?.startsWith('blob:')) URL.revokeObjectURL(signaturePreview); setSignaturePreview(null); } toast({ title: "Imagem Removida" }); };

  // Loading/Error States
  if (isLoadingSettings) return <div className="p-6 flex items-center justify-center gap-2"><Loader2 className='h-5 w-5 animate-spin text-primary'/> Carregando configurações...</div>;
  if (!environmentDb || !settings) return <div className="p-6 text-destructive">Erro ao carregar configurações do ambiente.</div>;

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
        {/* Logo and Signature Card */}
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Identidade Visual</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label htmlFor={`logo-upload-${environmentId}`}>Logo</Label>{logoPreview ? ( <div className="relative group w-32 h-32 border rounded-md overflow-hidden bg-muted"><Image src={logoPreview} alt="Logo" layout="fill" objectFit="contain" /><Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 z-10" onClick={() => handleImageDelete('logoImage')} title="Remover"><Trash2 className="h-3 w-3" /></Button></div> ) : ( <div className="w-32 h-32 border rounded-md flex items-center justify-center bg-muted text-muted-foreground"><ImageIcon className="h-8 w-8" /></div> )} <Input id={`logo-upload-${environmentId}`} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload('logoImage', e.target.files[0])} /> <Button asChild variant="outline" size="sm"><Label htmlFor={`logo-upload-${environmentId}`} className="cursor-pointer"><Upload className="mr-2 h-4 w-4" /> {logoPreview ? 'Alterar' : 'Enviar'}</Label></Button></div>
                <div className="space-y-2"><Label htmlFor={`sig-upload-${environmentId}`}>Assinatura</Label>{signaturePreview ? ( <div className="relative group w-48 h-24 border rounded-md overflow-hidden bg-muted"><Image src={signaturePreview} alt="Assinatura" layout="fill" objectFit="contain" /><Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 z-10" onClick={() => handleImageDelete('signatureImage')} title="Remover"><Trash2 className="h-3 w-3" /></Button></div> ) : ( <div className="w-48 h-24 border rounded-md flex items-center justify-center bg-muted text-muted-foreground"><ImageIcon className="h-8 w-8" /></div> )} <Input id={`sig-upload-${environmentId}`} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload('signatureImage', e.target.files[0])} /> <Button asChild variant="outline" size="sm"><Label htmlFor={`sig-upload-${environmentId}`} className="cursor-pointer"><Upload className="mr-2 h-4 w-4" /> {signaturePreview ? 'Alterar' : 'Enviar'}</Label></Button></div>
            </CardContent>
        </Card>

        {/* Operational Parameters */}
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">Parâmetros Operacionais</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1"><Label htmlFor="defaultBillingType">Cobrança Padrão (Novos Projetos)</Label><Select value={settings.defaultBillingType ?? 'fixed'} onValueChange={(value) => handleSettingChange('defaultBillingType', value)}><SelectTrigger id="defaultBillingType"><SelectValue /></SelectTrigger><SelectContent>{billingTypeKeys.map(key => (<SelectItem key={key} value={key}>{billingTypeMap[key]}</SelectItem>))}</SelectContent></Select></div>
                <div className="space-y-1"><Label htmlFor="defaultHourlyRate">Valor Hora Base (R$)</Label><Input id="defaultHourlyRate" type="number" step="0.01" min="0" placeholder="Ex: 150,00" value={settings.defaultHourlyRate ?? ''} onChange={(e) => handleSettingChange('defaultHourlyRate', e.target.value === '' ? undefined : parseFloat(e.target.value))} /></div>
                <div className="flex items-center justify-between space-x-2 border p-3 rounded-md md:col-span-2"><Label htmlFor="requireStageDeadline">Exigir Prazo nas Etapas?</Label><Switch id="requireStageDeadline" checked={settings.requireStageDeadline ?? false} onCheckedChange={(checked) => handleSettingChange('requireStageDeadline', checked)} /></div>
            </CardContent>
        </Card>

        {/* Notification Settings Card */}
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" /> Notificações</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2"><Label htmlFor="enableDeadlineWarning">Habilitar Avisos de Prazo</Label><Switch id="enableDeadlineWarning" checked={settings.enableDeadlineWarning ?? true} onCheckedChange={(checked) => handleSettingChange('enableDeadlineWarning', checked)} /></div>
                {settings.enableDeadlineWarning && (<div className="space-y-1"><Label htmlFor="deadlineWarningDays">Limite (Dias Antes)</Label><Input id="deadlineWarningDays" type="number" min="1" value={settings.deadlineWarningDays ?? 7} onChange={(e) => handleSettingChange('deadlineWarningDays', parseInt(e.target.value, 10) || 1)} className="w-24" /></div>)}
            </CardContent>
        </Card>

        {/* Report Layout Settings Card */}
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><LayoutList className="h-5 w-5" /> Configurações de Relatório</CardTitle></CardHeader>
            <CardContent><div className="space-y-1"><Label htmlFor="reportLayout">Layout Padrão PDF</Label><Select value={settings.reportLayout ?? 'simple'} onValueChange={(value) => handleSettingChange('reportLayout', value as EnvironmentSettings['reportLayout'])}><SelectTrigger id="reportLayout"><SelectValue /></SelectTrigger><SelectContent>{reportLayoutKeys.map(key => (<SelectItem key={key} value={key}>{reportLayoutMap[key]}</SelectItem>))}</SelectContent></Select></div></CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center pt-2">As alterações são salvas automaticamente.</p>
    </div>
  );
}
