
'use client';

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Filter } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Import Select

interface DashboardFiltersProps {
  dateRange: DateRange | undefined;
  setDateRange: (dateRange: DateRange | undefined) => void;
  className?: string;
  // Add props for other filters like user, project type etc.
}

export default function DashboardFilters({
  dateRange,
  setDateRange,
  className,
}: DashboardFiltersProps) {

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
       {/* Date Range Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            size="sm"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y", { locale: ptBR })} -{" "}
                  {format(dateRange.to, "LLL dd, y", { locale: ptBR })}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y", { locale: ptBR })
              )
            ) : (
              <span>Escolha um período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={setDateRange}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      {/* Placeholder for other filters */}
        <Popover>
            <PopoverTrigger asChild>
               <Button variant="outline" size="sm" className="h-9">
                 <Filter className="mr-2 h-4 w-4" />
                 Mais Filtros
               </Button>
             </PopoverTrigger>
             <PopoverContent className="w-60 p-4" align="end">
               <div className="space-y-4">
                 <h4 className="font-medium leading-none">Filtros Adicionais</h4>
                 <p className="text-sm text-muted-foreground">
                   Filtros por colaborador, tipo de projeto, etc. (Em desenvolvimento).
                 </p>
                 {/* Example Select Filter (Disabled) */}
                 {/* <Select disabled>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por Usuário..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user1">Usuário 1</SelectItem>
                      <SelectItem value="user2">Usuário 2</SelectItem>
                    </SelectContent>
                 </Select> */}
               </div>
             </PopoverContent>
       </Popover>

    </div>
  );
}
