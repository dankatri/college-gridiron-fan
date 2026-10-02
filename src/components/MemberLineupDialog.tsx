import { useEffect, useState } from 'react';
import { useMinuteClock } from '@/hooks/use-minute-clock';
import { WEEK_LABELS, weekBoundary } from '@/lib/season-config';
import { isWeekComplete } from '@/lib/week-lock';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Lock, User } from '@phosphor-icons/react';

interface MemberLineupSlot {
  slotIndex: number;
  position: string;
  playerId: string | null;
  name: string | null;
  team: string | null;
  actualPoints: number | null;
}

interface MemberLineup {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  week: number;
  slots: MemberLineupSlot[];
  totalPoints: number;
  availableWeeks: number[];
}

interface MemberLineupDialogProps {
  leagueId: string;
  gameFinals: ReadonlySet<number>;
  member: { userId: string; username: string; avatarUrl?: string } | null;
  /** The week selected at the top of the page — the dialog follows it. */
  week: number;
  currentUserId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const weekLabel = (week: number) => WEEK_LABELS[week] ?? `Week ${week}`;

/**
 * The fallback reveal date if the schedule has not already confirmed all finals.
 */
function revealDate(week: number): Date | undefined {
  return weekBoundary(week + 1);
}

const formatRevealDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

/**
 * Another league member's lineup for a finished week.
 *
 * The server is what enforces the reveal; this only ever shows what it was
 * willing to hand over, and surfaces its refusal verbatim when it declines.
 */
export function MemberLineupDialog({
  leagueId,
  member,
  week,
  gameFinals,
  currentUserId,
  open,
  onOpenChange,
}: MemberLineupDialogProps) {
  const [lineup, setLineup] = useState<MemberLineup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const now = useMinuteClock();

  // Your own lineup is yours to look at whenever; everyone else's waits for the
  // week to finish. Checked here as well as on the server so the dialog can
  // explain the wait instead of firing a request it knows will be refused.
  const isOwnLineup = member !== null && member.userId === currentUserId;
  const isHidden = !isOwnLineup && !isWeekComplete(week, new Date(now), gameFinals);
  const revealsAt = revealDate(week);

  useEffect(() => {
    setLineup(null);
    setError(null);
    if (!open || !member || isHidden) return;
    const controller = new AbortController();
    let cancelled = false;
    setIsLoading(true);
    const load = async () => {
      try {
        const response = await fetch(
          `/api/leagues/${leagueId}/member-lineup?userId=${encodeURIComponent(member.userId)}&week=${week}`,
          { credentials: 'include', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) },
        );
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setLineup(null);
          setError(payload.error || 'Could not load that lineup');
          return;
        }
        setLineup(payload as MemberLineup);
      } catch (error) {
        if (cancelled) return;
        setLineup(null);
        setError(error instanceof Error ? error.message : 'Could not load that lineup');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [leagueId, member, week, open, isHidden]);

  const filledSlots = lineup?.slots.filter((slot) => slot.playerId) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={member?.avatarUrl} alt={member?.username} />
              <AvatarFallback><User size={16} /></AvatarFallback>
            </Avatar>
            {member?.username}
          </DialogTitle>
          <DialogDescription>
            {weekLabel(week)} lineup
          </DialogDescription>
        </DialogHeader>

        {isHidden ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Lock size={32} className="text-muted-foreground opacity-50" />
            <div className="space-y-1">
              <p className="font-medium">{weekLabel(week)} is not finished yet</p>
              <p className="text-sm text-muted-foreground">
                {revealsAt
                  ? <>Lineups are revealed when all games finish, or at the week cutoff on {formatRevealDate(revealsAt)}.</>
                  : <>Lineups for this week are revealed once it is over.</>}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Use the week selector at the top of the page to look at a finished week.
            </p>
          </div>
        ) : isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading lineup…</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Lock size={32} className="opacity-50" />
            <p className="text-sm">{error}</p>
          </div>
        ) : filledSlots.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {member?.username} did not set a lineup for {weekLabel(week)}.
          </p>
        ) : (
          <>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-2xl font-bold text-accent">{lineup!.totalPoints.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Points scored</div>
            </div>

            <Separator />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slot</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineup!.slots.map((slot) => (
                  <TableRow key={slot.slotIndex}>
                    <TableCell>
                      <Badge variant="outline">{slot.position}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {slot.name ?? <span className="text-muted-foreground">Empty</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{slot.team ?? '—'}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {slot.playerId ? (slot.actualPoints ?? 0).toFixed(1) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
