
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type EnvironmentDB, type EnvironmentSettings, getEnvironmentSettings } from '@/db/db'; // Import Environment types
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Loader2 } from 'lucide-react'; // Added Loader2
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

export default function RateSettings() {
    const { toast } = useToast();
    const { user, isLoading: isAuthLoading, currentEnvironmentDb } = useAuth(); // Get context
    const [rate, setRate] = useState<number | undefined>(undefined);
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);

    // Fetch environment-specific settings
    useEffect(() => {
        const loadRate = async () => {
             if (isAuthLoading || !currentEnvironmentDb) return; // Wait for auth and DB
             setIsLoadingSettings(true);
             try {
                const settings = await getEnvironmentSettings(currentEnvironmentDb);
                setRate(settings.defaultHourlyRate);
             } catch(error) {
                 console.error("Failed to load rate setting:", error);
                 toast({ title: "Erro ao Carregar Taxa", variant: "destructive"});
             } finally {
                 setIsLoadingSettings(false);
             }
        };
        loadRate();
    }, [currentEnvironmentDb, isAuthLoading, toast]); // Depend on DB instance and auth loading

    // Debounced function to update the rate in the specific environment database
    const debouncedUpdateRate = useDebounce(async (newRate: number | undefined) => {
        if (!currentEnvironmentDb) return; // Need DB instance
        if (newRate !== undefined && (isNaN(newRate) || newRate < 0)) {
            toast({ title: "Valor Inválido", variant: "destructive" });
            return;
        }
        try {
            // Update the singleton settings object (ID 1) in the environment DB
            await currentEnvironmentDb.environmentSettings.update(1, { defaultHourlyRate: newRate });
        } catch (error) {
            console.error("Falha ao atualizar valor/hora:", error);
            toast({ title: "Erro ao Salvar Valor", variant: "destructive" });
        }
    }, 500);

    const handleRateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        const newRate = value === '' ? undefined : parseFloat(value);
        setRate(newRate); // Update local state immediately
        if (newRate !== undefined && !isNaN(newRate)) {
             debouncedUpdateRate(newRate);
        } else if (value === '') {
             debouncedUpdateRate(undefined);
        }
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


    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Valor por Hora Padrão (Ambiente)</CardTitle>
                <CardDescription>Valor/hora padrão (R$) para novos projetos neste ambiente. Pode ser substituído por projeto.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="space-y-1">
                    <Label htmlFor="env-hourly-rate">Valor Padrão (R$/hora)</Label>
                    <Input
                        id="env-hourly-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="ex: 150,00"
                        value={rate ?? ''}
                        onChange={handleRateChange}
                        className="w-full md:w-[200px]"
                        disabled={!currentEnvironmentDb} // Disable if DB not ready
                    />
                     <p className="text-xs text-muted-foreground pt-1">As alterações são salvas automaticamente.</p>
                 </div>
            </CardContent>
        </Card>
    );
}
