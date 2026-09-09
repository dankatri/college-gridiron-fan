import { useState } from 'react';
import { LeaderboardEntry, WeeklyLineup } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Trophy, 
  TrendUp, 
  TrendDown, 
  Minus, 
  Medal,
  User,
  Calendar,
  Users,
} from '@phosphor-icons/react';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentWeek: number;
  currentUserId?: string;
  showWeeklyView?: boolean;
  onWeekChange?: (week: number) => void;
  /** Opens a member's lineup. Absent while no week has finished yet. */
  onSelectMember?: (entry: LeaderboardEntry) => void;
}

export function Leaderboard({ 
  entries, 
  currentWeek, 
  currentUserId,
  showWeeklyView = false,
  onWeekChange,
  onSelectMember
}: LeaderboardProps) {
  const [viewMode, setViewMode] = useState<'season' | 'weekly'>('season');
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const showWeekPoints = entries.some(entry => entry.pointsThisWeek !== undefined);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="text-yellow-500" size={20} />;
      case 2:
        return <Medal className="text-gray-400" size={20} />;
      case 3:
        return <Medal className="text-amber-600" size={20} />;
      default:
        return <span className="text-muted-foreground font-semibold">{rank}</span>;
    }
  };

  const getTrendIcon = (entry: LeaderboardEntry) => {
    if (entry.trend === 'up') {
      return <TrendUp className="text-green-500" size={16} />;
    } else if (entry.trend === 'down') {
      return <TrendDown className="text-red-500" size={16} />;
    }
    return <Minus className="text-muted-foreground" size={16} />;
  };

  const formatPoints = (points: number) => {
    return points.toFixed(1);
  };

  const isCurrentUser = (userId: string) => userId === currentUserId;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy size={20} />
            Leaderboard
          </CardTitle>
          
          {showWeeklyView && (
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'season' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('season')}
              >
                Season
              </Button>
              <Button
                variant={viewMode === 'weekly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('weekly')}
              >
                <Calendar size={16} className="mr-1" />
                Week {selectedWeek}
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Winning weeks count completed game weeks. Tied leaders each receive a win.
        </p>
      </CardHeader>
      
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users size={32} className="mx-auto mb-2 opacity-50" />
            <p>No league members yet</p>
          </div>
        ) : (
          <Table aria-label="League standings" className="min-w-[28rem]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="w-10 text-center text-xs text-muted-foreground">Rank</TableHead>
                <TableHead scope="col" className="text-xs text-muted-foreground">Member</TableHead>
                <TableHead scope="col" className="w-24 text-right text-xs text-muted-foreground">Total points</TableHead>
                <TableHead scope="col" className="w-24 text-right text-xs text-muted-foreground">Winning weeks</TableHead>
                {showWeekPoints && (
                  <TableHead scope="col" className="w-20 text-right text-xs text-muted-foreground">This week</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow
                  key={entry.userId}
                  className={isCurrentUser(entry.userId) ? 'bg-accent/20 hover:bg-accent/20 border-accent' : 'bg-card'}
                >
                  <TableCell className="py-3" aria-label={`Rank ${entry.rank}`}>
                    <div className="flex justify-center">{getRankIcon(entry.rank)}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="hidden h-8 w-8 sm:flex">
                        <AvatarImage src={entry.avatarUrl} alt={entry.username} />
                        <AvatarFallback><User size={16} /></AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {onSelectMember ? (
                            <button
                              type="button"
                              onClick={() => onSelectMember(entry)}
                              className="max-w-40 sm:max-w-64 font-medium truncate underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                              title={`View ${entry.username}'s lineup`}
                            >
                              {entry.username}
                            </button>
                          ) : (
                            <span className="max-w-40 sm:max-w-64 font-medium truncate">{entry.username}</span>
                          )}
                          {isCurrentUser(entry.userId) && (
                            <Badge variant="secondary" className="text-xs">You</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{entry.weeksPlayed} weeks played</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right tabular-nums">
                    <div className="font-semibold">{formatPoints(entry.totalPoints)} pts</div>
                    <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                      {getTrendIcon(entry)}
                      <span>{formatPoints(entry.weeklyAverage)} avg</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right font-semibold tabular-nums" data-testid="winning-weeks">
                    {entry.winningWeeks}
                  </TableCell>
                  {showWeekPoints && (
                    <TableCell className="py-3 text-right font-medium tabular-nums">
                      {entry.pointsThisWeek === undefined ? '-' : formatPoints(entry.pointsThisWeek)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* League Stats Summary */}
        {entries.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm font-medium">
                  {formatPoints(Math.max(...entries.map(e => e.totalPoints)))}
                </div>
                <div className="text-xs text-muted-foreground">High Score</div>
              </div>
              <div>
                <div className="text-sm font-medium">
                  {formatPoints(
                    entries.reduce((sum, e) => sum + e.totalPoints, 0) / entries.length
                  )}
                </div>
                <div className="text-xs text-muted-foreground">League Avg</div>
              </div>
              <div>
                <div className="text-sm font-medium">
                  {Math.max(...entries.map(e => e.bestWeek)).toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">Best Week</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
