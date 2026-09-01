import { useEffect, useState } from 'react';
import { Player, PlayerStats } from '@/lib/types';
import { WEEK_LABELS } from '@/lib/season-config';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    setIsLoading(true);
    setError(null);
    setGames([]);
    setTotals(null);

    fetch(`/api/player-log?playerId=${encodeURIComponent(player.id)}`)
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
    };
  }, [open, player]);

  if (!player) return null;

  const gameColumns = GAME_COLUMNS[player.position];
  const seasonStats = SEASON_STATS[player.position].filter(
    (stat) => typeof player[stat.key] === 'number' && (player[stat.key] as number) !== 0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
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

            <div className="min-w-0">
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

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Projected</div>
            <div className="text-xl font-bold">{player.projectedPoints.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">points per game</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Season points</div>
            <div className="flex items-center gap-1 text-xl font-bold">
              <Trophy size={16} className="text-accent" />
              {totals ? totals.fantasyPoints.toFixed(1) : '—'}
            </div>
            <div className="text-xs text-muted-foreground">scored so far</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Games</div>
            <div className="text-xl font-bold">{totals?.games ?? 0}</div>
            <div className="text-xs text-muted-foreground">with recorded stats</div>
          </div>
        </div>

        <Separator />

        <div>
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
            <ScrollArea className="max-h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Week</TableHead>
                    <TableHead>Opponent</TableHead>
                    <TableHead className="text-center">Result</TableHead>
                    {gameColumns.map((column) => (
                      <TableHead key={String(column.key)} className="text-center">
                        {column.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Pts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.map((game) => {
                    const result = resultFor(game);
                    return (
                      <TableRow key={game.week}>
                        <TableCell className="font-medium">{WEEK_LABELS[game.week] ?? `Week ${game.week}`}</TableCell>
                        <TableCell className="text-sm">
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
                        {gameColumns.map((column) => (
                          <TableCell key={String(column.key)} className="text-center tabular-nums">
                            {(game[column.key] as number) || 0}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-semibold tabular-nums">
                          {(game.fantasyPoints ?? 0).toFixed(1)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>

        {seasonStats.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="mb-2 text-sm font-semibold">Season totals used for projection</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                {seasonStats.map((stat) => (
                  <div key={String(stat.key)} className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">{stat.label}</span>
                    <span className="font-medium tabular-nums">
                      {(player[stat.key] as number).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
