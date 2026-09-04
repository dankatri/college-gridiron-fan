import { useCallback, useEffect, useState } from 'react';
import { WEEK_LABELS } from '@/lib/season-config';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Lock, User } from '@phosphor-icons/react';

interface MemberLineupSlot {
  slotIndex: number;
  position: string;
  playerId: string | null;
  name: string | null;
  team: string | null;
  projectedPoints: number | null;
  actualPoints: number | null;
}

interface MemberLineup {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  week: number;
  slots: MemberLineupSlot[];
  totalPoints: number;
  projectedPoints: number;
  availableWeeks: number[];
}

interface MemberLineupDialogProps {
  leagueId: string;
  member: { userId: string; username: string; avatarUrl?: string } | null;
  week: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const weekLabel = (week: number) => WEEK_LABELS[week] ?? `Week ${week}`;

/**
 * Another league member's lineup for a finished week.
 *
 * The server is what enforces the reveal; this only ever shows what it was
 * willing to hand over, and surfaces its refusal verbatim when it declines.
 */
export function MemberLineupDialog({ leagueId, member, week, open, onOpenChange }: MemberLineupDialogProps) {
  const [viewWeek, setViewWeek] = useState(week);
  const [lineup, setLineup] = useState<MemberLineup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) setViewWeek(week);
  }, [open, week, member?.userId]);

  const load = useCallback(async () => {
    if (!member) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/member-lineup?userId=${encodeURIComponent(member.userId)}&week=${viewWeek}`,
        { credentials: 'include' },
      );
      const payload = await response.json();
      if (!response.ok) {
        setLineup(null);
        setError(payload.error || 'Could not load that lineup');
        return;
      }
      setLineup(payload as MemberLineup);
    } catch {
      setLineup(null);
      setError('Could not load that lineup');
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, member, viewWeek]);

  useEffect(() => {
    if (!open || !member) return;
    void load();
  }, [open, member, load]);

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
            {weekLabel(viewWeek)} lineup
          </DialogDescription>
        </DialogHeader>

        {(lineup?.availableWeeks.length ?? 0) > 1 && (
          <div className="flex flex-wrap gap-1">
            {lineup!.availableWeeks.map((candidate) => (
              <Button
                key={candidate}
                size="sm"
                variant={candidate === viewWeek ? 'default' : 'outline'}
                onClick={() => setViewWeek(candidate)}
              >
                {weekLabel(candidate)}
              </Button>
            ))}
          </div>
        )}

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading lineup…</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Lock size={32} className="opacity-50" />
            <p className="text-sm">{error}</p>
          </div>
        ) : filledSlots.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {member?.username} did not set a lineup for {weekLabel(viewWeek)}.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <div className="text-2xl font-bold text-accent">{lineup!.totalPoints.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Points scored</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <div className="text-2xl font-bold">{lineup!.projectedPoints.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Projected</div>
              </div>
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
