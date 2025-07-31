import { Player } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TeamLogoProps {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TeamLogo({ player, size = 'md', className }: TeamLogoProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  if (!player.teamLogoUrl) {
    return null;
  }

  return (
    <img 
      src={player.teamLogoUrl} 
      alt={`${player.team} logo`}
      className={cn(
        'object-contain',
        sizeClasses[size],
        className
      )}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
      }}
    />
  );
}