import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LineupSlot, MAX_PLAYER_USES, Player } from '@/lib/types';
import { ALL_WEEKS } from '@/lib/types';
import { WEEK_LABELS } from '@/lib/season-config';
import { usePlayers } from '@/hooks/use-players';
import { hydrateSlots, toSlotPayload, type ApiLineupSlot } from '@/lib/lineup-state';
import { calculateProjectedPoints, createEmptyLineup } from '@/lib/utils-fantasy';
import { hasWeekStarted, isWeekComplete } from '@/lib/week-lock';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, LockSimple, ClockCounterClockwise, FloppyDisk, X, Warning } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface LeagueAdminProps {
  leagueId: string;
  gameFinals: ReadonlySet<number>;
  currentWeek: number;
  isOwner: boolean;
  onSaved: () => Promise<void>;
}

type ApiSlot = ApiLineupSlot;

type ApiMember = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  role?: string;
  weeksSet: number;
  lineup: { slots: ApiSlot[]; projectedPoints?: string | null; actualPoints?: string | null; updatedAt?: string } | null;
  playerUsage: Array<{ playerId: string; timesUsed: number }>;
};

type AuditEntry = {
  id: string;
  week: number;
  subjectName: string;
  actorName: string;
  previousSlots: ApiSlot[] | null;
  newSlots: ApiSlot[];
  reason: string | null;
  wasLocked: number;
  createdAt: string;
};

function describeChange(entry: AuditEntry, playersById: Map<string, Player>): string[] {
  const nameFor = (playerId: string | null | undefined) => {
    if (!playerId) return 'empty';
    return playersById.get(playerId)?.name ?? `player ${playerId}`;
  };

  if (!entry.previousSlots) {
    return [`Created lineup: ${entry.newSlots.map((slot) => nameFor(slot.playerId)).join(', ')}`];
  }

  const changes: string[] = [];
  for (const slot of entry.newSlots) {
    const before = entry.previousSlots.find((candidate) => candidate.slotIndex === slot.slotIndex);
    if (before?.playerId !== slot.playerId) {
      changes.push(`${slot.position}: ${nameFor(before?.playerId)} → ${nameFor(slot.playerId)}`);
    }
  }

  return changes.length > 0 ? changes : ['Saved with no slot changes'];
}

