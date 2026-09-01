import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, CalendarX } from '@phosphor-icons/react';
import { Player } from '@/lib/types';

interface ByeWeekIndicatorProps {
  player: Player;
  currentWeek?: number;
  className?: string;
}

export function ByeWeekIndicator({ player, currentWeek, className }: ByeWeekIndicatorProps) {
  // Week numbers are zero-based, so compare against undefined rather than
  // relying on truthiness.
  if (!player.hasByeWeek || player.byeWeek === undefined) {
    return null;
  }

  const byeWeek = player.byeWeek;
  const isCurrentWeekBye = currentWeek === byeWeek;
  const isUpcomingBye = currentWeek !== undefined && byeWeek > currentWeek;
  const isPastBye = currentWeek !== undefined && byeWeek < currentWeek;

  const getVariant = () => {
    if (isCurrentWeekBye) return 'destructive';
    if (isUpcomingBye) return 'secondary';
    return 'outline';
  };

  const getTooltipText = () => {
    if (isCurrentWeekBye) {
      return `${player.team} is on BYE this week (Week ${player.byeWeek})`;
    }
    if (isUpcomingBye) {
      return `${player.team} has a bye week in Week ${player.byeWeek}`;
    }
    if (isPastBye) {
      return `${player.team} had their bye week in Week ${player.byeWeek}`;
    }
    return `${player.team} bye week: Week ${player.byeWeek}`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={getVariant()} 
            className={`flex items-center gap-1 text-xs ${className}`}
          >
            {isCurrentWeekBye ? (
              <>
                <CalendarX size={12} />
                BYE
              </>
            ) : (
              <>
                <Calendar size={12} />
                W{player.byeWeek}
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}