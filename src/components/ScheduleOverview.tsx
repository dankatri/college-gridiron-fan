import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getTeamSchedules, getTeamsOnBye, clearScheduleCache } from '@/lib/schedule-data';
import { TeamSchedule, ALL_WEEKS } from '@/lib/types';
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
      // Otherwise the hour-long client cache would serve the same data back.
      clearScheduleCache();
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

  type WeekGame = {
    homeTeam: string;
    awayTeam: string;
    homePoints?: number;
    awayPoints?: number;
    isCompleted: boolean;
    kickoff?: Date;
  };

  const getWeekGames = (week: number): WeekGame[] => {
    const games: WeekGame[] = [];
    const processedGames = new Set<string>();

    schedules.forEach(schedule => {
      const weekGame = schedule.weeklyGames.find(game => game.week === week && !game.isByeWeek);
      if (!weekGame || !weekGame.opponent) return;

      const gameKey = [schedule.teamName, weekGame.opponent].sort().join('-');
      if (processedGames.has(gameKey)) return;
      processedGames.add(gameKey);

      // Scores are stored from this team's perspective, so flip them when the
      // team we are iterating is the away side.
      games.push({
        homeTeam: weekGame.isHomeGame ? schedule.teamName : weekGame.opponent,
        awayTeam: weekGame.isHomeGame ? weekGame.opponent : schedule.teamName,
        homePoints: weekGame.isHomeGame ? weekGame.teamPoints : weekGame.opponentPoints,
        awayPoints: weekGame.isHomeGame ? weekGame.opponentPoints : weekGame.teamPoints,
        isCompleted: weekGame.isCompleted === true,
        kickoff: weekGame.gameDate,
      });
    });

    return games.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? -1 : 1;
      return (a.kickoff?.getTime() ?? 0) - (b.kickoff?.getTime() ?? 0);
    });
  };

  const weekGames = getWeekGames(selectedWeek);
  const completedCount = weekGames.filter(game => game.isCompleted).length;
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
              {ALL_WEEKS.map(week => (
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
                      {completedCount > 0 && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {completedCount} final
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      {weekGames.length > 0 ? (
                        <div className="space-y-2">
                          {weekGames.map((game, index) => {
                            const awayWon =
                              game.isCompleted && (game.awayPoints ?? 0) > (game.homePoints ?? 0);
                            const homeWon =
                              game.isCompleted && (game.homePoints ?? 0) > (game.awayPoints ?? 0);

                            return (
                              <div key={index} className="rounded bg-muted/30 p-2 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`min-w-0 flex-1 truncate ${awayWon ? 'font-semibold' : 'font-medium'}`}>
                                    {game.awayTeam}
                                  </span>
                                  {game.isCompleted ? (
                                    <span className={`tabular-nums ${awayWon ? 'font-semibold' : 'text-muted-foreground'}`}>
                                      {game.awayPoints}
                                    </span>
                                  ) : null}
                                  <span className="text-xs text-muted-foreground">@</span>
                                  {game.isCompleted ? (
                                    <span className={`tabular-nums ${homeWon ? 'font-semibold' : 'text-muted-foreground'}`}>
                                      {game.homePoints}
                                    </span>
                                  ) : null}
                                  <span className={`min-w-0 flex-1 truncate text-right ${homeWon ? 'font-semibold' : 'font-medium'}`}>
                                    {game.homeTeam}
                                  </span>
                                </div>
                                <div className="mt-1 text-center text-xs text-muted-foreground">
                                  {game.isCompleted
                                    ? 'Final'
                                    : game.kickoff
                                      ? game.kickoff.toLocaleString(undefined, {
                                          weekday: 'short',
                                          month: 'short',
                                          day: 'numeric',
                                          hour: 'numeric',
                                          minute: '2-digit',
                                        })
                                      : 'Scheduled'}
                                </div>
                              </div>
                            );
                          })}
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