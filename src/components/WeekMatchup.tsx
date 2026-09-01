import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarX } from '@phosphor-icons/react';
import type { WeeklyGame } from '@/lib/types';
import type { TeamWeekMatchup } from '@/hooks/use-week-matchups';

interface WeekMatchupProps {
  teamName: string;
  week?: number;
  matchup?: TeamWeekMatchup;
  isLoading?: boolean;
  className?: string;
}

function formatKickoff(game: WeeklyGame): string | null {
  if (!game.gameDate) return null;

  const day = game.gameDate.toLocaleDateString(undefined, { weekday: 'short' });
  if (game.gameTime === 'TBD') return `${day} · TBD`;

  const time = game.gameDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** A team's game for a single week: "vs Opponent", "@ Opponent", or BYE. */
export function WeekMatchup({ teamName, week, matchup, isLoading = false, className }: WeekMatchupProps) {
  if (isLoading) {
    return <span className={`text-xs text-muted-foreground ${className ?? ''}`}>…</span>;
  }

  const game = matchup?.game;
  const nextGame = matchup?.nextGame;

  if (!game) {
    if (!nextGame) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`text-xs text-muted-foreground ${className ?? ''}`}>—</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>No game scheduled for {teamName}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    const nextKickoff = formatKickoff(nextGame);

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`inline-flex max-w-[10rem] items-baseline gap-1 text-xs text-muted-foreground ${className ?? ''}`}
            >
              <span className="font-medium">W{nextGame.week}</span>
              <span>{nextGame.isHomeGame ? 'vs' : '@'}</span>
              <span className="truncate">{nextGame.opponent ?? 'TBD'}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {teamName} {week === undefined ? 'has no game this week' : `does not play in Week ${week}`} · Next: Week{' '}
              {nextGame.week} {nextGame.isHomeGame ? 'vs' : 'at'} {nextGame.opponent ?? 'TBD'}
              {nextKickoff ? ` · ${nextKickoff}` : ''}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (game.isByeWeek) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className={`flex items-center gap-1 text-xs ${className ?? ''}`}>
              <CalendarX size={12} />
              BYE
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{teamName} is on a bye this week</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const prefix = game.isHomeGame ? 'vs' : '@';
  const opponent = game.opponent ?? 'TBD';
  const kickoff = formatKickoff(game);

  if (game.isCompleted && game.teamPoints !== undefined && game.opponentPoints !== undefined) {
    const won = game.teamPoints > game.opponentPoints;
    const tied = game.teamPoints === game.opponentPoints;
    const result = tied ? 'T' : won ? 'W' : 'L';

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex max-w-[10rem] items-baseline gap-1 text-xs ${className ?? ''}`}>
              <span className={`font-semibold ${won ? 'text-accent' : tied ? '' : 'text-muted-foreground'}`}>
                {result} {game.teamPoints}-{game.opponentPoints}
              </span>
              <span className="truncate text-muted-foreground">
                {prefix} {opponent}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Final: {teamName} {game.teamPoints} - {game.opponentPoints} {opponent}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex max-w-[9rem] items-baseline gap-1 text-xs ${className ?? ''}`}>
            <span className="text-muted-foreground">{prefix}</span>
            <span className="truncate font-medium">{opponent}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {teamName} {game.isHomeGame ? 'hosts' : 'travels to'} {opponent}
            {kickoff ? ` · ${kickoff}` : ''}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
