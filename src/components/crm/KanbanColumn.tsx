
'use client';

import React from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { KanbanColumn as KanbanColumnType, Lead, Proposal } from '@/db/db'; // Import Proposal
import LeadCard from './LeadCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface KanbanColumnProps {
  column: KanbanColumnType;
  leads: Lead[];
  onCardClick: (lead: Lead) => void; // Callback when a lead card is clicked
  proposalsLookup: { [leadId: number]: Proposal[] }; // Lookup table for proposals
}

export default function KanbanColumnComponent({ column, leads, onCardClick, proposalsLookup }: KanbanColumnProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id, // Use the string ID of the column
    data: {
      type: 'Column',
      column: column,
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  // Prepare lead IDs for SortableContext within this column
  const leadIds = React.useMemo(() => leads.map((lead) => lead.id!).filter(id => id !== undefined), [leads]); // Ensure IDs are defined


  return (
    <div
      ref={setNodeRef}
      style={style}
      // Make the entire column a potential drop zone
      className="flex flex-col w-full md:w-72 lg:w-80 shrink-0 h-full"
    >
       {/* Visual representation using Card */}
      <Card className={`flex flex-col flex-1 h-full border-t-4 border-primary`}> {/* Use consistent border color or map based on column ID */}
         {/* Column Header - Draggable Handle */}
        <CardHeader
            {...attributes} // Make header draggable
            {...listeners}
            className="p-3 flex flex-row items-center justify-between border-b cursor-grab touch-none bg-muted/50 rounded-t-lg"
        >
           {/* Use column.statusLabel for display */}
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {column.statusLabel}
            <span className="ml-2 text-xs font-normal text-muted-foreground bg-background px-1.5 py-0.5 rounded-full border">
              {leads.length}
            </span>
          </CardTitle>
          {/* Optional: Add column actions (e.g., rename, delete) */}
        </CardHeader>

        {/* Column Content - Lead Cards */}
        <CardContent className="flex flex-col gap-2 p-2 overflow-y-auto flex-grow min-h-[100px] h-[calc(100vh-18rem)] scrollbar-thin scrollbar-thumb-muted scrollbar-track-background">
           {/* Sortable context for leads within this column */}
          <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
            {leads.length > 0 ? (
              leads.map((lead) => {
                 // Ensure lead.id is defined before looking up proposals
                 const leadProposals = lead.id !== undefined && proposalsLookup ? proposalsLookup[lead.id] ?? [] : [];
                 const primaryProposalValue = leadProposals[0]?.totalValue; // Get value of the first proposal

                 // Render LeadCard only if lead.id is defined
                 return lead.id !== undefined ? (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => onCardClick(lead)} // Add onClick handler
                      primaryProposalValue={primaryProposalValue} // Pass the value
                    />
                 ) : null;
              })
            ) : (
              <div className="text-center text-xs text-muted-foreground py-4 px-2">
                Arraste leads para esta etapa.
              </div>
            )}
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  );
}
