import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, LineupSlot, WeeklyLineup, PlayerUsage, MAX_PLAYER_USES, TOTAL_WEEKS } from '@/lib/types';
import { playersResource, clearCache } from '@/lib/data';
import { usePlayers } from '@/hooks/use-players';
import { getLiveResource } from '@/lib/live-data';
import { seasonStatsResource } from '@/lib/season-stats-data';
import { SEASON_YEAR, weekBoundary } from '@/lib/season-config';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useAuth } from '@/hooks/use-auth';
import { useWeekActuals } from '@/hooks/use-week-actuals';
import { useWeekLocks } from '@/hooks/use-week-locks';
import { isWeekComplete } from '@/lib/week-lock';
import { useWeekMatchups } from '@/hooks/use-week-matchups';
import { describeWeekPoints, sumActualPoints, type WeekDataStatus } from '@/lib/week-actuals';
import {
  hydrateSlots,
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
  getCurrentWeek,
  groupLineupByPosition,
  resolvePendingSlots,
} from '@/lib/utils-fantasy';
import { PlayerTable } from '@/components/PlayerTable';
import { LineupPositionGroup } from '@/components/LineupPositionGroup';
import { LineupSummary } from '@/components/LineupSummary';
import { WeekNavigation } from '@/components/WeekNavigation';
import { createLeagueViewCache, type ApiLeague } from '@/lib/league-view-data';
import { optionalFeature } from '@/components/optional-feature';
import { schedulesResource } from '@/lib/schedule-data';
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

type ApiLeagueSummary = ApiLeague;
const EMPTY_LEAGUES: ApiLeagueSummary[] = [];

const LiveScoringDashboard = optionalFeature('Live Scoring', () => import('@/components/LiveScoringDashboard').then(module => ({ default: module.LiveScoringDashboard })));
const LeagueDashboard = optionalFeature('Leagues', () => import('@/components/LeagueDashboard').then(module => ({ default: module.LeagueDashboard })));
const ScheduleOverview = optionalFeature('Schedule', () => import('@/components/ScheduleOverview').then(module => ({ default: module.ScheduleOverview })));

type ApiLineup = {
  id: string;
  week: number;
  season: number;
  slots: ApiLineupSlot[];
  projectedPoints: string | null;
  actualPoints: string | null;
  lockedAt: string | null;
};

