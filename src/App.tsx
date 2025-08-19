import { useState, useEffect } from 'react';
import { useKV } from '@github/spark/hooks';
import { Player, LineupSlot, WeeklyLineup, PlayerUsage, MAX_PLAYER_USES } from '@/lib/types';
import { getPlayers, clearCache } from '@/lib/data';
import {
  createEmptyLineup,
  updatePlayerUsage,
  isLineupComplete,
  removePlayerFromLineup,
  addPlayerToLineup,
  isPlayerInLineup,
  calculateProjectedPoints
} from '@/lib/utils-fantasy';
import { PlayerTable } from '@/components/PlayerTable';
import { LineupSlotCard } from '@/components/LineupSlotCard';
import { LineupSummary } from '@/components/LineupSummary';
import { WeekNavigation } from '@/components/WeekNavigation';
import { LiveScoringDashboard } from '@/components/LiveScoringDashboard';
import { LeagueDashboard } from '@/components/LeagueDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { Trophy, Users, Target, Activity, Medal, RefreshCw } from '@phosphor-icons/react';
import { toast } from 'sonner';

function App() {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentLineup, setCurrentLineup] = useState<LineupSlot[]>(createEmptyLineup());
  const [selectedPosition, setSelectedPosition] = useState<'QB' | 'RB' | 'WR'>('QB');
  const [activeTab, setActiveTab] = useState<'lineup' | 'scoring' | 'leagues'>('lineup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);
  
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await spark.user();
        setCurrentUserId(user.id);
      } catch (error) {
        console.error('Failed to load user:', error);
        // Set a default user ID for demo purposes
        setCurrentUserId('demo_user_' + Date.now());
      }
    };
    loadUser();
  }, []);

  // Load players
  useEffect(() => {
    const loadPlayers = async () => {
      setIsLoadingPlayers(true);
      try {
        // Clear cache on component mount to ensure fresh 2025 season data with strict eligibility filtering
        clearCache();
        
        const currentPlayers = await getPlayers();
        setPlayers(currentPlayers);
        
        // Debug logging
        console.log('Players loaded with strict 2025 eligibility filtering:', currentPlayers.length);
        if (currentPlayers.length > 0) {
          console.log('Sample confirmed 2025 eligible players:', currentPlayers.slice(0, 3).map(p => ({ 
            id: p.id, 
            name: p.name, 
            position: p.position, 
            team: p.team 
          })));
          
          // Check for various name issues
          const badNames = currentPlayers.filter(p => 
            !p.name || 
            p.name.includes('undefined') || 
            p.name.trim() === '' ||
            p.name.startsWith('Player ')
          );
          if (badNames.length > 0) {
            console.error('Players with bad names:', badNames.slice(0, 5).map(p => ({
              id: p.id,
              name: p.name,
              team: p.team,
              position: p.position
            })));
          }
          
          // Count by position
          const qbs = currentPlayers.filter(p => p.position === 'QB').length;
          const rbs = currentPlayers.filter(p => p.position === 'RB').length;
          const wrs = currentPlayers.filter(p => p.position === 'WR').length;
          console.log('2025 season eligible player counts by position:', { qbs, rbs, wrs });
        }
      } catch (error) {
        console.error('Failed to load players:', error);
      } finally {
        setIsLoadingPlayers(false);
      }
    };
    
    loadPlayers();
  }, []);

  // Persistent data
  const [weeklyLineups, setWeeklyLineups] = useKV<WeeklyLineup[]>('weekly-lineups', []);
  const [playerUsage, setPlayerUsage] = useKV<PlayerUsage[]>('player-usage', []);

  // Load lineup for current week
  useEffect(() => {
    const weekData = weeklyLineups.find(w => w.week === currentWeek);
    if (weekData) {
      setCurrentLineup(weekData.lineup);
    } else {
      setCurrentLineup(createEmptyLineup());
    }
  }, [currentWeek, weeklyLineups]);

  const handlePlayerSelect = (player: Player) => {
    if (isPlayerInLineup(player.id, currentLineup)) {
      toast.error(`${player.name} is already in your lineup`);
      return;
    }

    // Find first available slot for this position
    const availableSlot = currentLineup.find(slot => 
      slot.position === player.position && !slot.player
    );

    if (!availableSlot) {
      toast.error(`No available ${player.position} slots`);
      return;
    }

    const newLineup = addPlayerToLineup(player, availableSlot.slotIndex, currentLineup);
    setCurrentLineup(newLineup);
    toast.success(`Added ${player.name} to lineup`);
  };

  const handleRemovePlayer = (slotIndex: number) => {
    const slot = currentLineup.find(s => s.slotIndex === slotIndex);
    if (slot?.player) {
      const newLineup = removePlayerFromLineup(slot.player.id, currentLineup);
      setCurrentLineup(newLineup);
      toast.success(`Removed ${slot.player.name} from lineup`);
    }
  };

  const handleDropPlayer = (player: Player, slotIndex: number) => {
    if (isPlayerInLineup(player.id, currentLineup)) {
      toast.error(`${player.name} is already in your lineup`);
      return;
    }

    const newLineup = addPlayerToLineup(player, slotIndex, currentLineup);
    setCurrentLineup(newLineup);
    toast.success(`Added ${player.name} to lineup`);
  };

  const handleSaveLineup = () => {
    if (!isLineupComplete(currentLineup)) {
      toast.error('Please fill all lineup slots before saving');
      return;
    }

    // Update player usage counts
    let newPlayerUsage = [...playerUsage];
    const existingWeekData = weeklyLineups.find(w => w.week === currentWeek);
    
    // If updating existing lineup, first subtract old usage
    if (existingWeekData) {
      existingWeekData.lineup.forEach(slot => {
        if (slot.player) {
          newPlayerUsage = updatePlayerUsage(slot.player.id, newPlayerUsage, -1);
        }
      });
    }

    // Add new usage
    currentLineup.forEach(slot => {
      if (slot.player) {
        newPlayerUsage = updatePlayerUsage(slot.player.id, newPlayerUsage, 1);
      }
    });

    // Save lineup
    const weeklyLineup: WeeklyLineup = {
      week: currentWeek,
      lineup: currentLineup,
      totalPoints: calculateProjectedPoints(currentLineup),
      actualPoints: existingWeekData?.actualPoints, // Preserve existing actual points
      isLocked: false
    };

    const newWeeklyLineups = weeklyLineups.filter(w => w.week !== currentWeek);
    newWeeklyLineups.push(weeklyLineup);
    newWeeklyLineups.sort((a, b) => a.week - b.week);

    setWeeklyLineups(newWeeklyLineups);
    setPlayerUsage(newPlayerUsage);
    toast.success(`Week ${currentWeek} lineup saved!`);
  };

  const handleRefreshPlayers = async () => {
    setIsLoadingPlayers(true);
    try {
      // Clear cache to force fresh data
      clearCache();
      const currentPlayers = await getPlayers();
      setPlayers(currentPlayers);
      
      // Debug logging
      console.log('Refreshed players:', currentPlayers.length);
      if (currentPlayers.length > 0) {
        console.log('First 3 refreshed players:', currentPlayers.slice(0, 3).map(p => ({ 
          id: p.id, 
          name: p.name, 
          position: p.position, 
          team: p.team 
        })));
      }
      
      toast.success('Player data refreshed!');
    } catch (error) {
      console.error('Failed to refresh players:', error);
      toast.error('Failed to refresh player data');
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const handlePlayersUpdate = (newPlayers: Player[]) => {
    // Update the main players list when PlayerTable loads filtered players
    setPlayers(newPlayers);
  };

  const handleForceSampleData = async () => {
    setIsLoadingPlayers(true);
    try {
      // Force clear everything and load sample data
      clearCache();
      const currentPlayers = await getPlayers();
      setPlayers(currentPlayers);
      
      console.log('Forced data reload:', currentPlayers.length);
      toast.success('Player data reloaded!');
    } catch (error) {
      console.error('Failed to reload data:', error);
      toast.error('Failed to reload player data');
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const handlePointsUpdate = (week: number, actualPoints: number) => {
    setWeeklyLineups(prev => prev.map(lineup => {
      if (lineup.week === week) {
        return { ...lineup, actualPoints };
      }
      return lineup;
    }));
  };

  const currentWeekLineup = weeklyLineups.find(w => w.week === currentWeek);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Trophy size={32} className="text-accent" />
            College Fantasy Football
          </h1>
          <p className="text-muted-foreground">
            Build your weekly lineup with confirmed 2025 season eligible players from ESPN data - only current college players who will be playing in the 2025/26 season are available, each can be used 3 times per season!
          </p>
        </div>

        {/* Week Navigation */}
        <WeekNavigation currentWeek={currentWeek} onWeekChange={setCurrentWeek} />

        {/* Main Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lineup" className="flex items-center gap-2">
              <Users size={16} />
              Set Lineup
            </TabsTrigger>
            <TabsTrigger value="scoring" className="flex items-center gap-2">
              <Activity size={16} />
              Live Scoring
            </TabsTrigger>
            <TabsTrigger value="leagues" className="flex items-center gap-2">
              <Medal size={16} />
              Leagues
            </TabsTrigger>
          </TabsList>

          {/* Lineup Tab */}
          <TabsContent value="lineup" className="mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Player Selection */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Available Players</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshPlayers}
                      disabled={isLoadingPlayers}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw size={14} className={isLoadingPlayers ? 'animate-spin' : ''} />
                      Refresh
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleForceSampleData}
                      disabled={isLoadingPlayers}
                      className="flex items-center gap-2"
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
                        Loading confirmed 2025 season eligible players from ESPN...
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Tabs value={selectedPosition} onValueChange={(value) => setSelectedPosition(value as any)}>
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
                        onPlayerSelect={handlePlayerSelect}
                        onPlayersUpdate={handlePlayersUpdate}
                      />
                    </TabsContent>
                  </Tabs>
                )}
              </div>

              {/* Lineup & Summary */}
              <div className="space-y-4">
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
                      />
                    ))}
                    
                    <Button
                      onClick={handleSaveLineup}
                      className="w-full"
                      disabled={!isLineupComplete(currentLineup)}
                    >
                      Save Week {currentWeek} Lineup
                    </Button>
                  </CardContent>
                </Card>

                <LineupSummary lineup={currentLineup} actualPoints={currentWeekLineup?.actualPoints} />

                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Season Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Weeks Completed</span>
                      <Badge variant="outline">
                        {weeklyLineups.length}/{15}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Players at Max Uses</span>
                      <Badge variant="outline">
                        {playerUsage.filter(u => u.timesUsed >= MAX_PLAYER_USES).length}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Live Scoring Tab */}
          <TabsContent value="scoring" className="mt-6">
            <LiveScoringDashboard 
              week={currentWeek}
              weeklyLineups={weeklyLineups}
              onPointsUpdate={handlePointsUpdate}
            />
          </TabsContent>

          {/* Leagues Tab */}
          <TabsContent value="leagues" className="mt-6">
            <LeagueDashboard
              currentWeek={currentWeek}
              weeklyLineups={weeklyLineups}
              currentUserId={currentUserId}
            />
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </div>
  );
}

export default App;