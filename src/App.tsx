import { useCallback, useEffect, useMemo, useState } from 'react';
import { Player, LineupSlot, WeeklyLineup, PlayerUsage, MAX_PLAYER_USES, TOTAL_WEEKS } from '@/lib/types';
import { getPlayers, clearCache } from '@/lib/data';
import { SEASON_YEAR, WEEK_START_DATES } from '@/lib/season-config';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useAuth } from '@/hooks/use-auth';
import { useWeekActuals } from '@/hooks/use-week-actuals';
import { useWeekMatchups } from '@/hooks/use-week-matchups';
import { describeWeekPoints, sumActualPoints } from '@/lib/week-actuals';
import {
  hydrateSlots,
  mergePlayerPool,
  toSlotPayload,
  type ApiLineupSlot,
} from '@/lib/lineup-state';
import {
  createEmptyLineup,
  isLineupComplete,
  removePlayerFromLineup,
  addPlayerToLineup,
  isPlayerInLineup,
  calculateProjectedPoints,
  isWeekLocked,
  getCurrentWeek,
  resolvePendingSlots,
} from '@/lib/utils-fantasy';
import { PlayerTable } from '@/components/PlayerTable';
import { LineupSlotCard } from '@/components/LineupSlotCard';
import { LineupSummary } from '@/components/LineupSummary';
import { WeekNavigation } from '@/components/WeekNavigation';
import { LiveScoringDashboard } from '@/components/LiveScoringDashboard';
import { LeagueDashboard } from '@/components/LeagueDashboard';
import { ScheduleOverview } from '@/components/ScheduleOverview';
import { ByeWeekAlert } from '@/components/ByeWeekAlert';
import { LoginScreen } from '@/components/LoginScreen';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/sonner';
import {
  Trophy,
  Users,
  Target,
  Activity,
  Medal,
  ArrowClockwise as RefreshCw,
  Calendar,
  SignOut,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

type ApiLeagueSummary = {
  id: string;
  name: string;
};

type ApiLineup = {
  id: string;
  week: number;
  season: number;
  slots: ApiLineupSlot[];
  projectedPoints: string | null;
  actualPoints: string | null;
  lockedAt: string | null;
};

type ApiMeResponse = {
  user: {
    hasPasskey?: boolean;
  } | null;
};

function App() {
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeek());
  const [currentLineup, setCurrentLineup] = useState<LineupSlot[]>(createEmptyLineup());
  const [selectedPosition, setSelectedPosition] = useState<'QB' | 'RB' | 'WR'>('QB');
  const [activeTab, setActiveTab] = useState<'lineup' | 'schedule' | 'scoring' | 'leagues'>('lineup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);
  const [savedLineupRows, setSavedLineupRows] = useState<ApiLineup[]>([]);
  const [currentWeekLineupRow, setCurrentWeekLineupRow] = useState<ApiLineup | null>(null);
  const [playerUsage, setPlayerUsage] = useState<PlayerUsage[]>([]);
  const [leagues, setLeagues] = useState<ApiLeagueSummary[]>([]);
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);

  const { user: currentUser, isLoading, registerPasskey, signOut } = useAuth();
  const isAuthenticated = !!currentUser;
  const [hasPasswordResetLink, setHasPasswordResetLink] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.location.pathname.replace(/\/+$/, '').endsWith('/reset-password') &&
      new URL(window.location.href).searchParams.has('token'),
  );
  const [currentLeagueId, setCurrentLeagueId] = useLocalStorage<string | null>(
    `current-league-${currentUser?.id || 'unknown'}`,
    null,
  );

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  // Past weeks show what a lineup really scored instead of its projection.
  const { actuals: weekActuals, hasStarted: weekHasStarted, isLoading: isLoadingActuals } =
    useWeekActuals(currentWeek);
  const { matchups: weekMatchups } = useWeekMatchups(currentWeek);
  const showWeekActuals = weekHasStarted && !isLoadingActuals;
  const weekName = `Week ${currentWeek}`;

  const lineupSlotPoints = useCallback(
    (slot: LineupSlot) =>
      slot.player
        ? describeWeekPoints(slot.player, {
            showActuals: showWeekActuals,
            stats: weekActuals.get(slot.player.id),
            game: weekMatchups.get(slot.player.team.toLowerCase())?.game,
            weekName,
          })
        : undefined,
    [showWeekActuals, weekActuals, weekMatchups, weekName],
  );

  // The reset screen clears the token from the URL once the password is updated.
  useEffect(() => {
    if (!currentUser || typeof window === 'undefined') return;
    if (!window.location.pathname.replace(/\/+$/, '').endsWith('/reset-password')) {
      setHasPasswordResetLink(false);
    }
  }, [currentUser]);

  const weeklyLineups = useMemo<WeeklyLineup[]>(
    () =>
      savedLineupRows
        .map((row) => ({
          week: row.week,
          lineup: hydrateSlots(row.slots, playersById),
          totalPoints: Number.parseFloat(row.projectedPoints ?? '0') || 0,
          actualPoints: row.actualPoints ? Number.parseFloat(row.actualPoints) : undefined,
          isLocked: !!row.lockedAt || isWeekLocked(row.week),
        }))
        .sort((a, b) => a.week - b.week),
    [savedLineupRows, playersById],
  );

  const fetchLeagues = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingLeagues(true);
    try {
      const response = await fetch('/api/leagues', { method: 'GET', credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load leagues');
      }
      const fetchedLeagues = (payload.leagues ?? []) as ApiLeagueSummary[];
      setLeagues(fetchedLeagues);

      if (fetchedLeagues.length === 0) {
        setCurrentLeagueId(null);
        return;
      }

      const currentStillValid = currentLeagueId && fetchedLeagues.some((league) => league.id === currentLeagueId);
      if (!currentStillValid) {
        setCurrentLeagueId(fetchedLeagues[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load leagues';
      toast.error(message);
    } finally {
      setIsLoadingLeagues(false);
    }
  }, [isAuthenticated, currentLeagueId, setCurrentLeagueId]);

  const fetchAllLineups = useCallback(async () => {
    if (!isAuthenticated || !currentLeagueId) {
      setSavedLineupRows([]);
      setPlayerUsage([]);
      return;
    }

    try {
      const response = await fetch(`/api/leagues/${currentLeagueId}/lineups`, {
        method: 'GET',
        credentials: 'include',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load lineups');
      }
      setSavedLineupRows((payload.lineups ?? []) as ApiLineup[]);
      setPlayerUsage((payload.playerUsage ?? []) as PlayerUsage[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load lineups';
      toast.error(message);
    }
  }, [isAuthenticated, currentLeagueId]);

  const fetchCurrentWeekLineup = useCallback(async () => {
    if (!isAuthenticated || !currentLeagueId) {
      setCurrentWeekLineupRow(null);
      setCurrentLineup(createEmptyLineup());
      return;
    }

    try {
      const response = await fetch(`/api/leagues/${currentLeagueId}/lineups?week=${currentWeek}`, {
        method: 'GET',
        credentials: 'include',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load week lineup');
      }

      const lineup = (payload.lineup ?? null) as ApiLineup | null;
      setCurrentWeekLineupRow(lineup);
      setPlayerUsage((payload.playerUsage ?? []) as PlayerUsage[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load week lineup';
      toast.error(message);
      setCurrentWeekLineupRow(null);
      setCurrentLineup(createEmptyLineup());
    }
  }, [isAuthenticated, currentLeagueId, currentWeek]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadPlayers = async () => {
      setIsLoadingPlayers(true);
      try {
        const currentPlayers = await getPlayers();
        setPlayers(currentPlayers);
      } catch (error) {
        console.error('Failed to load players:', error);
      } finally {
        setIsLoadingPlayers(false);
      }
    };

    loadPlayers();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchLeagues();
  }, [isAuthenticated, fetchLeagues, activeTab]);

  useEffect(() => {
    fetchAllLineups();
  }, [fetchAllLineups]);

  useEffect(() => {
    fetchCurrentWeekLineup();
  }, [fetchCurrentWeekLineup]);

  // Unsaved edits must survive anything that grows the player pool, so the
  // lineup is only rebuilt from the stored row when that row itself changes.
  useEffect(() => {
    setCurrentLineup(
      currentWeekLineupRow
        ? hydrateSlots(currentWeekLineupRow.slots, playersById)
        : createEmptyLineup(),
    );
    // playersById is deliberately excluded; pending slots are filled in below.
  }, [currentWeekLineupRow]);

  // The stored lineup usually arrives before the player list does, so fill in
  // any slot still waiting on its player record as the pool grows.
  useEffect(() => {
    setCurrentLineup((previous) => resolvePendingSlots(previous, playersById));
  }, [playersById]);

  useEffect(() => {
    if (!isAuthenticated) {
      setHasPasskey(false);
      return;
    }

    const loadPasskeyStatus = async () => {
      try {
        const response = await fetch('/api/me', {
          method: 'GET',
          credentials: 'include',
        });
        if (!response.ok) {
          setHasPasskey(false);
          return;
        }
        const payload = (await response.json()) as ApiMeResponse;
        setHasPasskey(!!payload.user?.hasPasskey);
      } catch (error) {
        console.error('[App] Failed to load passkey status', { error });
        setHasPasskey(false);
      }
    };

    loadPasskeyStatus();
  }, [isAuthenticated, currentUser?.id]);

  const handlePlayerSelect = (player: Player): boolean => {
    if (!currentLeagueId) {
      toast.error('Choose a league first');
      return false;
    }
    if (isWeekLocked(currentWeek)) {
      toast.error(`Week ${currentWeek} lineup is locked and cannot be modified`);
      return false;
    }
    if (isPlayerInLineup(player.id, currentLineup)) {
      toast.error(`${player.name} is already in your lineup`);
      return false;
    }

    const availableSlot = currentLineup.find((slot) => slot.position === player.position && !slot.player);
    if (!availableSlot) {
      toast.error(`No available ${player.position} slots`);
      return false;
    }

    const newLineup = addPlayerToLineup(player, availableSlot.slotIndex, currentLineup);
    setCurrentLineup(newLineup);
    toast.success(`Added ${player.name} to lineup`);
    return true;
  };

  const handlePlayerSelectFromSheet = (player: Player) => {
    const wasAdded = handlePlayerSelect(player);
    if (wasAdded) {
      setPlayerSheetOpen(false);
    }
  };

  const handleRemovePlayer = (slotIndex: number) => {
    if (isWeekLocked(currentWeek)) {
      toast.error(`Week ${currentWeek} lineup is locked and cannot be modified`);
      return;
    }

    const slot = currentLineup.find((item) => item.slotIndex === slotIndex);
    if (slot?.player) {
      setCurrentLineup(removePlayerFromLineup(slot.player.id, currentLineup));
      toast.success(`Removed ${slot.player.name} from lineup`);
    }
  };

  const handleDropPlayer = (player: Player, slotIndex: number) => {
    if (isWeekLocked(currentWeek)) {
      toast.error(`Week ${currentWeek} lineup is locked and cannot be modified`);
      return;
    }
    if (isPlayerInLineup(player.id, currentLineup)) {
      toast.error(`${player.name} is already in your lineup`);
      return;
    }

    setCurrentLineup(addPlayerToLineup(player, slotIndex, currentLineup));
    toast.success(`Added ${player.name} to lineup`);
  };

  const handleSaveLineup = async () => {
    if (!currentLeagueId) {
      toast.error('Choose a league first');
      return;
    }
    if (isWeekLocked(currentWeek)) {
      toast.error(`Week ${currentWeek} lineup is locked and cannot be modified`);
      return;
    }
    try {
      const response = await fetch(`/api/leagues/${currentLeagueId}/lineups`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week: currentWeek,
          slots: toSlotPayload(currentLineup),
          projectedPoints: calculateProjectedPoints(currentLineup),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save lineup');
      }

      const saved = (payload.lineup ?? null) as ApiLineup | null;
      if (saved) {
        setCurrentWeekLineupRow(saved);
        setSavedLineupRows((previous) => {
          const next = previous.filter((row) => row.week !== saved.week);
          next.push(saved);
          return next.sort((a, b) => a.week - b.week);
        });
      }
      setPlayerUsage((payload.playerUsage ?? []) as PlayerUsage[]);

      // Half-finished lineups are saved on purpose, so say so rather than
      // letting it look like the whole lineup went in.
      const filled = currentLineup.filter((slot) => slot.player).length;
      toast.success(
        filled === currentLineup.length
          ? `Week ${currentWeek} lineup saved!`
          : `Week ${currentWeek} lineup saved with ${filled} of ${currentLineup.length} slots filled`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save lineup';
      toast.error(message);
    }
  };

  const handleRefreshPlayers = async () => {
    setIsLoadingPlayers(true);
    try {
      clearCache();
      const currentPlayers = await getPlayers();
      setPlayers(currentPlayers);
      toast.success('Player data refreshed!');
    } catch (error) {
      console.error('Failed to refresh players:', error);
      toast.error('Failed to refresh player data');
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  // Filtering the player table fetches a subset of the league's players. Merge
  // it into the pool rather than replacing it, so narrowing a filter can never
  // make an already-selected player unresolvable.
  const handlePlayersUpdate = useCallback((newPlayers: Player[]) => {
    setPlayers((previous) => mergePlayerPool(previous, newPlayers));
  }, []);

  const handleForceSampleData = async () => {
    setIsLoadingPlayers(true);
    try {
      clearCache();
      const currentPlayers = await getPlayers();
      setPlayers(currentPlayers);
      toast.success('Player data reloaded!');
    } catch (error) {
      console.error('Failed to reload data:', error);
      toast.error('Failed to reload player data');
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setPlayerSheetOpen(false);
    setHasPasskey(false);
    setPlayers([]);
    setCurrentLineup(createEmptyLineup());
    setCurrentWeek(1);
    setActiveTab('lineup');
    setSavedLineupRows([]);
    setCurrentWeekLineupRow(null);
    setPlayerUsage([]);
    setLeagues([]);
    clearCache();
    toast.success('Logged out successfully');
  };

  const handleAddPasskey = async () => {
    try {
      await registerPasskey();
      setHasPasskey(true);
      toast.success('Passkey registered');
    } catch (error) {
      console.error('Failed to register passkey', { error });
      toast.error(error instanceof Error ? error.message : 'Failed to register passkey');
    }
  };

  const handlePointsUpdate = (week: number, actualPoints: number) => {
    setSavedLineupRows((previous) =>
      previous.map((lineup) =>
        lineup.week === week
          ? {
              ...lineup,
              actualPoints: actualPoints.toString(),
            }
          : lineup,
      ),
    );
  };

  const currentWeekLineup = weeklyLineups.find((lineup) => lineup.week === currentWeek);

  // Once the week has been played, score the lineup from the live box scores
  // rather than waiting for the stored total to be backfilled.
  const liveActualPoints = useMemo(() => {
    if (!showWeekActuals) return undefined;
    const playerIds = currentLineup.map((slot) => slot.player?.id);
    if (!playerIds.some((playerId) => playerId && weekActuals.has(playerId))) return undefined;
    return sumActualPoints(playerIds, weekActuals);
  }, [showWeekActuals, currentLineup, weekActuals]);

  const displayedActualPoints = liveActualPoints ?? currentWeekLineup?.actualPoints;

  // A lineup can be saved part-finished, so the button says how far along it is.
  const filledSlotCount = currentLineup.filter((slot) => slot.player).length;
  const saveButtonLabel = isWeekLocked(currentWeek)
    ? `Week ${currentWeek} Locked`
    : isLineupComplete(currentLineup)
      ? `Save Week ${currentWeek} Lineup`
      : `Save Week ${currentWeek} Lineup (${filledSlotCount}/${currentLineup.length})`;
  const currentLeagueName = leagues.find((league) => league.id === currentLeagueId)?.name;
  const hasLeagues = leagues.length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw size={20} className="animate-spin" />
          Checking session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated || hasPasswordResetLink) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-3 sm:p-4 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-center space-y-2 flex-1 lg:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center justify-center lg:justify-start gap-2">
              <Trophy size={32} className="text-accent" />
              College Football Pick 'Em
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="text-center sm:text-right">
              <div className="flex items-center justify-center sm:justify-end gap-2 text-sm font-medium">
                {currentUser.avatarUrl && (
                  <img src={currentUser.avatarUrl} alt={currentUser.displayName} className="w-6 h-6 rounded-full" />
                )}
                {currentUser.displayName}
              </div>
              <div className="text-xs text-muted-foreground">{currentUser.email || ''}</div>
            </div>
            {!hasPasskey && (
              <Button variant="outline" size="sm" onClick={handleAddPasskey} className="flex items-center justify-center gap-2 w-full sm:w-auto">
                Add Passkey
              </Button>
            )}
            <div className="hidden md:flex">
              <Button variant="outline" size="sm" onClick={() => void handleLogout()} className="flex items-center justify-center gap-2 w-full sm:w-auto">
                <SignOut size={14} />
                Logout
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <WeekNavigation currentWeek={currentWeek} onWeekChange={setCurrentWeek} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {(() => {
              const seasonStart = WEEK_START_DATES[1];
              const now = new Date();
              if (now < seasonStart) {
                const daysUntil = Math.ceil((seasonStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <Trophy size={16} />
                    {SEASON_YEAR} season starts in {daysUntil} days — set your Week 1 lineup now!
                  </div>
                );
              }
              if (isWeekLocked(currentWeek)) {
                return (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-2">
                    <Trophy size={16} />
                    Week {currentWeek} lineup is locked - no changes allowed
                  </div>
                );
              }
              return (
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-2">
                  <Trophy size={16} />
                  Week {currentWeek} lineup can be edited until the week starts - save a partial lineup and finish it later
                </div>
              );
            })()}
            <div className="text-xs text-muted-foreground text-center sm:text-right">
              Current Date:{' '}
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'lineup' | 'schedule' | 'scoring' | 'leagues')}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="lineup" className="flex items-center gap-1 sm:gap-2">
              <Users size={16} />
              <span className="hidden sm:inline">Set Lineup</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-1 sm:gap-2">
              <Calendar size={16} />
              <span className="hidden sm:inline">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="scoring" className="flex items-center gap-1 sm:gap-2">
              <Activity size={16} />
              <span className="hidden sm:inline">Live Scoring</span>
            </TabsTrigger>
            <TabsTrigger value="leagues" className="flex items-center gap-1 sm:gap-2">
              <Medal size={16} />
              <span className="hidden sm:inline">Leagues</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lineup" className="mt-6">
            {!hasLeagues ? (
              <Card>
                <CardHeader>
                  <CardTitle>No league selected</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">Create or join a league before setting your weekly lineup.</p>
                  <Button onClick={() => setActiveTab('leagues')}>Go to Leagues</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-muted-foreground">Current league</span>
                      <Select value={currentLeagueId ?? ''} onValueChange={(value) => setCurrentLeagueId(value)}>
                        <SelectTrigger className="w-full sm:w-[260px]">
                          <SelectValue placeholder="Select league" />
                        </SelectTrigger>
                        <SelectContent>
                          {leagues.map((league) => (
                            <SelectItem key={league.id} value={league.id}>
                              {league.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isLoadingLeagues && <span className="text-xs text-muted-foreground">Refreshing leagues...</span>}
                      {currentLeagueName && <Badge variant="outline">{currentLeagueName}</Badge>}
                    </div>
                  </CardContent>
                </Card>

                <div className="md:hidden space-y-4">
                  <ByeWeekAlert lineup={currentLineup} currentWeek={currentWeek} />

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target size={20} />
                        Your Lineup
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {currentLineup.map((slot) => (
                        <LineupSlotCard
                          key={slot.slotIndex}
                          slot={slot}
                          onRemovePlayer={handleRemovePlayer}
                          onDropPlayer={handleDropPlayer}
                          canDrop={!slot.player}
                          isLocked={isWeekLocked(currentWeek)}
                          weekPoints={lineupSlotPoints(slot)}
                        />
                      ))}

                      <Button onClick={() => void handleSaveLineup()} className="w-full" disabled={isWeekLocked(currentWeek)}>
                        {saveButtonLabel}
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold">Available Players</h3>
                      {isWeekLocked(currentWeek) && (
                        <p className="text-sm text-orange-600 mt-1">Week {currentWeek} is locked - viewing only</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshPlayers}
                        disabled={isLoadingPlayers}
                        className="flex items-center justify-center gap-2 w-full"
                      >
                        <RefreshCw size={14} className={isLoadingPlayers ? 'animate-spin' : ''} />
                        Refresh
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleForceSampleData}
                        disabled={isLoadingPlayers}
                        className="flex items-center justify-center gap-2 w-full"
                      >
                        Reload Data
                      </Button>
                      <Button onClick={() => setPlayerSheetOpen(true)} className="w-full">
                        Browse Available Players
                      </Button>
                    </div>
                  </div>

                  <Sheet open={playerSheetOpen} onOpenChange={setPlayerSheetOpen}>
                    <SheetContent side="bottom" className="h-[85vh]">
                      <SheetHeader>
                        <SheetTitle>Available Players</SheetTitle>
                      </SheetHeader>
                      <div className="flex-1 overflow-y-auto px-4 pb-16">
                        {isLoadingPlayers ? (
                          <Card>
                            <CardContent className="flex items-center justify-center py-12">
                              <div className="flex items-center gap-3 text-muted-foreground">
                                <RefreshCw size={20} className="animate-spin" />
                                Loading {SEASON_YEAR} season players from ESPN...
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <Tabs value={selectedPosition} onValueChange={(value) => setSelectedPosition(value as 'QB' | 'RB' | 'WR')}>
                            <TabsList className="grid w-full grid-cols-3">
                              <TabsTrigger value="QB">Quarterbacks</TabsTrigger>
                              <TabsTrigger value="RB">Running Backs</TabsTrigger>
                              <TabsTrigger value="WR">Wide Receivers</TabsTrigger>
                            </TabsList>

                            <TabsContent value={selectedPosition} className="mt-4">
                              <PlayerTable
                                position={selectedPosition}
                                players={players}
                                playerUsage={playerUsage}
                                currentLineup={currentLineup}
                                currentWeek={currentWeek}
                                onPlayerSelect={handlePlayerSelectFromSheet}
                                onPlayersUpdate={handlePlayersUpdate}
                                isLocked={isWeekLocked(currentWeek)}
                              />
                            </TabsContent>
                          </Tabs>
                        )}
                      </div>
                    </SheetContent>
                  </Sheet>

                  <LineupSummary lineup={currentLineup} actualPoints={displayedActualPoints} />

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Season Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Weeks Completed</span>
                        <Badge variant="outline">
                          {weeklyLineups.length}/{TOTAL_WEEKS}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Players at Max Uses</span>
                        <Badge variant="outline">{playerUsage.filter((entry) => entry.timesUsed >= MAX_PLAYER_USES).length}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="hidden md:grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Available Players</h3>
                        {isWeekLocked(currentWeek) && (
                          <p className="text-sm text-orange-600 mt-1">Week {currentWeek} is locked - viewing only</p>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRefreshPlayers}
                          disabled={isLoadingPlayers}
                          className="flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                          <RefreshCw size={14} className={isLoadingPlayers ? 'animate-spin' : ''} />
                          Refresh
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleForceSampleData}
                          disabled={isLoadingPlayers}
                          className="flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                          Reload Data
                        </Button>
                      </div>
                    </div>

                    {isLoadingPlayers ? (
                      <Card>
                        <CardContent className="flex items-center justify-center py-12">
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <RefreshCw size={20} className="animate-spin" />
                            Loading {SEASON_YEAR} season players from ESPN...
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Tabs value={selectedPosition} onValueChange={(value) => setSelectedPosition(value as 'QB' | 'RB' | 'WR')}>
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="QB">Quarterbacks</TabsTrigger>
                          <TabsTrigger value="RB">Running Backs</TabsTrigger>
                          <TabsTrigger value="WR">Wide Receivers</TabsTrigger>
                        </TabsList>

                        <TabsContent value={selectedPosition} className="mt-4">
                          <PlayerTable
                            position={selectedPosition}
                            players={players}
                            playerUsage={playerUsage}
                            currentLineup={currentLineup}
                            currentWeek={currentWeek}
                            onPlayerSelect={handlePlayerSelect}
                            onPlayersUpdate={handlePlayersUpdate}
                            isLocked={isWeekLocked(currentWeek)}
                          />
                        </TabsContent>
                      </Tabs>
                    )}
                  </div>

                  <div className="space-y-4">
                    <ByeWeekAlert lineup={currentLineup} currentWeek={currentWeek} />

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target size={20} />
                          Your Lineup
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {currentLineup.map((slot) => (
                          <LineupSlotCard
                            key={slot.slotIndex}
                            slot={slot}
                            onRemovePlayer={handleRemovePlayer}
                            onDropPlayer={handleDropPlayer}
                            canDrop={!slot.player}
                            isLocked={isWeekLocked(currentWeek)}
                            weekPoints={lineupSlotPoints(slot)}
                          />
                        ))}

                        <Button onClick={() => void handleSaveLineup()} className="w-full" disabled={isWeekLocked(currentWeek)}>
                          {saveButtonLabel}
                        </Button>
                      </CardContent>
                    </Card>

                    <LineupSummary lineup={currentLineup} actualPoints={displayedActualPoints} />

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Season Stats</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Weeks Completed</span>
                          <Badge variant="outline">
                            {weeklyLineups.length}/{TOTAL_WEEKS}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Players at Max Uses</span>
                          <Badge variant="outline">{playerUsage.filter((entry) => entry.timesUsed >= MAX_PLAYER_USES).length}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <ScheduleOverview currentWeek={currentWeek} />
          </TabsContent>

          <TabsContent value="scoring" className="mt-6">
            <LiveScoringDashboard week={currentWeek} weeklyLineups={weeklyLineups} onPointsUpdate={handlePointsUpdate} />
          </TabsContent>

          <TabsContent value="leagues" className="mt-6">
            <LeagueDashboard
              currentWeek={currentWeek}
              weeklyLineups={weeklyLineups}
              currentUserId={currentUser?.id || ''}
              currentUsername={currentUser?.displayName || ''}
            />
          </TabsContent>
        </Tabs>

        <footer className="flex md:hidden items-center justify-between gap-3 border-t pt-4 text-sm">
          <div className="min-w-0">
            <div className="font-medium truncate">{currentUser.displayName}</div>
            <div className="text-xs text-muted-foreground">{SEASON_YEAR} Season</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleLogout()} className="flex items-center gap-2">
            <SignOut size={14} />
            Logout
          </Button>
        </footer>
      </div>
      <Toaster />
    </div>
  );
}

export default App;
