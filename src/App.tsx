import { useState, useEffect } from 'react';
import { Player, LineupSlot, WeeklyLineup, PlayerUsage, MAX_PLAYER_USES, TOTAL_WEEKS } from '@/lib/types';
import { getPlayers, clearCache } from '@/lib/data';
import { SEASON_YEAR, WEEK_START_DATES } from '@/lib/season-config';
import { useLocalStorage as useKV } from '@/hooks/use-local-storage';
import { useAuth } from '@/hooks/use-auth';
import {
  createEmptyLineup,
  updatePlayerUsage,
  isLineupComplete,
  removePlayerFromLineup,
  addPlayerToLineup,
  isPlayerInLineup,
  calculateProjectedPoints,
  isWeekLocked,
  getCurrentWeek,
  getWeekStatus
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
import { Toaster } from '@/components/ui/sonner';
import { Trophy, Users, Target, Activity, Medal, RefreshCw, Calendar, SignOut } from '@phosphor-icons/react';
import { toast } from 'sonner';

function App() {
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeek());
  const [currentLineup, setCurrentLineup] = useState<LineupSlot[]>(createEmptyLineup());
  const [selectedPosition, setSelectedPosition] = useState<'QB' | 'RB' | 'WR'>('QB');
  const [activeTab, setActiveTab] = useState<'lineup' | 'schedule' | 'scoring' | 'leagues'>('lineup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);
  
  // Authentication via local profile
  const { user: currentUser, signIn, signOut } = useAuth();
  const isAuthenticated = !!currentUser;

  // Load players only when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loadPlayers = async () => {
      setIsLoadingPlayers(true);
      try {
        // Clear cache on component mount to ensure fresh season data
        clearCache();
        
        const currentPlayers = await getPlayers();
        setPlayers(currentPlayers);
        
        console.log('Players loaded for season:', currentPlayers.length);
        if (currentPlayers.length > 0) {
          console.log('Sample eligible players:', currentPlayers.slice(0, 3).map(p => ({ 
            id: p.id, 
            name: p.name, 
            position: p.position, 
            team: p.team,
            headshotUrl: p.headshotUrl 
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
          console.log(`${SEASON_YEAR} season player counts by position:`, { qbs, rbs, wrs });
        }
      } catch (error) {
        console.error('Failed to load players:', error);
      } finally {
        setIsLoadingPlayers(false);
      }
    };
    
    loadPlayers();
  }, [isAuthenticated]);

  // Persistent data - scoped to authenticated user
  const [weeklyLineups, setWeeklyLineups] = useKV<WeeklyLineup[]>(`weekly-lineups-${currentUser?.id || 'unknown'}-${SEASON_YEAR}`, []);
  const [playerUsage, setPlayerUsage] = useKV<PlayerUsage[]>(`player-usage-${currentUser?.id || 'unknown'}-${SEASON_YEAR}`, []);

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
    // Check if current week is locked
    if (isWeekLocked(currentWeek)) {
      toast.error(`Week ${currentWeek} lineup is locked and cannot be modified`);
      return;
    }

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
    // Check if current week is locked
    if (isWeekLocked(currentWeek)) {
      toast.error(`Week ${currentWeek} lineup is locked and cannot be modified`);
      return;
    }

    const slot = currentLineup.find(s => s.slotIndex === slotIndex);
    if (slot?.player) {
      const newLineup = removePlayerFromLineup(slot.player.id, currentLineup);
      setCurrentLineup(newLineup);
      toast.success(`Removed ${slot.player.name} from lineup`);
    }
  };

  const handleDropPlayer = (player: Player, slotIndex: number) => {
    // Check if current week is locked
    if (isWeekLocked(currentWeek)) {
      toast.error(`Week ${currentWeek} lineup is locked and cannot be modified`);
      return;
    }

    if (isPlayerInLineup(player.id, currentLineup)) {
      toast.error(`${player.name} is already in your lineup`);
      return;
    }

    const newLineup = addPlayerToLineup(player, slotIndex, currentLineup);
    setCurrentLineup(newLineup);
    toast.success(`Added ${player.name} to lineup`);
  };

  const handleSaveLineup = () => {
    // Check if current week is locked
    if (isWeekLocked(currentWeek)) {
      toast.error(`Week ${currentWeek} lineup is locked and cannot be modified`);
      return;
    }

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

    // Save lineup - set isLocked based on week status
    const weeklyLineup: WeeklyLineup = {
      week: currentWeek,
      lineup: currentLineup,
      totalPoints: calculateProjectedPoints(currentLineup),
      actualPoints: existingWeekData?.actualPoints, // Preserve existing actual points
      isLocked: isWeekLocked(currentWeek)
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

  const handleLoginSuccess = (login: string, email?: string) => {
    signIn(login, email);
    toast.success(`Welcome, ${login}!`);
  };

  const handleLogout = () => {
    signOut();
    setPlayers([]);
    setCurrentLineup(createEmptyLineup());
    setCurrentWeek(1);
    setActiveTab('lineup');
    clearCache();
    toast.success('Logged out successfully');
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

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-center space-y-2 flex-1">
            <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
              <Trophy size={32} className="text-accent" />
              College Fantasy Football
            </h1>
            <p className="text-muted-foreground">
              Build your weekly lineup with {SEASON_YEAR} season players - each can be used 3 times maximum! Lineups can be edited until each week begins.
            </p>
          </div>
          
          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center gap-2 text-sm font-medium">
                {currentUser.avatarUrl && (
                  <img 
                    src={currentUser.avatarUrl} 
                    alt={currentUser.login}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                {currentUser.login}
              </div>
              <div className="text-xs text-muted-foreground">
                {currentUser.email}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <SignOut size={14} />
              Logout
            </Button>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="space-y-2">
          <WeekNavigation currentWeek={currentWeek} onWeekChange={setCurrentWeek} />
          <div className="flex items-center justify-between">
            {(() => {
              const seasonStart = WEEK_START_DATES[1];
              const now = new Date();
              if (now < seasonStart) {
                const daysUntil = Math.ceil((seasonStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div className="flex items-center justify-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <Trophy size={16} />
                    {SEASON_YEAR} season starts in {daysUntil} days — set your Week 1 lineup now!
                  </div>
                );
              }
              if (isWeekLocked(currentWeek)) {
                return (
                  <div className="flex items-center justify-center gap-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-2">
                    <Trophy size={16} />
                    Week {currentWeek} lineup is locked - no changes allowed
                  </div>
                );
              }
              return (
                <div className="flex items-center justify-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-2">
                  <Trophy size={16} />
                  Week {currentWeek} lineup can be edited until the week starts
                </div>
              );
            })()}
            <div className="text-xs text-muted-foreground">
              Current Date: {new Date().toLocaleDateString('en-US', { 
                weekday: 'short',
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>

        {/* Main Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="lineup" className="flex items-center gap-2">
              <Users size={16} />
              Set Lineup
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Calendar size={16} />
              Schedule
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
                  <div>
                    <h3 className="text-lg font-semibold">Available Players</h3>
                    {isWeekLocked(currentWeek) && (
                      <p className="text-sm text-orange-600 mt-1">
                        Week {currentWeek} is locked - viewing only
                      </p>
                    )}
                  </div>
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
                        Loading {SEASON_YEAR} season players from ESPN...
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
                        currentWeek={currentWeek}
                        onPlayerSelect={handlePlayerSelect}
                        onPlayersUpdate={handlePlayersUpdate}
                        isLocked={isWeekLocked(currentWeek)}
                      />
                    </TabsContent>
                  </Tabs>
                )}
              </div>

              {/* Lineup & Summary */}
              <div className="space-y-4">
                {/* Bye Week Alert */}
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
                      />
                    ))}
                    
                    <Button
                      onClick={handleSaveLineup}
                      className="w-full"
                      disabled={!isLineupComplete(currentLineup) || isWeekLocked(currentWeek)}
                    >
                      {isWeekLocked(currentWeek) 
                        ? `Week ${currentWeek} Locked` 
                        : `Save Week ${currentWeek} Lineup`
                      }
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
                        {weeklyLineups.length}/{TOTAL_WEEKS}
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

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="mt-6">
            <ScheduleOverview currentWeek={currentWeek} />
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
              currentUserId={currentUser?.id || ''}
            />
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </div>
  );
}

export default App;