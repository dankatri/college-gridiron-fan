import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { LineupSlot } from '@/lib/types';
import { CalendarX, Warning as AlertTriangle } from '@phosphor-icons/react';

interface ByeWeekAlertProps {
  lineup: LineupSlot[];
  currentWeek: number;
}

export function ByeWeekAlert({ lineup, currentWeek }: ByeWeekAlertProps) {
  // Find players in lineup who are on bye this week
  const playersOnBye = lineup.filter(slot => 
    slot.player && 
    slot.player.hasByeWeek && 
    slot.player.byeWeek === currentWeek
  );

  if (playersOnBye.length === 0) {
    return null;
  }

  return (
    <Alert className="border-destructive/50 text-destructive bg-destructive/10">
      <AlertTriangle size={16} />
      <AlertDescription>
        <div className="space-y-2">
          <p className="font-medium">
            {playersOnBye.length === 1 
              ? 'Player on bye week' 
              : `${playersOnBye.length} players on bye week`
            }
          </p>
          <div className="flex flex-wrap gap-2">
            {playersOnBye.map(slot => (
              <Badge key={slot.slotIndex} variant="destructive" className="flex items-center gap-1">
                <CalendarX size={12} />
                {slot.player?.name} ({slot.player?.team})
              </Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            These players will not earn points this week. Consider replacing them with active players.
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}