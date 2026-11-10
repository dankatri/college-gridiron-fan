import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Bandaids } from '@phosphor-icons/react';
import { availabilityLabel, availabilityTooltip, type PlayerAvailability } from '@/lib/player-availability';

interface PlayerAvailabilityIndicatorProps {
  availability: PlayerAvailability;
  team?: string;
  className?: string;
}

/**
 * Flags a player who has stopped appearing in box scores.
 *
 * Renders nothing unless there is something to report, so the common case adds
 * no visual noise to a list of several hundred players.
 */
export function PlayerAvailabilityIndicator({
  availability,
  team,
  className,
}: PlayerAvailabilityIndicatorProps) {
  const label = availabilityLabel(availability);
  const tooltip = availabilityTooltip(availability, team);
  if (!label || !tooltip) return null;

  // One missed week is weak evidence and shouldn't shout; a run of them is
  // worth a player's attention before they spend a pick.
  const variant = availability.missedWeeks.length > 1 ? 'destructive' : 'secondary';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className={`flex items-center gap-1 text-xs ${className ?? ''}`}>
            <Bandaids size={12} />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
