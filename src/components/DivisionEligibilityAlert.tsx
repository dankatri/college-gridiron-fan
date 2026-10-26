import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CLASSIFICATION_LABELS } from '@/lib/classification';
import { LineupSlot } from '@/lib/types';
import { divisionOf, divisionsForWeek, isPlayerEligibleForWeek } from '@/lib/week-divisions';
import { Prohibit, Warning as AlertTriangle } from '@phosphor-icons/react';

interface DivisionEligibilityAlertProps {
  lineup: LineupSlot[];
  currentWeek: number;
}

/**
 * Warns about players a lineup still holds who cannot play this week's
 * division.
 *
 * A lineup saved before the week's division rule applied — or carried over
 * from a week with a different one — keeps its players on screen, because the
 * saved slots hydrate from the whole pool rather than the selectable one.
 * Without this the save would simply be refused by the API with no visible
 * cause.
 */
export function DivisionEligibilityAlert({ lineup, currentWeek }: DivisionEligibilityAlertProps) {
  const ineligible = lineup.filter(slot => slot.player && !isPlayerEligibleForWeek(slot.player, currentWeek));
  if (ineligible.length === 0) return null;

  const allowed = divisionsForWeek(currentWeek).map(division => CLASSIFICATION_LABELS[division]).join(' or ');

  return (
    <Alert className="border-destructive/50 text-destructive bg-destructive/10">
      <AlertTriangle size={16} />
      <AlertDescription>
        <div className="space-y-2">
          <p className="font-medium">
            {ineligible.length === 1
              ? 'Player cannot be used this week'
              : `${ineligible.length} players cannot be used this week`}
          </p>
          <div className="flex flex-wrap gap-2">
            {ineligible.map(slot => (
              <Badge key={slot.slotIndex} variant="destructive" className="flex items-center gap-1">
                <Prohibit size={12} />
                {slot.player?.name} ({slot.player ? CLASSIFICATION_LABELS[divisionOf(slot.player)] : ''})
              </Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            This week is {allowed} only. Replace these players before saving, or the lineup will be rejected.
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}
