import { LineupSlot, Player } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface LineupSlotCardProps {
  slot: LineupSlot;
  onRemovePlayer?: (slotIndex: number) => void;
  onDropPlayer?: (player: Player, slotIndex: number) => void;
  canDrop?: boolean;
}

export function LineupSlotCard({ 
  slot, 
  onRemovePlayer, 
  onDropPlayer,
  canDrop = false 
}: LineupSlotCardProps) {
  const handleDragOver = (e: React.DragEvent) => {
    if (canDrop) {
      e.preventDefault();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (canDrop && onDropPlayer) {
      e.preventDefault();
      const playerData = e.dataTransfer.getData('application/json');
      if (playerData) {
        const player: Player = JSON.parse(playerData);
        if (player.position === slot.position) {
          onDropPlayer(player, slot.slotIndex);
        }
      }
    }
  };

  const handleRemove = () => {
    if (onRemovePlayer) {
      onRemovePlayer(slot.slotIndex);
    }
  };

  return (
    <Card 
      className={cn(
        "min-h-[120px] transition-all duration-200",
        canDrop && "border-dashed border-2 border-primary/50 bg-primary/5",
        slot.player && "border-solid"
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{slot.position}</Badge>
            <span className="text-xs text-muted-foreground">
              Slot {slot.slotIndex + 1}
            </span>
          </div>
          {slot.player && onRemovePlayer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="h-6 w-6 p-0 hover:bg-destructive/10"
            >
              <X size={12} className="text-destructive" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        {slot.player ? (
          <div className="space-y-2">
            <div>
              <h4 className="font-semibold text-sm leading-tight">
                {slot.player.name}
              </h4>
              <p className="text-xs text-muted-foreground">
                {slot.player.team}
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold text-accent-foreground">
                {slot.player.projectedPoints.toFixed(1)} pts
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">
              Drop {slot.position} here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}