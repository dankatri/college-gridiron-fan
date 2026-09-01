import { useState, useEffect } from 'react';
import { useLocalStorage as useKV } from '@/hooks/use-local-storage';
import { PlayerStats, GameStatus, LiveUpdate, Player, WeeklyLineup } from '@/lib/types';
import { generateLiveStats, generateGameStatuses, createLiveUpdate, calculateFantasyPoints } from '@/lib/stats-utils';
import { SAMPLE_PLAYERS, getPlayers } from '@/lib/data';
import { getLiveData } from '@/lib/live-data';
import { SEASON_YEAR } from '@/lib/season-config';
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
}

export function LiveScoringDashboard({ 
  week, 
  weeklyLineups,
  onPointsUpdate 
}: LiveScoringDashboardProps) {
  const [selectedTab, setSelectedTab] = useState<'lineup' | 'all-players' | 'games' | 'updates'>('lineup');
  const [isLiveMode, setIsLiveMode] = useState(false);
  
  // Persistent live data
  const [liveStats, setLiveStats] = useKV<PlayerStats[]>(`live-stats-${SEASON_YEAR}-week-${week}`, []);
  const [gameStatuses, setGameStatuses] = useKV<GameStatus[]>(`game-statuses-${SEASON_YEAR}-week-${week}`, []);
  const [liveUpdates, setLiveUpdates] = useKV<LiveUpdate[]>(`live-updates-${SEASON_YEAR}-week-${week}`, []);

  // Real CollegeFootballData box scores, when the worker has published them.
  const [players, setPlayers] = useState<Player[]>(SAMPLE_PLAYERS);
  const [hasRealData, setHasRealData] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const currentWeekLineup = weeklyLineups.find(w => w.week === week);
  const lineupPlayerIds = currentWeekLineup?.lineup
    .filter(slot => slot.player)
    .map(slot => slot.player!.id) || [];

  useEffect(() => {
    let cancelled = false;
    getPlayers()
      .then(loaded => {
        if (!cancelled && loaded.length > 0) setPlayers(loaded);
      })
      .catch(error => console.warn('Could not load player pool:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefer real data; simulation is only a fallback for out-of-season/dev use.
  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const live = await getLiveData(week);
      if (cancelled) return false;

      if (live && live.week === week && live.stats.length > 0) {
        setLiveStats(live.stats);
        setGameStatuses(live.games);
        setHasRealData(true);
        setLastSync(live.updatedAt);
        return true;
      }

      setHasRealData(false);
      return false;
    };

    sync().then(gotRealData => {
      if (cancelled || gotRealData) return;
      // Functional updates: useLocalStorage re-reads asynchronously when the
      // week key changes, so the captured values are still the previous week's.
      setLiveStats(prev => (prev.length === 0 ? generateLiveStats(SAMPLE_PLAYERS, week) : prev));
      setGameStatuses(prev => (prev.length === 0 ? generateGameStatuses(week) : prev));
    });

    // The worker republishes every few minutes during games.
    const interval = setInterval(sync, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, setLiveStats, setGameStatuses]);

  // Live updates simulation
  useEffect(() => {
    if (!isLiveMode || hasRealData) return;

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
  }, [isLiveMode, hasRealData, liveStats, lineupPlayerIds, week, setLiveStats, setLiveUpdates]);

  // Calculate actual lineup points when stats change
  useEffect(() => {
    if (currentWeekLineup && liveStats.length > 0) {
      let totalActualPoints = 0;
      
      currentWeekLineup.lineup.forEach(slot => {
        if (slot.player) {
          const playerStats = liveStats.find(s => s.playerId === slot.player!.id);
          if (playerStats) {
            totalActualPoints += playerStats.fantasyPoints;
          }
        }
      });
      
      onPointsUpdate(week, Math.round(totalActualPoints * 10) / 10);
    }
  }, [liveStats, currentWeekLineup, week, onPointsUpdate]);

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
    return players.find(p => p.id === id);
  };

  const lineupPlayers = currentWeekLineup?.lineup
    .filter(slot => slot.player)
    .map(slot => ({
      player: slot.player!,
      stats: liveStats.find(s => s.playerId === slot.player!.id)
    })) || [];

  const totalActualPoints = lineupPlayers.reduce((sum, { stats }) => {
    return sum + (stats?.fantasyPoints || 0);
  }, 0);

  const totalProjectedPoints = lineupPlayers.reduce((sum, { player }) => {
    return sum + player.projectedPoints;
  }, 0);

  // Rendering 3,700 players is unusable; show those with stats this week.
  const statedPlayers = hasRealData
    ? liveStats
        .map(stat => players.find(p => p.id === stat.playerId))
        .filter((player): player is Player => Boolean(player))
        .slice(0, 100)
    : SAMPLE_PLAYERS;

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

  return (
    <div className="space-y-6">
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
            {!hasRealData && (
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statedPlayers.map(player => {
              const stats = liveStats.find(s => s.playerId === player.id);
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