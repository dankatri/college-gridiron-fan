import { Player } from '@/lib/types';
import { User } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface PlayerAvatarProps {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PlayerAvatar({ player, size = 'md', className }: PlayerAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10', 
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20
  };

  return (
    <div className={cn(
      'relative rounded-full overflow-hidden bg-muted flex-shrink-0',
      sizeClasses[size],
      className
    )}>
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
      <div className={cn(
        'absolute inset-0 flex items-center justify-center',
        player.headshotUrl ? 'hidden' : ''
      )}>
        <User size={iconSizes[size]} className="text-muted-foreground" />
      </div>
    </div>
  );
}