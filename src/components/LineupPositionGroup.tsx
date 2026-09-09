import { LineupSlot } from '@/lib/types';
import type { WeekPointsDisplay } from '@/lib/week-actuals';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { TeamLogo } from '@/components/TeamLogo';
import { cn } from '@/lib/utils';
import { X } from '@phosphor-icons/react';

interface LineupPositionGroupProps {
  position: 'QB' | 'RB' | 'WR';
  slots: LineupSlot[];
  onRemovePlayer?: (slotIndex: number) => void;
  /** Whether this individual slot is frozen, usually because its game began. */
  isSlotLocked?: (slot: LineupSlot) => boolean;
  /** Real points for a played week; absent means show the projection. */
  weekPointsFor?: (slot: LineupSlot) => WeekPointsDisplay | undefined;
}

/**
 * One box per position, holding that position's slots.
 *
 * Grouping is what makes "two of each" legible: a flat list of six cards
 * labelled Slot 1..6 makes the roster shape something you have to count out.
 * It also removes five of six card headers, which is most of the vertical
 * space the old layout spent on chrome rather than on players.
 */
export function LineupPositionGroup({
  position,
  slots,
  onRemovePlayer,
  isSlotLocked,
  weekPointsFor,
}: LineupPositionGroupProps) {
  const filled = slots.filter((slot) => slot.player || slot.playerId).length;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-2.5 py-1.5">
        <Badge variant="outline" className="text-xs">{position}</Badge>
        <span
          className={cn(
            'text-xs tabular-nums',
            filled === slots.length ? 'text-muted-foreground' : 'text-orange-600',
          )}
        >
          {filled}/{slots.length}
        </span>
      </div>

      <div className="space-y-1.5 p-1.5">
        {slots.map((slot) => (
          <LineupSlotRow
            key={slot.slotIndex}
            slot={slot}
            onRemovePlayer={onRemovePlayer}
            isLocked={isSlotLocked?.(slot) ?? false}
            weekPoints={weekPointsFor?.(slot)}
          />
        ))}
      </div>
    </div>
  );
}

interface LineupSlotRowProps {
  slot: LineupSlot;
  onRemovePlayer?: (slotIndex: number) => void;
  isLocked: boolean;
  weekPoints?: WeekPointsDisplay;
}

function LineupSlotRow({ slot, onRemovePlayer, isLocked, weekPoints }: LineupSlotRowProps) {
  if (!slot.player) {
    return (
      <div className="rounded-md border-2 border-dashed border-muted-foreground/25 px-2 py-2.5 text-center">
        <p className="text-xs text-muted-foreground">
          {slot.playerId ? `Saved ${slot.position} - player details unavailable` : `Empty ${slot.position} slot`}
        </p>
      </div>
    );
  }

  const player = slot.player;
  const pointsText = weekPoints
    ? weekPoints.text === '-'
      ? 'no game'
      : `${weekPoints.text} pts`
    : `${player.projectedPoints.toFixed(1)} pts`;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-2 py-1.5',
        isLocked && 'opacity-75',
      )}
    >
      <PlayerAvatar player={player} size="xs" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{player.name}</p>
        <div className="flex items-center gap-1">
          <TeamLogo player={player} size="sm" />
          <span className="truncate text-xs text-muted-foreground">{player.team}</span>
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end leading-tight" title={weekPoints?.title}>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {weekPoints?.label ?? 'Proj'}
        </span>
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            weekPoints?.muted ? 'text-muted-foreground' : 'text-accent-foreground',
          )}
        >
          {pointsText}
        </span>
      </div>

      {onRemovePlayer && !isLocked && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemovePlayer(slot.slotIndex)}
          aria-label={`Remove ${player.name}`}
          className="h-6 w-6 flex-shrink-0 p-0 hover:bg-destructive/10"
        >
          <X size={12} className="text-destructive" />
        </Button>
      )}
    </div>
  );
}
