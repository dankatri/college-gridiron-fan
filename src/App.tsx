import { useState, useEffect } from 'react';
import { useKV } from '@github/spark/hooks';
import { Player, LineupSlot, WeeklyLineup, PlayerUsage, MAX_PLAYER_USES } from '@/lib/types';
import { SAMPLE_PLAYERS } from '@/lib/data';
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
import { Trophy, Users, Target, Activity, Medal } from '@phosphor-icons/react';
import { toast } from 'sonner';

function App() {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentLineup, setCurrentLineup] = useState<LineupSlot[]>(createEmptyLineup());
  const [selectedPosition, setSelectedPosition] = useState<'QB' | 'RB' | 'WR'>('QB');
  const [activeTab, setActiveTab] = useState<'lineup' | 'scoring' | 'leagues'>('lineup');
  
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
            College Football Fantasy
          </h1>
          <p className="text-muted-foreground">
            Build your weekly lineup - remember, each player can only be used 3 times per season!
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
                <Tabs value={selectedPosition} onValueChange={(value) => setSelectedPosition(value as any)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="QB">Quarterbacks</TabsTrigger>
                    <TabsTrigger value="RB">Running Backs</TabsTrigger>
                    <TabsTrigger value="WR">Wide Receivers</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value={selectedPosition} className="mt-4">
                    <PlayerTable
                      position={selectedPosition}
                      players={SAMPLE_PLAYERS}
                      playerUsage={playerUsage}
                      currentLineup={currentLineup}
                      onPlayerSelect={handlePlayerSelect}
                    />
                  </TabsContent>
                </Tabs>
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
    </div>
  );
}

export default App;