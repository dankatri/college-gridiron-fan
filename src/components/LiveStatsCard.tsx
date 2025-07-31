import { PlayerStats, Player } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, TrendingUp, Clock } from '@phosphor-icons/react';

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
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{player.name}</CardTitle>
            <Badge variant="outline" className="text-xs">
              {player.position}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{player.team}</p>
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {player.name}
              {isInLineup && <Activity size={14} className="text-accent" />}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{player.team}</p>
          </div>
          <div className="text-right">
            <Badge variant="outline" className="text-xs mb-1">
              {player.position}
            </Badge>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={10} />
              {formatTimeAgo(stats.lastUpdated)}
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