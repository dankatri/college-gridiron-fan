import { useState } from 'react';
import { Shield } from '@phosphor-icons/react';
import { Player } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TeamLogoProps {
  player: Pick<Player, 'team' | 'teamLogoUrl'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showFallback?: boolean;
}

export function TeamLogo({ player, size = 'md', className, showFallback = false }: TeamLogoProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const logoUrl = player.teamLogoUrl;
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  if (!logoUrl || failedUrl === logoUrl) {
    return showFallback ? (
      <span
        role="img"
        aria-label={`${player.team} logo unavailable`}
        title={`${player.team} logo unavailable`}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded bg-muted text-muted-foreground',
          sizeClasses[size],
          className,
        )}
      >
        <Shield aria-hidden="true" className="h-3/4 w-3/4" />
      </span>
    ) : null;
  }

  return (
    <img 
      src={logoUrl}
      alt={`${player.team} logo`}
      title={player.team}
      className={cn(
        'shrink-0 object-contain',
        sizeClasses[size],
        className
      )}
      onError={() => setFailedUrl(logoUrl)}
    />
  );
}