export function LeagueAdmin({ leagueId, currentWeek, gameFinals, isOwner, onSaved }: LeagueAdminProps) {
  const [week, setWeek] = useState<number>(currentWeek);
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [draftLineup, setDraftLineup] = useState<LineupSlot[]>(createEmptyLineup());
  const [reason, setReason] = useState('');
  const { players, error: playersError } = usePlayers(isOwner);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openSlotIndex, setOpenSlotIndex] = useState<number | null>(null);
  const scope = `${leagueId}:${week}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const requestVersion = useRef(0);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const baseline = useRef<{ key: string; signature: string } | null>(null);

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const selectedMember = loadedScope === scope ? members.find((member) => member.userId === selectedUserId) ?? null : null;

  const loadWeek = useCallback(async () => {
    if (!isOwner) return;
    const requestedScope = scopeRef.current;
    const version = ++requestVersion.current;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/admin?week=${week}`, { credentials: 'include', signal: AbortSignal.timeout(20_000) });
      const payload = await response.json();
      if (scopeRef.current !== requestedScope || version !== requestVersion.current) return;
      if (!response.ok) throw new Error(payload.error || 'Failed to load league admin data');

      setMembers(payload.members ?? []);
      setAuditLog(payload.auditLog ?? []);
      setLoadedScope(requestedScope);
    } catch (error) {
      if (scopeRef.current === requestedScope && version === requestVersion.current) {
        toast.error(error instanceof Error ? error.message : 'Failed to load league admin data');
      }
    } finally {
      if (scopeRef.current === requestedScope && version === requestVersion.current) setIsLoading(false);
    }
  }, [leagueId, week, isOwner]);

  useEffect(() => {
    void loadWeek();
    return () => { requestVersion.current++; };
  }, [loadWeek]);

  const draftKey = `${scope}:${selectedUserId ?? ''}`;
  const savedSlots = selectedMember?.lineup?.slots ?? [];
  const signature = JSON.stringify(savedSlots);
  useEffect(() => {
    const previous = baseline.current;
    const normalized = toSlotPayload(hydrateSlots(savedSlots, playersById));
    baseline.current = { key: draftKey, signature: JSON.stringify(normalized) };
    setDraftLineup(current => {
      if (previous?.key === draftKey && JSON.stringify(toSlotPayload(current)) !== previous.signature) {
        return hydrateSlots(toSlotPayload(current), playersById);
      }
      return hydrateSlots(savedSlots, playersById);
    });
    if (previous?.key !== draftKey) setReason('');
  }, [draftKey, signature, playersById]);

  /**
   * How many times a player is already used outside the week being edited.
   * Adding them here would make it one more.
   */
  const usageOutsideThisWeek = useCallback(
    (playerId: string) => {
      if (!selectedMember) return 0;
      const total = selectedMember.playerUsage.find((usage) => usage.playerId === playerId)?.timesUsed ?? 0;
      const usedInSavedWeek = selectedMember.lineup?.slots.some((slot) => slot.playerId === playerId) ? 1 : 0;
      return total - usedInSavedWeek;
    },
    [selectedMember],
  );

  const setSlotPlayer = (slotIndex: number, player: Player | undefined) => {
    setDraftLineup((current) =>
      current.map((slot) => (slot.slotIndex === slotIndex ? { ...slot, player, playerId: player?.id } : slot)),
    );
    setOpenSlotIndex(null);
  };

  const draftPlayerIds = new Set(draftLineup.map((slot) => slot.player?.id).filter(Boolean) as string[]);
  const isComplete = draftLineup.every((slot) => slot.player);
  const filledSlotCount = draftLineup.filter((slot) => slot.player).length;
  const projected = calculateProjectedPoints(draftLineup);
  const locked = hasWeekStarted(week);

  const handleSave = async () => {
    if (!selectedMember || isLoading || playersError || !players.length) {
      toast.error('Select a member and wait for the lineup and player data before saving');
      return;
    }

    setIsSaving(true);
    const requestedScope = scopeRef.current;
    try {
      const response = await fetch(`/api/leagues/${leagueId}/admin`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedMember.userId,
          week,
          reason,
          projectedPoints: projected,
          slots: toSlotPayload(draftLineup),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to save lineup');
      await onSaved();
      if (requestedScope !== scopeRef.current) return;
      toast.success(`Saved ${selectedMember.displayName}'s Week ${week} lineup`);
      setReason('');
      await loadWeek();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save lineup');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Only the league owner can access admin tools.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {playersError && <p role="alert" className="text-destructive">The player catalogue is unavailable. Return to Set Lineup to retry loading it.</p>}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-accent" />
            Admin — Member Lineups
          </CardTitle>
          <CardDescription>
            Set a lineup on a member's behalf. Locked weeks can still be edited here, and every change is recorded
            below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="admin-week">Week</Label>
              <Select value={String(week)} onValueChange={(value) => setWeek(Number(value))}>
                <SelectTrigger id="admin-week" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_WEEKS.map((weekNumber) => (
                    <SelectItem key={weekNumber} value={String(weekNumber)}>
                      {WEEK_LABELS[weekNumber] ?? `Week ${weekNumber}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {locked && (
              <Badge variant="destructive" className="mb-2 flex items-center gap-1">
                <LockSimple size={12} />
                {isWeekComplete(week, new Date(), gameFinals) ? 'Week finished' : 'Week under way'} — edits are overrides
              </Badge>
            )}
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr]">
            <div className="space-y-2">
              <Label>Members</Label>
              {isLoading && members.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading members…</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => {
                    const isSelected = member.userId === selectedUserId;
                    const hasLineup = !!member.lineup;
                    return (
                      <button
                        key={member.userId}
                        type="button"
                        onClick={() => setSelectedUserId(member.userId)}
                        className={`w-full rounded-md border p-3 text-left transition-colors ${
                          isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{member.displayName}</span>
                          {member.role === 'owner' && (
                            <Badge variant="secondary" className="text-xs">
                              Owner
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          {hasLineup ? (
                            <span>Week {week} set</span>
                          ) : (
                            <span className="flex items-center gap-1 text-destructive">
                              <Warning size={12} />
                              No lineup
                            </span>
                          )}
                          <span>•</span>
                          <span>{member.weeksSet} {member.weeksSet === 1 ? 'week' : 'weeks'} played</span>
                        </div>
                      </button>
                    );
                  })}
                  {members.length === 0 && !isLoading && (
                    <p className="text-sm text-muted-foreground">This league has no members yet.</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {!selectedMember ? (
                <div className="flex h-full min-h-[12rem] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                  Select a member to edit their Week {week} lineup
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{selectedMember.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {WEEK_LABELS[week] ?? `Week ${week}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedUserId(null)}
                      className="flex items-center gap-1"
                    >
                      <X size={14} />
                      Close
                    </Button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {draftLineup.map((slot) => {
                      const eligible = players.filter(
                        (player) =>
                          player.position === slot.position &&
                          (!draftPlayerIds.has(player.id) || player.id === slot.player?.id),
                      );

                      return (
                        <div key={slot.slotIndex} className="rounded-md border p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <Badge variant="outline">{slot.position}</Badge>
                            {slot.player && (
                              <button
                                type="button"
                                onClick={() => setSlotPlayer(slot.slotIndex, undefined)}
                                className="text-xs text-muted-foreground hover:text-destructive"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          <Popover
                            open={openSlotIndex === slot.slotIndex}
                            onOpenChange={(open) => setOpenSlotIndex(open ? slot.slotIndex : null)}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal">
                                {slot.player ? (
                                  <span className="truncate">
                                    {slot.player.name}{' '}
                                    <span className="text-muted-foreground">· {slot.player.team}</span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Select a {slot.position}…</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[20rem] p-0" align="start">
                              <Command>
                                <CommandInput placeholder={`Search ${slot.position}s…`} />
                                <CommandList>
                                  <CommandEmpty>No players found.</CommandEmpty>
                                  <CommandGroup>
                                    {eligible.slice(0, 300).map((player) => {
                                      const used = usageOutsideThisWeek(player.id);
                                      const atLimit = used >= MAX_PLAYER_USES;
                                      return (
                                        <CommandItem
                                          key={player.id}
                                          value={`${player.name} ${player.team}`}
                                          disabled={atLimit}
                                          onSelect={() => setSlotPlayer(slot.slotIndex, player)}
                                        >
                                          <div className="flex w-full items-center justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="truncate">{player.name}</div>
                                              <div className="truncate text-xs text-muted-foreground">
                                                {player.team}
                                              </div>
                                            </div>
                                            <Badge
                                              variant={atLimit ? 'destructive' : 'secondary'}
                                              className="flex-shrink-0 text-xs"
                                            >
                                              {used}/{MAX_PLAYER_USES}
                                            </Badge>
                                          </div>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="admin-reason">Reason (optional)</Label>
                    <Input
                      id="admin-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="e.g. Member asked me to swap an injured QB"
                      maxLength={500}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {isComplete
                        ? 'Lineup is complete'
                        : `${filledSlotCount} of ${draftLineup.length} slots filled - partial lineups can be saved`}
                    </p>
                    <Button
                      onClick={() => void handleSave()}
                      disabled={isSaving || isLoading || !players.length || !!playersError}
                      className="flex items-center gap-2"
                    >
                      <FloppyDisk size={16} />
                      {isSaving ? 'Saving…' : 'Save lineup'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockCounterClockwise size={20} />
            Change history
          </CardTitle>
          <CardDescription>Admin edits made to member lineups this season.</CardDescription>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin changes recorded yet.</p>
          ) : (
            <ScrollArea className="h-72 pr-4">
              <ul className="space-y-3">
                {auditLog.map((entry) => (
                  <li key={entry.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{entry.subjectName}</span>
                      <Badge variant="outline" className="text-xs">
                        {WEEK_LABELS[entry.week] ?? `Week ${entry.week}`}
                      </Badge>
                      {entry.wasLocked === 1 && (
                        <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                          <LockSimple size={10} />
                          Locked week
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        by {entry.actorName} · {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {describeChange(entry, playersById).map((change, index) => (
                        <li key={index}>{change}</li>
                      ))}
                    </ul>

                    {entry.reason && <p className="mt-2 text-xs italic">“{entry.reason}”</p>}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
