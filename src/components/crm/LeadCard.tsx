'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead, Proposal } from '@/db/db'; // Import Proposal type
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Phone, CalendarDays, Pencil, Trash2, StickyNote, User, FileText } from 'lucide-react'; // Added User, FileText
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface LeadCardProps {
  lead: Lead;
  isDragging?: boolean;
  onClick?: () => void; // Added onClick prop
   // We don't fetch proposals here directly, pass relevant info if needed
   // Example: Pass the value of the primary proposal if available
  primaryProposalValue?: number;
}

// Function to format currency
function formatCurrency(amount?: number): string {
    if (amount === undefined || amount === null) return '';
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}


export default function LeadCard({ lead, isDragging = false, onClick, primaryProposalValue }: LeadCardProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging: isCurrentlyDragging,
  } = useSortable({
    id: lead.id!,
    data: {
      type: 'Lead',
      lead: lead,
    },
    // Disable sorting within columns via Sortable HOC if clicking should open detail view
    // This prevents accidental drags when trying to click. Dragging is still possible by grabbing slightly away from interactive elements.
    // disabled: !!onClick, // Consider disabling sortable behavior if click is primary action
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
    opacity: isCurrentlyDragging || isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging || isCurrentlyDragging ? 10 : 'auto',
    // Ring for visual feedback during drag overlay
    // Ring should only apply in the overlay, not the original card
    // boxShadow: isDragging ? '0 0 0 2px hsl(var(--primary))' : undefined,
  };

  const timeAgo = formatDistanceToNow(lead.createdAt, { addSuffix: true, locale: ptBR });

  const handleCardClick = (e: React.MouseEvent) => {
      // Prevent click from propagating if a button inside the card was clicked
      if ((e.target as HTMLElement).closest('button, a')) {
          return;
      }
      onClick?.();
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick} // Use the wrapper click handler
      className={`p-3 rounded-md shadow-sm border bg-card hover:shadow-md transition-shadow duration-150 touch-manipulation ${isDragging ? 'ring-2 ring-primary opacity-50' : ''} ${onClick ? 'cursor-pointer' : 'cursor-grab'}`} // Conditional cursor
    >
      <CardHeader className="p-0 mb-2">
        <div className="flex justify-between items-start gap-1">
             <CardTitle className="text-sm font-semibold leading-tight line-clamp-2">{lead.name}</CardTitle>
              {/* Display Proposal Value if provided */}
             {primaryProposalValue !== undefined && (
                <Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">
                    {formatCurrency(primaryProposalValue)}
                </Badge>
             )}
        </div>
        {(lead.projectType || lead.subType) && (
             <CardDescription className="text-xs text-muted-foreground capitalize">
                {lead.projectType ? `${lead.projectType.toLowerCase()}` : ''} {lead.subType ? `- ${lead.subType}` : ''}
             </CardDescription>
         )}
      </CardHeader>
      <CardContent className="p-0 text-xs space-y-1.5">
        {lead.email && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} className="truncate hover:underline" title={lead.email}>{lead.email}</a>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.phone}</span>
          </div>
        )}
        {lead.responsible && (
           <div className="flex items-center gap-1.5 text-muted-foreground">
               <User className="h-3 w-3 shrink-0" />
               <span className="truncate">{lead.responsible}</span>
           </div>
        )}
         {lead.notes && (
           <TooltipProvider delayDuration={300}>
             <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-start gap-1.5 text-muted-foreground cursor-default">
                        <StickyNote className="h-3 w-3 shrink-0 mt-0.5" />
                        <p className="line-clamp-2">{lead.notes}</p>
                    </div>
                 </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="max-w-[250px] text-xs z-50"> {/* Ensure tooltip is above overlay */}
                     <p>{lead.notes}</p>
                 </TooltipContent>
             </Tooltip>
           </TooltipProvider>
         )}
      </CardContent>
      <CardFooter className="p-0 mt-2 flex justify-between items-center">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            <span>{timeAgo}</span>
        </div>
         {lead.source && (
            <TooltipProvider delayDuration={300}>
             <Tooltip>
                 <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs cursor-default">{lead.source}</Badge>
                 </TooltipTrigger>
                 <TooltipContent side="bottom" className="z-50"> {/* Ensure tooltip is above overlay */}
                     <p>Origem: {lead.source}</p>
                 </TooltipContent>
             </Tooltip>
           </TooltipProvider>
         )}
      </CardFooter>
    </Card>
  );
}