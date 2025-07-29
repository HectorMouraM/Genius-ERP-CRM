
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type EnvironmentSettings, getEnvironmentSettings } from '@/db/db'; // Import Environment types/functions
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Upload, Trash2, Image as ImageIcon, BellRing, LayoutList, Loader2 } from 'lucide-react'; // Added Loader2
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

// Helper remains the same
const getImageDataUrl = (imageData?: Blob | string): string | null => { if (!imageData) return null; if (typeof imageData === 'string') return imageData; if (imageData instanceof Blob) { try { return URL.createObjectURL(imageData); } catch (e) { console.error("Erro URL:", e); return null; } } return null; };

// Definitions remain the same
const reportLayoutMap: { [key in NonNullable<EnvironmentSettings['reportLayout']>]: string } = { 'simple': 'Layout Simples', 'detailed': 'Layout Detalhado' };
const reportLayoutKeys = Object.keys(reportLayoutMap) as (keyof typeof reportLayoutMap)[];

// General Settings now operates on the Current Logged-in User's Environment
export default function GeneralSettings() {
    const { toast } = useToast();
    const { user, isLoading: isAuthLoading, currentEnvironmentDb } = useAuth(); // Get context
    const [settings, setSettings] = useState<EnvironmentSettings | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);

    // Fetch environment-specific settings
    useEffect(() => {
        const loadSettings = async () => {
            if (isAuthLoading || !currentEnvironmentDb) return; // Wait for auth and DB
            setIsLoadingSettings(true);
            try {
                const currentSettings = await getEnvironmentSettings(currentEnvironmentDb);
                setSettings(currentSettings);
            } catch (error) {
                console.error("Failed to load environment settings:", error);
                toast({ title: "Erro ao Carregar", description: "Não foi possível carregar as configurações do ambiente.", variant: "destructive"});
            } finally {
                setIsLoadingSettings(false);
            }
        };
        loadSettings();
    }, [currentEnvironmentDb, isAuthLoading, toast]); // Depend on DB instance and auth loading

     // Update previews when settings change
    useEffect(() => {
        let logoUrl: string | null = null;
        if (settings?.logoImage) { logoUrl = getImageDataUrl(settings.logoImage); setLogoPreview(logoUrl); }
        else { setLogoPreview(null); }
        return () => { if (logoUrl && logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl); };
    }, [settings?.logoImage]);
    useEffect(() => {
        let sigUrl: string | null = null;
        if (settings?.signatureImage) { sigUrl = getImageDataUrl(settings.signatureImage); setSignaturePreview(sigUrl); }
        else { setSignaturePreview(null); }
        return () => { if (sigUrl && sigUrl.startsWith('blob:')) URL.revokeObjectURL(sigUrl); };
    }, [settings?.signatureImage]);


     const debouncedUpdateSettings = useDebounce(async (newSettings: Partial<EnvironmentSettings>) => {
        if (!currentEnvironmentDb) return; // Need DB instance
        try {
            // Always use ID 1 for the singleton settings object within the environment DB
            await currentEnvironmentDb.environmentSettings.update(1, newSettings);
        } catch (error) {
            console.error("Falha ao atualizar config. ambiente:", error);
            toast({ title: "Erro ao Salvar", description: "Não foi possível salvar as alterações.", variant: "destructive" });
        }
    }, 500);

    const handleSettingChange = useCallback((key: keyof EnvironmentSettings, value: any) => {
        setSettings(prev => {
            if (!prev) return null;
            const updatedSettings = { ...prev, [key]: value };
             // Only trigger debounce if DB is available
             if (currentEnvironmentDb) {
                debouncedUpdateSettings(updatedSettings);
             } else {
                 console.warn("DB instance not available for debounced update.");
             }
            return updatedSettings;
        });
    }, [debouncedUpdateSettings, currentEnvironmentDb]); // Add currentEnvironmentDb dependency


    const handleImageUpload = async (field: 'logoImage' | 'signatureImage', file: File) => {
        if (!currentEnvironmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
        if (!file.type.startsWith('image/')) return toast({ title: "Arquivo Inválido", variant: "destructive" });
        try {
            const imageData = new Blob([file], { type: file.type });
            handleSettingChange(field, imageData); // Update state & trigger debounce
            const previewUrl = URL.createObjectURL(imageData);
            if (field === 'logoImage') setLogoPreview(previewUrl); else setSignaturePreview(previewUrl);
            toast({ title: "Imagem Enviada", description: `${field === 'logoImage' ? 'Logo' : 'Assinatura'} atualizada.` });
        } catch (error) { console.error("Falha upload img:", error); toast({ title: "Erro Upload", variant: "destructive" }); }
    };

     const handleImageDelete = (field: 'logoImage' | 'signatureImage') => {
         if (!currentEnvironmentDb) return toast({ title: "Erro", description: "DB do ambiente não disponível.", variant: "destructive" });
         handleSettingChange(field, undefined);
         if (field === 'logoImage') { if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview); setLogoPreview(null); }
         else { if (signaturePreview?.startsWith('blob:')) URL.revokeObjectURL(signaturePreview); setSignaturePreview(null); }
         toast({ title: "Imagem Removida" });
     };

    // Render loading or different states
    if (isAuthLoading || isLoadingSettings) {
        return <Card><CardContent className='p-6 flex items-center gap-2'><Loader2 className='h-5 w-5 animate-spin text-primary'/> Carregando configurações...</CardContent></Card>;
    }
    if (!currentEnvironmentDb && user?.role !== 'Admin') {
         return <Card><CardContent className='p-6 text-destructive'>Erro: Ambiente de dados não encontrado.</CardContent></Card>;
     }
     if (user?.role === 'Admin') {
          return <Card><CardContent className='p-6 text-muted-foreground'>Administradores Globais gerenciam configurações por ambiente na tela de Ambientes.</CardContent></Card>;
     }
     if (!settings) {
         return <Card><CardContent className='p-6 text-destructive'>Não foi possível carregar as configurações.</CardContent></Card>;
     }


    return (
        <div className="space-y-6">
            {/* Logo and Signature Card */}
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Identidade Visual (Ambiente)</CardTitle><CardDescription>Logo e assinatura padrão para este ambiente.</CardDescription></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Logo */}
                    <div className="space-y-2">
                        <Label htmlFor="env-logo-upload">Logo do Ambiente</Label>
                        {logoPreview ? ( <div className="relative group w-32 h-32 border rounded-md overflow-hidden bg-muted"><Image src={logoPreview} alt="Logo" layout="fill" objectFit="contain" /><Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 z-10" onClick={() => handleImageDelete('logoImage')} title="Remover"><Trash2 className="h-3 w-3" /></Button></div> ) : ( <div className="w-32 h-32 border rounded-md flex items-center justify-center bg-muted text-muted-foreground"><ImageIcon className="h-8 w-8" /></div> )}
                        <Input id="env-logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload('logoImage', e.target.files[0])} />
                        <Button asChild variant="outline" size="sm"><Label htmlFor="env-logo-upload" className="cursor-pointer"><Upload className="mr-2 h-4 w-4" /> {logoPreview ? 'Alterar Logo' : 'Enviar Logo'}</Label></Button>
                    </div>
                    {/* Signature */}
                     <div className="space-y-2">
                        <Label htmlFor="env-signature-upload">Assinatura Padrão</Label>
                         {signaturePreview ? ( <div className="relative group w-48 h-24 border rounded-md overflow-hidden bg-muted"><Image src={signaturePreview} alt="Assinatura" layout="fill" objectFit="contain" /><Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 z-10" onClick={() => handleImageDelete('signatureImage')} title="Remover"><Trash2 className="h-3 w-3" /></Button></div> ) : ( <div className="w-48 h-24 border rounded-md flex items-center justify-center bg-muted text-muted-foreground"><ImageIcon className="h-8 w-8" /></div> )}
                        <Input id="env-signature-upload" type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload('signatureImage', e.target.files[0])} />
                        <Button asChild variant="outline" size="sm"><Label htmlFor="env-signature-upload" className="cursor-pointer"><Upload className="mr-2 h-4 w-4" /> {signaturePreview ? 'Alterar Assinatura' : 'Enviar Assinatura'}</Label></Button>
                    </div>
                </CardContent>
            </Card>

            {/* Notification Settings Card */}
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" /> Notificações (Ambiente)</CardTitle><CardDescription>Alertas visuais para prazos neste ambiente.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="enable-deadline-warning" className="flex flex-col space-y-1"><span>Habilitar Avisos de Prazo</span><span className="font-normal text-muted-foreground">Mostrar indicadores para etapas próximas do prazo.</span></Label>
                        <Switch id="enable-deadline-warning" checked={settings.enableDeadlineWarning ?? false} onCheckedChange={(checked) => handleSettingChange('enableDeadlineWarning', checked)} />
                    </div>
                    {settings.enableDeadlineWarning && (
                        <div className="space-y-1">
                            <Label htmlFor="deadline-warning-days">Limite (Dias Antes)</Label>
                            <Input id="deadline-warning-days" type="number" min="1" value={settings.deadlineWarningDays ?? 7} onChange={(e) => handleSettingChange('deadlineWarningDays', parseInt(e.target.value, 10) || 1)} className="w-24" />
                            <p className="text-xs text-muted-foreground pt-1">Salvo automaticamente.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Report Layout Settings Card */}
             <Card>
                 <CardHeader><CardTitle className="flex items-center gap-2"><LayoutList className="h-5 w-5" /> Configurações de Relatório (Ambiente)</CardTitle><CardDescription>Layout padrão para relatórios PDF neste ambiente.</CardDescription></CardHeader>
                 <CardContent>
                     <div className="space-y-1">
                         <Label htmlFor="report-layout">Layout Padrão</Label>
                         <Select value={settings.reportLayout ?? 'simple'} onValueChange={(value) => handleSettingChange('reportLayout', value as EnvironmentSettings['reportLayout'])} >
                             <SelectTrigger id="report-layout" className="w-full md:w-[250px]"><SelectValue /></SelectTrigger>
                             <SelectContent>{reportLayoutKeys.map(key => (<SelectItem key={key} value={key}>{reportLayoutMap[key]}</SelectItem>))}</SelectContent>
                         </Select>
                         <p className="text-xs text-muted-foreground pt-1">Salvo automaticamente.</p>
                     </div>
                 </CardContent>
             </Card>
        </div>
    );
}
