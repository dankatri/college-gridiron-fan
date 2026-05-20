import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getTeamSchedules, getTeamsOnBye } from '@/lib/schedule-data';
import { TeamSchedule, TOTAL_WEEKS } from '@/lib/types';
import { WEEK_LABELS } from '@/lib/season-config';
import { Calendar, CalendarX, ArrowClockwise as RefreshCw, Users } from '@phosphor-icons/react';

interface ScheduleOverviewProps {
  currentWeek: number;
}

export function ScheduleOverview({ currentWeek }: ScheduleOverviewProps) {
  const [schedules, setSchedules] = useState<TeamSchedule[]>([]);
  const [teamsOnBye, setTeamsOnBye] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  // Load schedule data
  useEffect(() => {
    const loadScheduleData = async () => {
      setIsLoading(true);
      try {
        const [scheduleData, byeTeams] = await Promise.all([
          getTeamSchedules(),
          getTeamsOnBye(selectedWeek)
        ]);
        setSchedules(scheduleData);
        setTeamsOnBye(byeTeams);
      } catch (error) {
        console.error('Failed to load schedule data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadScheduleData();
  }, [selectedWeek]);

  // Update bye teams when week changes
  useEffect(() => {
    const updateByeTeams = async () => {
      try {
        const byeTeams = await getTeamsOnBye(selectedWeek);
        setTeamsOnBye(byeTeams);
      } catch (error) {
        console.error('Failed to update bye teams:', error);
      }
    };

    if (schedules.length > 0) {
      updateByeTeams();
    }
  }, [selectedWeek, schedules]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const scheduleData = await getTeamSchedules();
      setSchedules(scheduleData);
      const byeTeams = await getTeamsOnBye(selectedWeek);
      setTeamsOnBye(byeTeams);
    } catch (error) {
      console.error('Failed to refresh schedule data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getWeekGames = (week: number) => {
    const games: { homeTeam: string; awayTeam: string; }[] = [];
    const processedGames = new Set<string>();

    schedules.forEach(schedule => {
      const weekGame = schedule.weeklyGames.find(game => game.week === week && !game.isByeWeek);
      if (weekGame && weekGame.opponent) {
        const gameKey = [schedule.teamName, weekGame.opponent].sort().join('-');
        if (!processedGames.has(gameKey)) {
          if (weekGame.isHomeGame) {
            games.push({
              homeTeam: schedule.teamName,
              awayTeam: weekGame.opponent
            });
          } else {
            games.push({
              homeTeam: weekGame.opponent,
              awayTeam: schedule.teamName
            });
          }
          processedGames.add(gameKey);
        }
      }
    });

    return games;
  };

  const weekGames = getWeekGames(selectedWeek);
  const byeTeamsForWeek = schedules.filter(s => s.byeWeeks.includes(selectedWeek));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar size={20} />
            Schedule Overview
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Week Selection */}
        <Tabs value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
          <ScrollArea className="w-full">
            <TabsList className="flex w-max gap-1">
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(week => (
                <TabsTrigger key={week} value={week.toString()} className="text-xs px-2">
                  {WEEK_LABELS[week] || `W${week}`}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>
          
          <div className="mt-4 space-y-4">
            {/* Current Week Indicator */}
            {selectedWeek === currentWeek && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">Current Week</Badge>
                Week {selectedWeek}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <RefreshCw size={20} className="animate-spin" />
                  Loading schedule data...
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Games This Week */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users size={16} />
                      Games (Week {selectedWeek})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      {weekGames.length > 0 ? (
                        <div className="space-y-2">
                          {weekGames.map((game, index) => (
                            <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                              <span className="font-medium">{game.awayTeam}</span>
                              <span className="text-muted-foreground">@</span>
                              <span className="font-medium">{game.homeTeam}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-4">
                          No games scheduled
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Bye Teams */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarX size={16} />
                      Bye Teams (Week {selectedWeek})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      {byeTeamsForWeek.length > 0 ? (
                        <div className="space-y-2">
                          {byeTeamsForWeek.map((team) => (
                            <div key={team.teamId} className="flex items-center gap-2">
                              <Badge variant="outline" className="flex items-center gap-1">
                                <CalendarX size={12} />
                                BYE
                              </Badge>
                              <span className="text-sm">{team.teamName}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-4">
                          No teams on bye
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Week Navigation */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={selectedWeek <= 1}
                onClick={() => setSelectedWeek(selectedWeek - 1)}
              >
                Previous Week
              </Button>
              <span className="text-sm text-muted-foreground">
                Week {selectedWeek} of 15
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedWeek >= 15}
                onClick={() => setSelectedWeek(selectedWeek + 1)}
              >
                Next Week
              </Button>
            </div>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}