import { LiveUpdate } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Lightning, TrendingUp, TrendingDown } from '@phosphor-icons/react';

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

interface LiveUpdatesFeedProps {
  updates: LiveUpdate[];
  playerIdsInLineup: string[];
}

export function LiveUpdatesFeed({ updates, playerIdsInLineup }: LiveUpdatesFeedProps) {
  // Sort updates by timestamp (most recent first)
  const sortedUpdates = [...updates].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getUpdateIcon = (statType: string, statValue: number) => {
    if (statType.includes('TD') || statType.includes('touchdown')) {
      return <Lightning size={16} className="text-yellow-500" />;
    }
    if (statValue > 0) {
      return <TrendingUp size={16} className="text-green-600" />;
    }
    return <TrendingDown size={16} className="text-red-600" />;
  };

  const getUpdateColor = (statType: string, statValue: number) => {
    if (statType.includes('TD') || statType.includes('touchdown')) {
      return 'bg-yellow-100 border-yellow-300';
    }
    if (statType.includes('interception') || statValue < 0) {
      return 'bg-red-50 border-red-200';
    }
    return 'bg-green-50 border-green-200';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lightning size={20} className="text-accent" />
          Live Updates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {sortedUpdates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No live updates yet
              </div>
            ) : (
              sortedUpdates.map((update) => {
                const isLineupPlayer = playerIdsInLineup.includes(update.playerId);
                
                return (
                  <div
                    key={update.id}
                    className={`p-3 rounded-lg border transition-all duration-200 ${
                      isLineupPlayer 
                        ? 'border-accent bg-accent/10' 
                        : getUpdateColor(update.statType, update.statValue)
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getUpdateIcon(update.statType, update.statValue)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isLineupPlayer && (
                            <Badge variant="default" className="text-xs bg-accent">
                              Your Player
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(update.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {update.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}