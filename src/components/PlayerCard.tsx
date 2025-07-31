import { Player, PlayerUsage } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPlayerUsage, isPlayerAvailable } from '@/lib/utils-fantasy';
import { cn } from '@/lib/utils';
import { User } from '@phosphor-icons/react';

interface PlayerCardProps {
  player: Player;
  playerUsage: PlayerUsage[];
  onSelect?: (player: Player) => void;
  isSelected?: boolean;
  isDragging?: boolean;
}

export function PlayerCard({ 
  player, 
  playerUsage, 
  onSelect, 
  isSelected = false,
  isDragging = false
}: PlayerCardProps) {
  const usage = getPlayerUsage(player.id, playerUsage);
  const available = isPlayerAvailable(player.id, playerUsage);
  const usageText = `${usage}/3`;
  
  const handleClick = () => {
    if (available && onSelect) {
      onSelect(player);
    }
  };

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md border-2",
        available ? "hover:border-primary" : "opacity-50 cursor-not-allowed",
        isSelected && "border-primary bg-primary/5",
        isDragging && "opacity-50 rotate-2"
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-medium">
              {player.position}
            </Badge>
            <Badge 
              variant={usage === 3 ? "destructive" : usage === 2 ? "secondary" : "default"}
              className="text-xs"
            >
              {usageText}
            </Badge>
          </div>
          <div className="text-sm font-semibold text-accent-foreground">
            {player.projectedPoints.toFixed(1)} pts
          </div>
        </div>
        
        <div className="flex items-start gap-3">
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
          
          {/* Player Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight">
              {player.name}
            </h3>
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
              <p className="text-xs text-muted-foreground truncate">
                {player.team}
              </p>
            </div>
          </div>
        </div>
        
        {!available && (
          <div className="mt-2 text-xs text-destructive font-medium">
            Max uses reached
          </div>
        )}
      </CardContent>
    </Card>
  );
}