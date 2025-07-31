import { GameStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Trophy, Play } from '@phosphor-icons/react';

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

interface GameStatusTrackerProps {
  games: GameStatus[];
  week: number;
}

export function GameStatusTracker({ games, week }: GameStatusTrackerProps) {
  const getStatusBadge = (status: GameStatus['status']) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="outline" className="text-xs">Scheduled</Badge>;
      case 'in-progress':
        return <Badge variant="default" className="text-xs bg-green-600">Live</Badge>;
      case 'final':
        return <Badge variant="secondary" className="text-xs">Final</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Unknown</Badge>;
    }
  };

  const getStatusIcon = (status: GameStatus['status']) => {
    switch (status) {
      case 'scheduled':
        return <Clock size={16} className="text-muted-foreground" />;
      case 'in-progress':
        return <Play size={16} className="text-green-600" />;
      case 'final':
        return <Trophy size={16} className="text-yellow-600" />;
      default:
        return <Clock size={16} className="text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy size={20} />
          Week {week} Games
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {games.map((game, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 border rounded-lg transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(game.status)}
              <div>
                <div className="font-medium text-sm">
                  {game.team1} vs {game.team2}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  {game.status === 'in-progress' && game.quarter && game.timeRemaining && (
                    <span>Q{game.quarter} - {game.timeRemaining}</span>
                  )}
                  <span>
                    Updated {formatTimeAgo(game.lastUpdated)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                {getStatusBadge(game.status)}
              </div>
              {(game.status === 'in-progress' || game.status === 'final') && (
                <div className="text-sm font-medium">
                  {game.team1Score} - {game.team2Score}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {games.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No games scheduled for Week {week}
          </div>
        )}
      </CardContent>
    </Card>
  );
}