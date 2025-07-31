import { PlayerStats, Player } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, TrendingUp, Clock, User } from '@phosphor-icons/react';

interface LiveStatsCardProps {
  player: Player;
  stats?: PlayerStats;
  isInLineup?: boolean;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

interface LiveStatsCardProps {
  player: Player;
  stats?: PlayerStats;
  isInLineup?: boolean;
}

export function LiveStatsCard({ player, stats, isInLineup = false }: LiveStatsCardProps) {
  if (!stats) {
    return (
      <Card className={`${isInLineup ? 'border-accent' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            {/* Player Headshot */}
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
              {player.headshotUrl ? (
                <img 
                  src={player.headshotUrl} 
                  alt={`${player.name} headshot`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`absolute inset-0 flex items-center justify-center ${player.headshotUrl ? 'hidden' : ''}`}>
                <User size={12} className="text-muted-foreground" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium truncate">{player.name}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {player.position}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {/* Team Logo */}
                {player.teamLogoUrl && (
                  <img 
                    src={player.teamLogoUrl} 
                    alt={`${player.team} logo`}
                    className="w-3 h-3 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
                <p className="text-xs text-muted-foreground truncate">{player.team}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground text-sm">
            No live stats available
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatsByPosition = () => {
    if (player.position === 'QB') {
      return [
        { label: 'Pass Yds', value: stats.passingYards },
        { label: 'Pass TDs', value: stats.passingTDs },
        { label: 'Comp/Att', value: `${stats.completions}/${stats.attempts}` },
        { label: 'INTs', value: stats.interceptions },
      ];
    } else if (player.position === 'RB') {
      return [
        { label: 'Rush Yds', value: stats.rushingYards },
        { label: 'Rush TDs', value: stats.rushingTDs },
        { label: 'Rec Yds', value: stats.receivingYards },
        { label: 'Rec TDs', value: stats.receivingTDs },
      ];
    } else {
      return [
        { label: 'Rec Yds', value: stats.receivingYards },
        { label: 'Receptions', value: stats.receptions },
        { label: 'Rec TDs', value: stats.receivingTDs },
        { label: 'Rush Yds', value: stats.rushingYards },
      ];
    }
  };

  const keyStats = getStatsByPosition();
  const pointsDiff = stats.fantasyPoints - player.projectedPoints;
  const progressValue = Math.min((stats.fantasyPoints / player.projectedPoints) * 100, 100);

  return (
    <Card className={`${isInLineup ? 'border-accent bg-accent/5' : ''} transition-all duration-200`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          {/* Player Headshot */}
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
            {player.headshotUrl ? (
              <img 
                src={player.headshotUrl} 
                alt={`${player.name} headshot`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`absolute inset-0 flex items-center justify-center ${player.headshotUrl ? 'hidden' : ''}`}>
              <User size={16} className="text-muted-foreground" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <span className="truncate">{player.name}</span>
                {isInLineup && <Activity size={14} className="text-accent" />}
              </CardTitle>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline" className="text-xs">
                  {player.position}
                </Badge>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock size={10} />
                  {formatTimeAgo(stats.lastUpdated)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {/* Team Logo */}
              {player.teamLogoUrl && (
                <img 
                  src={player.teamLogoUrl} 
                  alt={`${player.team} logo`}
                  className="w-4 h-4 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              )}
              <p className="text-xs text-muted-foreground truncate">{player.team}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Fantasy Points */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Fantasy Points</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{stats.fantasyPoints}</span>
              <div className={`flex items-center gap-1 text-xs ${
                pointsDiff >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                <TrendingUp size={12} className={pointsDiff < 0 ? 'rotate-180' : ''} />
                {pointsDiff >= 0 ? '+' : ''}{pointsDiff.toFixed(1)}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Progress value={progressValue} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>vs. Projection</span>
              <span>{player.projectedPoints} pts</span>
            </div>
          </div>
        </div>

        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {keyStats.map((stat, index) => (
            <div key={index} className="text-center p-2 bg-muted/30 rounded">
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              <div className="text-sm font-medium">{stat.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}