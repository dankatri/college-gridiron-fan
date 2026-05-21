import { LineupSlot, Player } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { X, User } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface LineupSlotCardProps {
  slot: LineupSlot;
  onRemovePlayer?: (slotIndex: number) => void;
  onDropPlayer?: (player: Player, slotIndex: number) => void;
  canDrop?: boolean;
  isLocked?: boolean;
}

export function LineupSlotCard({ 
  slot, 
  onRemovePlayer,
  onDropPlayer,
  canDrop = false,
  isLocked = false
}: LineupSlotCardProps) {
  const handleRemove = () => {
    if (onRemovePlayer && !isLocked) {
      onRemovePlayer(slot.slotIndex);
    }
  };

  return (
    <Card 
      className={cn(
        "min-h-[68px] md:min-h-[80px] transition-all duration-200",
        !slot.player && "border-dashed border-2 border-muted-foreground/20",
        slot.player && "border-solid",
        isLocked && "opacity-75 cursor-not-allowed"
      )}
    >
      <CardHeader className="px-3 pt-3 pb-2 md:px-6 md:pt-6 md:pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{slot.position}</Badge>
            <span className="text-xs text-muted-foreground">
              Slot {slot.slotIndex + 1}
            </span>
          </div>
          {slot.player && onRemovePlayer && !isLocked && (
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
      
      <CardContent className="px-3 pb-3 pt-0 md:px-6 md:pb-6">
        {slot.player ? (
          <div className="space-y-1.5 md:space-y-2">
            <div className="flex items-start gap-2 md:gap-3">
              <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                {slot.player.headshotUrl ? (
                  <img 
                    src={slot.player.headshotUrl} 
                    alt={`${slot.player.name} headshot`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`absolute inset-0 flex items-center justify-center ${slot.player.headshotUrl ? 'hidden' : ''}`}>
                  <User size={16} className="text-muted-foreground md:hidden" />
                  <User size={20} className="text-muted-foreground hidden md:block" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm leading-tight">
                  {slot.player.name}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  {slot.player.teamLogoUrl && (
                    <img 
                      src={slot.player.teamLogoUrl} 
                      alt={`${slot.player.team} logo`}
                      className="w-4 h-4 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  )}
                  <p className="text-xs text-muted-foreground truncate">
                    {slot.player.team}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <span className="text-sm font-semibold text-accent-foreground">
                {slot.player.projectedPoints.toFixed(1)} pts
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">
              Select a {slot.position} from the player list
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
