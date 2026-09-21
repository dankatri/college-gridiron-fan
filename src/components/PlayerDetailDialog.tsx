import { useEffect, useState } from 'react';
import { Player, PlayerStats } from '@/lib/types';
import { PROJECTION_YEAR, WEEK_LABELS } from '@/lib/season-config';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User, Trophy } from '@phosphor-icons/react';

type GameLine = PlayerStats & {
  opponent?: string;
  isHomeGame?: boolean;
  teamPoints?: number;
  opponentPoints?: number;
};

type Totals = {
  games: number;
  fantasyPoints: number;
  passingYards: number;
  passingTDs: number;
  completions: number;
  attempts: number;
  interceptions: number;
  rushingYards: number;
  rushingTDs: number;
  receivingYards: number;
  receptions: number;
  receivingTDs: number;
  kickReturnYards: number;
  puntReturnYards: number;
};

interface PlayerDetailDialogProps {
  player: Player | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GAME_COLUMNS: Record<'QB' | 'RB' | 'WR', Array<{ key: keyof PlayerStats; label: string }>> = {
  QB: [
    { key: 'completions', label: 'Comp' },
    { key: 'attempts', label: 'Att' },
    { key: 'passingYards', label: 'Pass Yds' },
    { key: 'passingTDs', label: 'Pass TD' },
    { key: 'interceptions', label: 'INT' },
    { key: 'rushingYards', label: 'Rush Yds' },
    { key: 'rushingTDs', label: 'Rush TD' },
  ],
  RB: [
    { key: 'rushingYards', label: 'Rush Yds' },
    { key: 'rushingTDs', label: 'Rush TD' },
    { key: 'receptions', label: 'Rec' },
    { key: 'receivingYards', label: 'Rec Yds' },
    { key: 'receivingTDs', label: 'Rec TD' },
  ],
  WR: [
    { key: 'receptions', label: 'Rec' },
    { key: 'receivingYards', label: 'Rec Yds' },
    { key: 'receivingTDs', label: 'Rec TD' },
    { key: 'rushingYards', label: 'Rush Yds' },
    { key: 'rushingTDs', label: 'Rush TD' },
  ],
};

const SEASON_STATS: Record<'QB' | 'RB' | 'WR', Array<{ key: keyof Player; label: string }>> = {
  QB: [
    { key: 'passingYards', label: 'Passing yards' },
    { key: 'passingTDs', label: 'Passing TDs' },
    { key: 'completions', label: 'Completions' },
    { key: 'attempts', label: 'Attempts' },
    { key: 'interceptions', label: 'Interceptions' },
    { key: 'rushingYards', label: 'Rushing yards' },
    { key: 'rushingTDs', label: 'Rushing TDs' },
  ],
  RB: [
    { key: 'rushingYards', label: 'Rushing yards' },
    { key: 'rushingTDs', label: 'Rushing TDs' },
    { key: 'receptions', label: 'Receptions' },
    { key: 'receivingYards', label: 'Receiving yards' },
    { key: 'receivingTDs', label: 'Receiving TDs' },
    { key: 'returnYards', label: 'Return yards' },
  ],
  WR: [
    { key: 'receptions', label: 'Receptions' },
    { key: 'receivingYards', label: 'Receiving yards' },
    { key: 'receivingTDs', label: 'Receiving TDs' },
    { key: 'rushingYards', label: 'Rushing yards' },
    { key: 'rushingTDs', label: 'Rushing TDs' },
    { key: 'returnYards', label: 'Return yards' },
  ],
};

function resultFor(game: GameLine): { label: string; won: boolean } | null {
  if (game.teamPoints === undefined || game.opponentPoints === undefined) return null;
  const won = game.teamPoints > game.opponentPoints;
  const tied = game.teamPoints === game.opponentPoints;
  return { label: `${tied ? 'T' : won ? 'W' : 'L'} ${game.teamPoints}-${game.opponentPoints}`, won };
}

export function PlayerDetailDialog({ player, open, onOpenChange }: PlayerDetailDialogProps) {
  const [games, setGames] = useState<GameLine[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !player) return;

    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setGames([]);
    setTotals(null);

    fetch(`/api/player-log?playerId=${encodeURIComponent(player.id)}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Failed to load player log');
        if (cancelled) return;
        setGames(payload.games ?? []);
        setTotals(payload.totals ?? null);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Failed to load player log');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, player]);

  if (!player) return null;

  const gameColumns = GAME_COLUMNS[player.position];
  const seasonStats = SEASON_STATS[player.position].filter(
    (stat) => typeof player[stat.key] === 'number' && (player[stat.key] as number) !== 0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col overflow-hidden p-4 sm:max-w-5xl sm:p-6">
        <DialogHeader className="min-w-0 shrink-0 pr-8">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-muted">
              {player.headshotUrl ? (
                <img
                  src={player.headshotUrl}
                  alt={`${player.name} headshot`}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    const target = event.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`absolute inset-0 flex items-center justify-center ${player.headshotUrl ? 'hidden' : ''}`}>
                <User size={24} className="text-muted-foreground" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-left">{player.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-left">
                <Badge variant="outline">{player.position}</Badge>
                <span>{player.team}</span>
                <span>·</span>
                <span>{player.conference}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div
          role="region"
          aria-label="Player statistics"
          tabIndex={0}
          className="min-h-0 min-w-0 space-y-4 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:gap-3">
            <div className="rounded-md border p-2 sm:p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Season points</div>
              <div className="flex flex-wrap items-center gap-1 text-xl font-bold">
                <Trophy size={16} className="shrink-0 text-accent" />
                {totals ? totals.fantasyPoints.toFixed(1) : '—'}
              </div>
              <div className="text-xs text-muted-foreground">scored so far</div>
            </div>
            <div className="rounded-md border p-2 sm:p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Games</div>
              <div className="text-xl font-bold">{totals?.games ?? 0}</div>
              <div className="text-xs text-muted-foreground">with recorded stats</div>
            </div>
          </div>

          <Separator />

          <div className="min-w-0">
            <h4 className="mb-2 text-sm font-semibold">Game log</h4>
            {isLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Loading game log…</p>
            ) : error ? (
              <p className="py-4 text-center text-sm text-destructive">{error}</p>
            ) : games.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No games with recorded stats yet this season.
              </p>
            ) : (
              <Table
                aria-label="Game log"
                containerProps={{
                  role: 'region',
                  'aria-label': 'Game log',
                  tabIndex: 0,
                  className: 'max-h-[min(16rem,50dvh)] rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                }}
              >
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-16">Week</TableHead>
                    <TableHead className="w-48">Opponent</TableHead>
                    <TableHead className="text-center">Result</TableHead>
                    <TableHead className="text-center">Pts</TableHead>
                    {gameColumns.map((column) => (
                      <TableHead key={String(column.key)} className="text-center">
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.map((game) => {
                    const result = resultFor(game);
                    return (
                      <TableRow key={game.week}>
                        <TableCell className="whitespace-normal font-medium">{WEEK_LABELS[game.week] ?? `Week ${game.week}`}</TableCell>
                        <TableCell className="whitespace-normal text-sm">
                          {game.opponent ? `${game.isHomeGame ? 'vs' : '@'} ${game.opponent}` : '—'}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {result ? (
                            <span className={result.won ? 'font-semibold text-accent' : 'text-muted-foreground'}>
                              {result.label}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-center font-semibold tabular-nums">
                          {(game.fantasyPoints ?? 0).toFixed(1)}
                        </TableCell>
                        {gameColumns.map((column) => (
                          <TableCell key={String(column.key)} className="text-center tabular-nums">
                            {(game[column.key] as number) || 0}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {seasonStats.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="mb-2 text-sm font-semibold">{PROJECTION_YEAR} season totals</h4>
                <div className="grid grid-cols-1 gap-x-6 gap-y-1 min-[360px]:grid-cols-2 sm:grid-cols-3">
                  {seasonStats.map((stat) => (
                    <div key={String(stat.key)} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{stat.label}</span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {(player[stat.key] as number).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