function App() {
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeek());
  const [currentLineup, setCurrentLineup] = useState<LineupSlot[]>(createEmptyLineup());
  const [selectedPosition, setSelectedPosition] = useState<'QB' | 'RB' | 'WR'>('QB');
  const [activeTab, setActiveTab] = useState<'lineup' | 'schedule' | 'scoring' | 'leagues'>('lineup');
  const [savedLineupRows, setSavedLineupRows] = useState<ApiLineup[]>([]);
  const [playerUsage, setPlayerUsage] = useState<PlayerUsage[]>([]);
  const [leagueList, setLeagueList] = useState<{ userId: string | null; data: ApiLeagueSummary[] }>({ userId: null, data: [] });
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);
  const [lineupSourceLeagueId, setLineupSourceLeagueId] = useState<string | null>(null);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savePending = useRef(false);

  const { user: currentUser, isLoading, sessionError, retrySession, registerPasskey, signOut } = useAuth();
  const sessionUserId = useRef(currentUser?.id);
  sessionUserId.current = currentUser?.id;
  const leagues = leagueList.userId === currentUser?.id ? leagueList.data : EMPTY_LEAGUES;
  const leagueViews = useMemo(() => createLeagueViewCache(currentUser?.id ?? null), [currentUser?.id]);
  useEffect(() => () => leagueViews.clear(), [leagueViews]);
  const isAuthenticated = !!currentUser;
  const { players, isLoading: isLoadingPlayers, error: playersError } = usePlayers(isAuthenticated);
  const hasPasskey = !!currentUser?.hasPasskey;
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
  const activeScope = `${currentUser?.id ?? ''}:${currentLeagueId ?? ''}`;
  const scopeRef = useRef(activeScope);
  scopeRef.current = activeScope;
  const leagueRequest = useRef(0);
  const lineupRequest = useRef(0);
  const draftBaseline = useRef<{ key: string; signature: string } | null>(null);

  // Show recorded points for the selected week.
  const {
    actuals: weekActuals, hasStarted: weekHasStarted, isLoading: actualsLoading,
    hasData: hasActuals, isReliable: actualsReliable, error: actualsError,
    pendingTeams: actualsPendingTeams,
  } = useWeekActuals(isAuthenticated ? currentWeek : undefined);
  const { matchups: weekMatchups } = useWeekMatchups(isAuthenticated ? currentWeek : undefined);
  // Players lock one by one as their games kick off; the week itself stays
  // open until all games finish or the following Wednesday boundary.
  const weekLocks = useWeekLocks(isAuthenticated ? currentWeek : undefined);
  const showWeekActuals = weekHasStarted;
  const weekName = `Week ${currentWeek}`;

  // An accepted snapshot stays usable while it is being re-observed, so a
  // finished week keeps showing its recorded scores during a refresh or after
  // one is rejected. Only a week with nothing accepted yet is unavailable, and
  // one still arriving is merely awaited.
  const weekDataStatus: WeekDataStatus = hasActuals && !weekLocks.isLoading
    ? 'ready'
    : actualsLoading || (weekLocks.isLoading && !weekLocks.error) ? 'loading' : 'missing';

  const lineupSlotPoints = useCallback(
    (slot: LineupSlot) =>
      slot.player
        ? describeWeekPoints({
            showActuals: showWeekActuals,
            stats: weekActuals.get(slot.player.id),
            game: weekMatchups.get(slot.player.team.toLowerCase())?.game,
            weekName,
            status: weekDataStatus,
            teamPending: actualsPendingTeams.has(slot.player.team.toLowerCase()),
          })
        : undefined,
    [showWeekActuals, weekActuals, weekMatchups, weekName, weekDataStatus, actualsPendingTeams],
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
          isLocked: !!row.lockedAt || isWeekComplete(row.week, new Date(), weekLocks.gameFinals),
        }))
        .sort((a, b) => a.week - b.week),
    [savedLineupRows, playersById, weekLocks.gameFinals],
  );

  const fetchLeagues = useCallback(async () => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;
    const requestId = ++leagueRequest.current;
    setIsLoadingLeagues(true);
    try {
      const response = await fetch('/api/leagues', { method: 'GET', credentials: 'include', signal: AbortSignal.timeout(20_000) });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load leagues');
      }
      const fetchedLeagues = (payload.leagues ?? []) as ApiLeagueSummary[];
      if (requestId !== leagueRequest.current || userId !== sessionUserId.current) return;
      leagueViews.retain(fetchedLeagues.map(league => league.id));
      setLeagueList({ userId, data: fetchedLeagues });

      if (fetchedLeagues.length === 0) {
        setCurrentLeagueId(null);
        return;
      }

      setCurrentLeagueId(previous =>
        previous && fetchedLeagues.some(league => league.id === previous) ? previous : fetchedLeagues[0].id,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load leagues';
      toast.error(message);
    } finally {
      if (requestId === leagueRequest.current) setIsLoadingLeagues(false);
    }
  }, [currentUser?.id, leagueViews, setCurrentLeagueId]);

  const fetchAllLineups = useCallback(async () => {
    const requestId = ++lineupRequest.current;
    const requestedScope = scopeRef.current;
    if (!isAuthenticated || !currentLeagueId) {
      setSavedLineupRows([]);
      setPlayerUsage([]);
      setLineupSourceLeagueId(null);
      return;
    }

    try {
      const response = await fetch(`/api/leagues/${currentLeagueId}/lineups`, {
        method: 'GET',
        credentials: 'include',
        signal: AbortSignal.timeout(20_000),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load lineups');
      }
      if (requestId !== lineupRequest.current || requestedScope !== scopeRef.current) return;
      setSavedLineupRows((payload.lineups ?? []) as ApiLineup[]);
      setPlayerUsage((payload.playerUsage ?? []) as PlayerUsage[]);
      setLineupSourceLeagueId(currentLeagueId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load lineups';
      toast.error(message);
    }
  }, [isAuthenticated, currentLeagueId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchLeagues();
  }, [isAuthenticated, fetchLeagues]);

  useEffect(() => {
    fetchAllLineups();
  }, [fetchAllLineups]);

  const selectedSavedRow = lineupSourceLeagueId === currentLeagueId
    ? savedLineupRows.find(row => row.week === currentWeek) ?? null
    : null;
  const savedSlots = selectedSavedRow?.slots ?? toSlotPayload(createEmptyLineup());
  const slotSignature = JSON.stringify(savedSlots);
  const draftKey = `${activeScope}:${currentWeek}`;
  useEffect(() => {
    const previous = draftBaseline.current;
    draftBaseline.current = { key: draftKey, signature: slotSignature };
    setCurrentLineup(current => {
      if (previous?.key === draftKey && JSON.stringify(toSlotPayload(current)) !== previous.signature) return current;
      return hydrateSlots(savedSlots, playersById);
    });
    // Only slot content/context can replace a clean draft, not score updates.
  }, [draftKey, slotSignature]);

  // The stored lineup usually arrives before the player list does, so fill in
  // any slot still waiting on its player record as the pool grows.
  useEffect(() => {
    setCurrentLineup((previous) => resolvePendingSlots(previous, playersById));
  }, [playersById]);

  const handlePlayerSelect = (player: Player): boolean => {
    if (weekLocks.isLoading || lineupSourceLeagueId !== currentLeagueId) {
      toast.error('Wait for your lineup and schedule to load before editing');
      return false;
    }
    if (!currentLeagueId) {
      toast.error('Choose a league first');
      return false;
    }
    if (weekLocks.isComplete) {
      toast.error(`Week ${currentWeek} is over and cannot be modified`);
      return false;
    }
    if (weekLocks.isPlayerLocked(player.team)) {
      toast.error(`${player.name}'s game has already started`);
      return false;
    }
    if (isPlayerInLineup(player.id, currentLineup)) {
      toast.error(`${player.name} is already in your lineup`);
      return false;
    }

    const availableSlot = currentLineup.find((slot) => slot.position === player.position && !slot.player && !slot.playerId);
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
    if (weekLocks.isLoading || lineupSourceLeagueId !== currentLeagueId) {
      toast.error('Wait for your lineup and schedule to load before editing');
      return;
    }
    if (weekLocks.isComplete) {
      toast.error(`Week ${currentWeek} is over and cannot be modified`);
      return;
    }

    const slot = currentLineup.find((item) => item.slotIndex === slotIndex);
    if (slot?.player && weekLocks.isPlayerLocked(slot.player.team)) {
      toast.error(`${slot.player.name}'s game has already started`);
      return;
    }
    if (slot?.player) {
      setCurrentLineup(removePlayerFromLineup(slot.player.id, currentLineup));
      toast.success(`Removed ${slot.player.name} from lineup`);
    }
  };

  const handleSaveLineup = async () => {
    if (savePending.current) {
      toast.error('A save is already in progress');
      return;
    }
    if (!players.length || weekLocks.isLoading || lineupSourceLeagueId !== currentLeagueId) {
      toast.error('Your lineup, player catalogue and schedule must be loaded before saving');
      return;
    }
    if (!currentLeagueId) {
      toast.error('Choose a league first');
      return;
    }
    if (weekLocks.isComplete) {
      toast.error(`Week ${currentWeek} is over and cannot be modified`);
      return;
    }
    savePending.current = true;
    setIsSaving(true);
    try {
      const requestedScope = scopeRef.current;
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
      if (requestedScope !== scopeRef.current) return;
      leagueViews.invalidateStandings(currentLeagueId);

      const saved = (payload.lineup ?? null) as ApiLineup | null;
      if (saved) {
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
    } finally {
      savePending.current = false;
      setIsSaving(false);
    }
  };

  const handleRefreshPlayers = async () => {
    try {
      clearCache();
      await Promise.all([playersResource.read(), seasonStatsResource.read(true)]);
      toast.success('Player data refreshed!');
    } catch (error) {
      console.error('Failed to refresh players:', error);
      toast.error('Failed to refresh player data');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign out');
      return;
    }
    setPlayerSheetOpen(false);
    leagueRequest.current++;
    lineupRequest.current++;
    leagueViews.clear();
    setCurrentLineup(createEmptyLineup());
    setCurrentWeek(1);
    setActiveTab('lineup');
    setSavedLineupRows([]);
    setPlayerUsage([]);
    setLeagueList({ userId: null, data: [] });
    toast.success('Logged out successfully');
  };

  const handleAddPasskey = async () => {
    try {
      await registerPasskey();
      toast.success('Passkey registered');
    } catch (error) {
      console.error('Failed to register passkey', { error });
      toast.error(error instanceof Error ? error.message : 'Failed to register passkey');
    }
  };

  // Stable identity, and a no-op when the total has not moved. The live
  // dashboard reports its running total from an effect, so an unstable
  // callback or an always-new array here would re-render it forever.
  const handlePointsUpdate = useCallback((week: number, actualPoints: number) => {
    const next = actualPoints.toString();
    setSavedLineupRows((previous) => {
      let changed = false;
      const updated = previous.map((lineup) => {
        if (lineup.week !== week || lineup.actualPoints === next) return lineup;
        changed = true;
        return { ...lineup, actualPoints: next };
      });
      return changed ? updated : previous;
    });
  }, []);

  const currentWeekLineup = weeklyLineups.find((lineup) => lineup.week === currentWeek);

  // Once the week has been played, score the lineup from the live box scores
  // rather than waiting for the stored total to be backfilled.
  const liveActualPoints = useMemo(() => {
    if (!showWeekActuals || !hasActuals) return undefined;
    const playerIds = currentLineup.map((slot) => slot.player?.id);
    return sumActualPoints(playerIds, weekActuals);
  }, [showWeekActuals, hasActuals, currentLineup, weekActuals]);

  const displayedActualPoints = liveActualPoints ?? currentWeekLineup?.actualPoints;

  // A lineup can be saved part-finished, so the button says how far along it is.
  const filledSlotCount = currentLineup.filter((slot) => slot.player || slot.playerId).length;
  const lockedSlotCount = currentLineup.filter((slot) => slot.player && !weekLocks.isLoading && weekLocks.isPlayerLocked(slot.player.team)).length;
  const finishedSlotCount = currentLineup.filter(
    (slot) => slot.player?.team && weekLocks.finishedTeams.has(slot.player.team.toLowerCase()),
  ).length;

  // Said the same way everywhere, and honest about whether those games are
  // still being played or already over.
  const lineupGroups = useMemo(() => groupLineupByPosition(currentLineup), [currentLineup]);
  const isSlotLocked = useCallback(
    (slot: LineupSlot) => weekLocks.isComplete || weekLocks.isPlayerLocked(slot.player?.team),
    [weekLocks],
  );

  const lockedSlotSummary = (() => {
    const subject = `${lockedSlotCount} of your ${lockedSlotCount === 1 ? 'players has' : 'players have'}`;
    if (finishedSlotCount === lockedSlotCount) return `${subject} finished`;
    if (finishedSlotCount === 0) return `${subject} kicked off`;
    return `${subject} started (${finishedSlotCount} finished)`;
  })();
  const saveButtonLabel = weekLocks.isComplete
    ? `Week ${currentWeek} Closed`
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

  if (sessionError && !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center p-4">
      <Card><CardContent className="p-6 space-y-3">
        <p role="alert">{sessionError}</p>
        <Button onClick={() => void retrySession()}>Retry session</Button>
      </CardContent></Card>
    </div>;
  }

  if (!isAuthenticated || hasPasswordResetLink) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-3 sm:p-4 space-y-6">
        {sessionError && <div role="alert" className="rounded-lg border p-3 text-sm">
          Session details could not be refreshed. Your draft is unchanged.
          <Button variant="outline" size="sm" className="ml-2" onClick={() => void retrySession()}>Retry session</Button>
        </div>}
        {weekLocks.error && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
          Schedule refresh failed. {weekLocks.isLoading ? 'Editing is unavailable until schedules load.' : 'Known kickoff locks are still enforced.'}
          <Button variant="outline" size="sm" className="ml-2" onClick={() => void schedulesResource.refresh(true)}>Retry schedules</Button>
        </div>}
        {playersError && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm">
          {players.length ? 'Showing the last available player catalogue. ' : 'Player data is unavailable. '}
          <Button variant="outline" size="sm" onClick={handleRefreshPlayers}>Retry players</Button>
        </div>}
        {weekHasStarted && !actualsReliable && <div role="status" className="rounded-lg border p-3 text-sm">
          {hasActuals
            ? actualsError ? 'Showing the last available actual scores; refresh failed or is incomplete.' : 'The source is updating. Showing the last available actual scores.'
            : 'Actual scores are not available yet. Missing scores are not counted as zero.'}
          <Button variant="outline" size="sm" className="ml-2" onClick={() => void getLiveResource(currentWeek).refresh(true)}>Retry scores</Button>
        </div>}
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
          <WeekNavigation currentWeek={currentWeek} onWeekChange={setCurrentWeek} gameFinals={weekLocks.gameFinals} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {(() => {
              const seasonStart = weekBoundary(1)!;
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
              if (weekLocks.isComplete) {
                return (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-2">
                    <Trophy size={16} />
                    Week {currentWeek} is over - no changes allowed
                  </div>
                );
              }
              if (lockedSlotCount > 0) {
                return (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <Trophy size={16} />
                    Week {currentWeek} is under way - {lockedSlotSummary} and {lockedSlotCount === 1 ? 'is' : 'are'} locked in
                  </div>
                );
              }
              return (
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-2">
                  <Trophy size={16} />
                  Week {currentWeek} lineup is open - each player locks when their own game kicks off
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
            <TabsTrigger value="lineup" aria-label="Set Lineup" className="flex items-center gap-1 sm:gap-2">
              <Users size={16} />
              <span className="hidden sm:inline">Set Lineup</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" aria-label="Schedule" className="flex items-center gap-1 sm:gap-2">
              <Calendar size={16} />
              <span className="hidden sm:inline">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="scoring" aria-label="Live Scoring" className="flex items-center gap-1 sm:gap-2">
              <Activity size={16} />
              <span className="hidden sm:inline">Live Scoring</span>
            </TabsTrigger>
            <TabsTrigger value="leagues" aria-label="Leagues" className="flex items-center gap-1 sm:gap-2">
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
                      {lineupGroups.map((group) => (
                        <LineupPositionGroup
                          key={group.position}
                          position={group.position}
                          slots={group.slots}
                          onRemovePlayer={handleRemovePlayer}
                          isSlotLocked={isSlotLocked}
                          weekPointsFor={lineupSlotPoints}
                        />
                      ))}

                      <Button onClick={() => void handleSaveLineup()} className="w-full" disabled={isSaving || !players.length || weekLocks.isComplete || weekLocks.isLoading || lineupSourceLeagueId !== currentLeagueId}>
                        {saveButtonLabel}
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold">Available Players</h3>
                      {weekLocks.isComplete ? (
                        <p className="text-sm text-orange-600 mt-1">Week {currentWeek} is over - viewing only</p>
                      ) : lockedSlotCount > 0 ? (
                        <p className="text-sm text-orange-600 mt-1">
                          {lockedSlotSummary} and can no longer be changed
                        </p>
                      ) : null}
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
                        onClick={handleRefreshPlayers}
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
                                Loading {SEASON_YEAR} season players...
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
                                isLocked={weekLocks.isComplete || weekLocks.isLoading || lineupSourceLeagueId !== currentLeagueId}
                                lockedTeams={weekLocks.lockedTeams}
                                finishedTeams={weekLocks.finishedTeams}
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
                        {weekLocks.isComplete ? (
                          <p className="text-sm text-orange-600 mt-1">Week {currentWeek} is over - viewing only</p>
                        ) : lockedSlotCount > 0 ? (
                          <p className="text-sm text-orange-600 mt-1">
                            {lockedSlotSummary} and can no longer be changed
                          </p>
                        ) : null}
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
                          onClick={handleRefreshPlayers}
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
                            Loading {SEASON_YEAR} season players...
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
                            isLocked={weekLocks.isComplete || weekLocks.isLoading || lineupSourceLeagueId !== currentLeagueId}
                            lockedTeams={weekLocks.lockedTeams}
                                finishedTeams={weekLocks.finishedTeams}
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
                        {lineupGroups.map((group) => (
                          <LineupPositionGroup
                            key={group.position}
                            position={group.position}
                            slots={group.slots}
                            onRemovePlayer={handleRemovePlayer}
                            isSlotLocked={isSlotLocked}
                            weekPointsFor={lineupSlotPoints}
                          />
                        ))}

                        <Button onClick={() => void handleSaveLineup()} className="w-full" disabled={isSaving || !players.length || weekLocks.isComplete || weekLocks.isLoading || lineupSourceLeagueId !== currentLeagueId}>
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
            <ScheduleOverview key={currentWeek} currentWeek={currentWeek} />
          </TabsContent>

          <TabsContent value="scoring" className="mt-6">
            <LiveScoringDashboard key={currentWeek} week={currentWeek} players={players} weeklyLineups={weeklyLineups} onPointsUpdate={handlePointsUpdate} />
          </TabsContent>

          <TabsContent value="leagues" className="mt-6">
            <LeagueDashboard
              key={currentUser?.id}
              currentWeek={currentWeek}
              gameFinals={weekLocks.gameFinals}
              weeklyLineups={weeklyLineups}
              currentUserId={currentUser?.id || ''}
              currentUsername={currentUser?.displayName || ''}
              leagues={leagues}
              isLoadingLeagues={isLoadingLeagues}
              viewCache={leagueViews}
              onRefreshLeagues={fetchLeagues}
              onLineupsChanged={fetchAllLineups}
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

export default function AppRoot() {
  const { user } = useAuth();
  return <App key={user?.id ?? 'signed-out'} />;
}
