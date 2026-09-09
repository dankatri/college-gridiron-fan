import { useState, useEffect, useMemo, useRef } from 'react';
import { PlayerStats, GameStatus, LiveUpdate, Player, WeeklyLineup } from '@/lib/types';
import { generateLiveStats, generateGameStatuses, createLiveUpdate, calculateFantasyPoints } from '@/lib/stats-utils';
import { SAMPLE_PLAYERS } from '@/lib/data';
import { getLiveResource } from '@/lib/live-data';
import { useResource } from '@/hooks/use-resource';
import { isWeekComplete } from '@/lib/week-lock';
import { LiveStatsCard } from '@/components/LiveStatsCard';
import { GameStatusTracker } from '@/components/GameStatusTracker';
import { LiveUpdatesFeed } from '@/components/LiveUpdatesFeed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Activity, Users, Trophy, Play, Pause } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface LiveScoringDashboardProps {
  week: number;
  weeklyLineups: WeeklyLineup[];
  onPointsUpdate: (week: number, actualPoints: number) => void;
  players: Player[];
}

export function LiveScoringDashboard({ 
  week, 
  weeklyLineups,
  onPointsUpdate,
  players,
}: LiveScoringDashboardProps) {
  const [selectedTab, setSelectedTab] = useState<'lineup' | 'all-players' | 'games' | 'updates'>('lineup');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [positionFilter, setPositionFilter] = useState('all');
  
  const allowSimulation = import.meta.env.DEV;
  const resource = useResource(getLiveResource(week), true, !isWeekComplete(week));
  const [simulationStats, setLiveStats] = useState<PlayerStats[]>(
    () => allowSimulation ? generateLiveStats(SAMPLE_PLAYERS, week) : [],
  );
  const [simulationGames] = useState<GameStatus[]>(
    () => allowSimulation ? generateGameStatuses(week) : [],
  );
  const [liveUpdates, setLiveUpdates] = useState<LiveUpdate[]>([]);
  const hasRealData = resource.data !== undefined && resource.data !== null;
  const liveStats = resource.data?.stats ?? simulationStats;
  const gameStatuses = resource.data?.games ?? simulationGames;
  const lastSync = resource.sourceCheckedAt;
  const statsById = useMemo(() => new Map(liveStats.map(stat => [stat.playerId, stat])), [liveStats]);
  const playersById = useMemo(() => new Map(players.map(player => [player.id, player])), [players]);

  const currentWeekLineup = weeklyLineups.find(w => w.week === week);

  // Memoised because effects depend on it; a fresh array each render would
  // tear down and rebuild the simulation interval before it could ever fire.
  const lineupPlayerIds = useMemo(
    () => currentWeekLineup?.lineup.flatMap(slot => {
      const id = slot.player?.id ?? slot.playerId;
      return id ? [id] : [];
    }) ?? [],
    [currentWeekLineup],
  );

  // Live updates simulation
  useEffect(() => {
    if (!allowSimulation || !isLiveMode || hasRealData) return;

    const interval = setInterval(() => {
      // Randomly update a player's stats
      const randomPlayer = SAMPLE_PLAYERS[Math.floor(Math.random() * SAMPLE_PLAYERS.length)];
      const currentStats = liveStats.find(s => s.playerId === randomPlayer.id);
      
      if (currentStats) {
        const statTypes = ['passingYards', 'rushingYards', 'receivingYards', 'passingTDs', 'rushingTDs', 'receivingTDs'];
        const randomStatType = statTypes[Math.floor(Math.random() * statTypes.length)];
        
        let updateValue = 0;
        let description = '';
        
        if (randomStatType.includes('TD')) {
          updateValue = 1;
          description = `🏈 ${randomPlayer.name} scores a touchdown!`;
        } else if (randomStatType.includes('Yards')) {
          updateValue = Math.floor(Math.random() * 15) + 5;
          description = `${randomPlayer.name} gains ${updateValue} ${randomStatType.replace('passing', 'passing').replace('rushing', 'rushing').replace('receiving', 'receiving')}`;
        }
        
        // Update stats
        const updatedStats = liveStats.map(stat => {
          if (stat.playerId === randomPlayer.id) {
            const newStat = { ...stat };
            (newStat as any)[randomStatType] += updateValue;
            newStat.lastUpdated = new Date();
            // Recalculate fantasy points
            newStat.fantasyPoints = calculateFantasyPoints(newStat);
            return newStat;
          }
          return stat;
        });
        
        setLiveStats(updatedStats);
        
        // Add live update
        const newUpdate = createLiveUpdate(
          randomPlayer.id,
          week,
          randomStatType,
          updateValue,
          randomPlayer.name,
          description
        );
        
        setLiveUpdates(prev => [newUpdate, ...prev.slice(0, 49)]); // Keep last 50 updates
        
        // Show toast for lineup players
        if (lineupPlayerIds.includes(randomPlayer.id)) {
          toast.success(description);
        }
      }
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, [allowSimulation, isLiveMode, hasRealData, liveStats, lineupPlayerIds, week]);

  // Report the lineup's running total upward when it changes.
  //
  // Reporting on every run would spin: the parent stores the total, which
  // re-renders this component, which reports again. Remembering what was last
  // sent breaks that cycle regardless of how stable the callback happens to be.
  const lastReported = useRef<string | null>(null);

  useEffect(() => {
    if (!currentWeekLineup || (!hasRealData && !allowSimulation)) return;

    const total = currentWeekLineup.lineup.reduce((sum, slot) => {
      const playerId = slot.player?.id ?? slot.playerId;
      return sum + (playerId ? statsById.get(playerId)?.fantasyPoints ?? 0 : 0);
    }, 0);

    const rounded = Math.round(total * 10) / 10;
    const signature = `${week}:${rounded}`;
    if (lastReported.current === signature) return;

    lastReported.current = signature;
    onPointsUpdate(week, rounded);
  }, [liveStats, statsById, currentWeekLineup, week, onPointsUpdate, hasRealData, allowSimulation]);

  const handleGenerateNewStats = () => {
    const newStats = generateLiveStats(SAMPLE_PLAYERS, week);
    setLiveStats(newStats);
    toast.success('Generated new stats for all players');
  };

  const handleToggleLiveMode = () => {
    setIsLiveMode(!isLiveMode);
    toast.success(isLiveMode ? 'Live updates paused' : 'Live updates started');
  };

  const getPlayerById = (id: string): Player | undefined => {
    return playersById.get(id);
  };

  const lineupPlayers = currentWeekLineup?.lineup
    .filter(slot => slot.player)
    .map(slot => ({
      player: slot.player!,
      stats: statsById.get(slot.player!.id)
    })) || [];

  const totalActualPoints = lineupPlayerIds.reduce((sum, id) => sum + (statsById.get(id)?.fantasyPoints ?? 0), 0);

  const totalProjectedPoints = lineupPlayers.reduce((sum, { player }) => {
    return sum + player.projectedPoints;
  }, 0);

  // Rendering 3,700 players is unusable; show those with stats this week.
  const statedPlayers = hasRealData
    ? Array.from(statsById.keys())
        .map(id => playersById.get(id))
        .filter((player): player is Player => Boolean(player))
    : allowSimulation ? SAMPLE_PLAYERS : [];
  const matchingPlayers = statedPlayers.filter(player => positionFilter === 'all' || player.position === positionFilter);
  const visiblePlayers = matchingPlayers.slice(0, 100);

  if (!currentWeekLineup) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Activity size={48} className="mx-auto mb-4 opacity-50" />
            <p>No lineup set for Week {week}</p>
            <p className="text-sm">Set your lineup first to track live scoring</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasRealData && !allowSimulation) {
    return <Card><CardContent className="p-6 space-y-3">
      <p role={resource.error ? 'alert' : 'status'}>
        {resource.error ? 'Scores are unavailable. No actual total can be shown.'
          : resource.isLoading ? 'Loading scores...' : `No scores have been published for Week ${week} yet.`}
      </p>
      <Button variant="outline" onClick={() => void getLiveResource(week).refresh(true)}>Retry scores</Button>
    </CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {resource.error && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
        {hasRealData ? 'Showing last available scores. ' : 'Scores are unavailable. '}
        {resource.error.message}
        <Button variant="outline" size="sm" className="ml-2" onClick={() => void getLiveResource(week).refresh(true)}>Retry</Button>
      </div>}
      {!resource.error && liveStats.length === 0 && <p role="status" className="text-sm text-muted-foreground">
        {resource.isLoading ? 'Loading scores...' : 'No player stats have been published for this week yet.'}
      </p>}
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity size={24} className="text-accent" />
              Live Scoring - Week {week}
              {hasRealData && (
                <Badge variant="secondary" className="ml-1 font-normal">
                  Live data{lastSync ? ` · ${new Date(lastSync).toLocaleTimeString()}` : ''}
                </Badge>
              )}
            </CardTitle>
            {allowSimulation && !hasRealData && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleLiveMode}
                  className="flex items-center gap-2"
                >
                  {isLiveMode ? <Pause size={16} /> : <Play size={16} />}
                  {isLiveMode ? 'Pause' : 'Start'} Live
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateNewStats}
                >
                  Refresh Stats
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-accent">{totalActualPoints.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Actual Points</div>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{totalProjectedPoints.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Projected Points</div>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className={`text-2xl font-bold ${
                totalActualPoints >= totalProjectedPoints ? 'text-green-600' : 'text-red-600'
              }`}>
                {totalActualPoints >= totalProjectedPoints ? '+' : ''}{(totalActualPoints - totalProjectedPoints).toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground">vs. Projection</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="lineup" className="flex items-center gap-2">
            <Trophy size={16} />
            Your Lineup
          </TabsTrigger>
          <TabsTrigger value="all-players" className="flex items-center gap-2">
            <Users size={16} />
            All Players
          </TabsTrigger>
          <TabsTrigger value="games" className="flex items-center gap-2">
            <Activity size={16} />
            Games
          </TabsTrigger>
          <TabsTrigger value="updates" className="flex items-center gap-2">
            <Activity size={16} />
            Live Feed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lineup" className="mt-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lineupPlayers.map(({ player, stats }) => (
              <LiveStatsCard
                key={player.id}
                player={player}
                stats={stats}
                isInLineup={true}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="all-players" className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Filter live players by position" className="flex gap-2">
              {['all', 'QB', 'RB', 'WR'].map(position => (
                <Button
                  key={position}
                  type="button"
                  size="sm"
                  variant={positionFilter === position ? 'default' : 'outline'}
                  aria-pressed={positionFilter === position}
                  onClick={() => setPositionFilter(position)}
                >
                  {position === 'all' ? 'All' : position}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {visiblePlayers.length} of {matchingPlayers.length} players with stats this week
            </p>
          </div>
          {visiblePlayers.length === 0 && (
            <p role="status" className="py-6 text-center text-sm text-muted-foreground">
              No {positionFilter === 'all' ? 'players' : `${positionFilter} players`} with recorded stats for Week {week}.
            </p>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visiblePlayers.map(player => {
              const stats = statsById.get(player.id);
              const isInLineup = lineupPlayerIds.includes(player.id);
              
              return (
                <LiveStatsCard
                  key={player.id}
                  player={player}
                  stats={stats}
                  isInLineup={isInLineup}
                />
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="games" className="mt-6">
          <GameStatusTracker games={gameStatuses} week={week} />
        </TabsContent>

        <TabsContent value="updates" className="mt-6">
          <LiveUpdatesFeed updates={liveUpdates} playerIdsInLineup={lineupPlayerIds} />
        </TabsContent>
      </Tabs>
    </div>
  );
}