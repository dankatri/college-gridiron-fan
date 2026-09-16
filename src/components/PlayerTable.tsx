import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { Player, PlayerUsage } from '@/lib/types';
import { MAX_PLAYER_USES } from '@/lib/types';
import { seasonStatValue, type SeasonStatKey } from '@/lib/season-stats';
import { seasonStatsResource } from '@/lib/season-stats-data';
import { SEASON_YEAR } from '@/lib/season-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineupSlot } from '@/lib/types';
import { ByeWeekIndicator } from '@/components/ByeWeekIndicator';
import { WeekMatchup } from '@/components/WeekMatchup';
import { TeamLogo } from '@/components/TeamLogo';
import { optionalFeature } from '@/components/optional-feature';
import { useWeekMatchups } from '@/hooks/use-week-matchups';
import { useSeasonStats } from '@/hooks/use-season-stats';
import {
  Users,
  Funnel as Filter,
  Trophy,
  User,
  CaretUp,
  CaretDown,
  CaretUpDown,
  MagnifyingGlass,
  X,
} from '@phosphor-icons/react';

type SortKey = SeasonStatKey;
type SortDirection = 'asc' | 'desc';
const PlayerDetailDialog = optionalFeature('Player Details', () => import('./PlayerDetailDialog').then(module => ({ default: module.PlayerDetailDialog })));

/**
 * A name reduced for searching: its words concatenated, plus where each word
 * begins.
 *
 * Names in the pool carry punctuation, initials and suffixes — "L.J. Phillips
 * Jr.", "Ja'Marr Chase", "Alonza Barnett III" — so comparing raw strings makes
 * exactly those players reachable only by typing the punctuation exactly.
 * Dropping the separators lets any spelling of them match; keeping the offsets
 * is what stops a query running across the join between two words, which would
 * otherwise let "hardy" match "Ric|hard Y|oung".
 */
function nameIndex(value: string): { compact: string; wordStarts: Set<number> } {
  const words = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const wordStarts = new Set<number>();
  let offset = 0;
  for (const word of words) {
    wordStarts.add(offset);
    offset += word.length;
  }

  return { compact: words.join(''), wordStarts };
}

/** Whether a search matches a name, anchored to the start of any of its words. */
function nameMatches(index: { compact: string; wordStarts: Set<number> }, query: string): boolean {
  if (!query) return true;

  for (let at = index.compact.indexOf(query); at !== -1; at = index.compact.indexOf(query, at + 1)) {
    if (index.wordStarts.has(at)) return true;
  }

  return false;
}

interface PlayerTableProps {
  position: 'QB' | 'RB' | 'WR';
  players: Player[];
  playerUsage: PlayerUsage[];
  currentLineup: LineupSlot[];
  currentWeek?: number;
  onPlayerSelect: (player: Player) => void;
  /** The whole week is over; nothing can be selected. */
  isLocked?: boolean;
  /** Lower-cased teams whose game has kicked off, so their players are frozen. */
  lockedTeams?: Set<string>;
  /** Those of `lockedTeams` whose game is over, which reads differently. */
  finishedTeams?: Set<string>;
}

export function PlayerTable({ 
  position, 
  players, 
  playerUsage, 
  currentLineup, 
  currentWeek,
  onPlayerSelect,
  isLocked = false,
  lockedTeams,
  finishedTeams
}: PlayerTableProps) {
  const pageSizeOptions = ['10', '15', '20', '25'] as const;
  const [conferenceFilter, setConferenceFilter] = useState('All Conferences');
  const showConference = conferenceFilter === 'All Conferences';
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('All Teams');
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState(1);
  const conferences = useMemo(() => ['All Conferences', ...new Set(players.map(p => p.conference).filter(Boolean))].sort((a, b) => a === 'All Conferences' ? -1 : b === 'All Conferences' ? 1 : a.localeCompare(b)), [players]);
  const teams = useMemo(() => ['All Teams', ...Array.from(new Set(players.map(p => p.team))).sort()], [players]);
  const names = useMemo(() => new Map(players.map(player => [player.id, nameIndex(player.name)])), [players]);
  const usageById = useMemo(() => new Map(playerUsage.map(usage => [usage.playerId, usage.timesUsed])), [playerUsage]);
  const selectedIds = useMemo(() => new Set(currentLineup.map(slot => slot.playerId ?? slot.player?.id)), [currentLineup]);
  const [sortKey, setSortKey] = useState<SortKey>('fantasyPoints');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { matchups, isLoading: isLoadingMatchups } = useWeekMatchups(currentWeek);
  const season = useSeasonStats();
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);

  // Get teams filtered by conference for dropdown
  const filteredTeams = useMemo(() => {
    if (conferenceFilter === 'All Conferences') {
      return teams;
    }
    
    // Get teams from players that match the selected conference
    const teamsInConference = Array.from(new Set(
      players
        .filter(p => p.conference === conferenceFilter)
        .map(p => p.team)
        .filter(team => team) // Remove empty/undefined team names
    )).sort();
    
    // Always include "All Teams" as first option
    const result = ['All Teams', ...teamsInConference];
    
    return result;
  }, [players, conferenceFilter, teams]);

  // Filter players based on position and filters
  const filteredPlayers = useMemo(() => {
    let filtered = players.filter(p => p.position === position);
    
    if (conferenceFilter !== 'All Conferences') {
      filtered = filtered.filter(p => p.conference === conferenceFilter);
    }
    
    if (teamFilter !== 'All Teams') {
      filtered = filtered.filter(p => p.team === teamFilter);
    }

    // Search matches anywhere in the name rather than parsing out a surname:
    // hundreds of players carry suffixes ("Demond Williams Jr."), so treating
    // the last word as the surname would miss exactly those. Deliberately kept
    // local to this memo — routing it through the filter refetch above would
    // request the whole pool again on every keystroke.
    const query = nameIndex(searchTerm).compact;
    if (query) {
      filtered = filtered.filter(p => nameMatches(names.get(p.id)!, query));
    }

    // Missing stats sort last in both directions rather than counting as zero.
    const direction = sortDirection === 'asc' ? 1 : -1;

    const sortValue = (player: Player) =>
      seasonStatValue(season.actuals.get(player.id), sortKey, season.complete);

    return [...filtered].sort((a, b) => {
      const aValue = sortValue(a);
      const bValue = sortValue(b);

      const aMissing = typeof aValue !== 'number' || Number.isNaN(aValue);
      const bMissing = typeof bValue !== 'number' || Number.isNaN(bValue);
      if (aMissing && bMissing) return a.name.localeCompare(b.name);
      if (aMissing) return 1;
      if (bMissing) return -1;

      if (aValue === bValue) return a.name.localeCompare(b.name);
      return (aValue - bValue) * direction;
    });
  }, [players, names, position, conferenceFilter, teamFilter, searchTerm, sortKey, sortDirection, season.actuals, season.complete]);

  const totalPlayers = filteredPlayers.length;
  const totalPages = Math.max(1, Math.ceil(totalPlayers / pageSize));
  const paginatedPlayers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPlayers.slice(start, start + pageSize);
  }, [filteredPlayers, currentPage, pageSize]);
  const showingStart = totalPlayers === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingEnd = Math.min(currentPage * pageSize, totalPlayers);

  // Reset team filter when conference changes
  useEffect(() => {
    if (conferenceFilter !== 'All Conferences') {
      setTeamFilter('All Teams');
    }
  }, [conferenceFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [conferenceFilter, teamFilter, searchTerm, position, pageSize, sortKey, sortDirection]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Get relevant stats columns based on position
  const getStatsColumns = (position: 'QB' | 'RB' | 'WR'): Array<{
    key: SeasonStatKey; label: string; format: (value?: number) => string;
  }> => {
    switch (position) {
      case 'QB':
        return [
          { key: 'passingYards', label: 'Pass Yds', format: (val?: number) => val?.toLocaleString() || '-' },
          { key: 'passingTDs', label: 'Pass TDs', format: (val?: number) => val?.toString() || '-' },
          { key: 'completions', label: 'Comp', format: (val?: number) => val?.toString() || '-' },
          { key: 'attempts', label: 'Att', format: (val?: number) => val?.toString() || '-' },
          { key: 'interceptions', label: 'INT', format: (val?: number) => val?.toString() || '-' },
          { key: 'rushingYards', label: 'Rush Yds', format: (val?: number) => val?.toLocaleString() || '-' },
          { key: 'rushingTDs', label: 'Rush TDs', format: (val?: number) => val?.toString() || '-' },
        ];
      case 'RB':
        return [
          { key: 'rushingYards', label: 'Rush Yds', format: (val?: number) => val?.toLocaleString() || '-' },
          { key: 'rushingTDs', label: 'Rush TDs', format: (val?: number) => val?.toString() || '-' },
          { key: 'receivingYards', label: 'Rec Yds', format: (val?: number) => val?.toLocaleString() || '-' },
          { key: 'receptions', label: 'Rec', format: (val?: number) => val?.toString() || '-' },
          { key: 'receivingTDs', label: 'Rec TDs', format: (val?: number) => val?.toString() || '-' },
          { key: 'returnYards', label: 'Ret Yds', format: (val?: number) => val?.toLocaleString() || '-' },
        ];
      case 'WR':
        return [
          { key: 'receivingYards', label: 'Rec Yds', format: (val?: number) => val?.toLocaleString() || '-' },
          { key: 'receptions', label: 'Rec', format: (val?: number) => val?.toString() || '-' },
          { key: 'receivingTDs', label: 'Rec TDs', format: (val?: number) => val?.toString() || '-' },
          { key: 'returnYards', label: 'Ret Yds', format: (val?: number) => val?.toLocaleString() || '-' },
        ];
    }
  };

  const statsColumns = getStatsColumns(position);

  // New column starts on the most useful direction (highest first), then toggles.
  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection(current => (current === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const renderSortableHeader = (key: SortKey, label: ReactNode) => {
    const isActive = sortKey === key;
    const ariaSort = isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';

    return (
      <TableHead key={String(key)} className="text-center" aria-sort={ariaSort}>
        <button
          type="button"
          onClick={() => handleSort(key)}
          className={`mx-auto flex items-center justify-center gap-1 rounded-sm px-1 py-0.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isActive ? 'text-foreground' : 'text-muted-foreground'
          }`}
          title={`Sort by ${typeof label === 'string' ? label : String(key)}`}
        >
          {label}
          {isActive ? (
            sortDirection === 'asc' ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />
          ) : (
            <CaretUpDown size={12} className="opacity-50" />
          )}
        </button>
      </TableHead>
    );
  };

  const positionName = position === 'QB' ? 'Quarterbacks' : position === 'RB' ? 'Running Backs' : 'Wide Receivers';

  const getPlayerStatus = (player: Player) => {
    const usageCount = usageById.get(player.id) ?? 0;
    const isAvailable = usageCount < MAX_PLAYER_USES;
    const inLineup = selectedIds.has(player.id);

    if (inLineup) return { status: 'in-lineup', label: 'In Lineup', variant: 'secondary' as const };
    // A player whose game has begun is settled for the week, whether or not
    // they are in a lineup, so they cannot be picked up now. A game that is
    // over says so, rather than sounding like it is still being played.
    if (lockedTeams?.has(player.team.toLowerCase())) {
      return finishedTeams?.has(player.team.toLowerCase())
        ? { status: 'finished', label: 'Finished', variant: 'outline' as const }
        : { status: 'kicked-off', label: 'Kicked Off', variant: 'outline' as const };
    }
    if (!isAvailable) return { status: 'maxed', label: 'Max Uses', variant: 'destructive' as const };
    if (usageCount > 0) return { status: 'used', label: `Used ${usageCount}x`, variant: 'outline' as const };
    return { status: 'available', label: 'Available', variant: 'default' as const };
  };

  const weekName = currentWeek === undefined ? 'this week' : `Week ${currentWeek}`;

  const seasonPointsDisplay = (player: Player) => {
    const points = seasonStatValue(season.actuals.get(player.id), 'fantasyPoints', season.complete);
    return {
      text: points === undefined ? '?' : points.toFixed(1),
      summary: points === undefined ? 'Season points unavailable' : `Season: ${points.toFixed(1)} pts`,
      muted: points === undefined,
      title: points === undefined
        ? 'Season scoring data is unavailable; this is not a zero score'
        : `Actual points scored so far in ${SEASON_YEAR}`,
    };
  };

  // Compact, position-specific key stats for the mobile card view
  const pluralTD = (count: number) => (count === 1 ? 'TD' : 'TDs');

  const tdYardsSummary = (tds?: number, yds?: number): string | undefined => {
    if (tds === undefined || yds === undefined) return undefined;
    return `${tds} ${pluralTD(tds)} / ${yds.toLocaleString()} yds`;
  };

  const keyStatsDisplay = (player: Player): string | undefined => {
    const stats = season.actuals.get(player.id);
    const value = (key: SeasonStatKey) => seasonStatValue(stats, key, season.complete);

    switch (player.position) {
      case 'QB': {
        const tds = value('passingTDs');
        const yds = value('passingYards');
        const ints = value('interceptions');
        const summary = tdYardsSummary(tds, yds);
        return summary === undefined || ints === undefined ? undefined : `${summary} / ${ints} INT`;
      }
      case 'RB':
        return tdYardsSummary(value('rushingTDs'), value('rushingYards'));
      case 'WR':
        return tdYardsSummary(value('receivingTDs'), value('receivingYards'));
      default:
        return undefined;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users size={20} />
          {positionName} ({filteredPlayers.length})
          <Badge variant="secondary" className="text-xs font-normal">{SEASON_YEAR} actuals</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Recorded {SEASON_YEAR} season totals. Schedule and availability are for {weekName}.
        </p>
        
        {/* Filters */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="relative w-full sm:w-[220px]">
            <MagnifyingGlass
              size={16}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name"
              aria-label={`Search ${positionName} by name`}
              className="pl-8 pr-8"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              >
                <X size={12} />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={16} className="text-muted-foreground" />
            <Select 
              value={conferenceFilter} 
              onValueChange={setConferenceFilter} 
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All Conferences" />
              </SelectTrigger>
              <SelectContent>
                {conferences.map(conf => (
                  <SelectItem key={conf} value={conf}>{conf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={teamFilter} 
              onValueChange={setTeamFilter} 
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                {filteredTeams.map(team => (
                  <SelectItem key={team} value={team}>{team}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Per page" />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Status badges - only show if we have useful data */}
            {conferences.length > 1 && (
              <Badge variant="outline" className="text-xs">
                {conferences.length - 1} conferences
              </Badge>
            )}
            {filteredTeams.length > 1 && conferenceFilter !== 'All Conferences' && (
              <Badge variant="outline" className="text-xs">
                {filteredTeams.length - 1} teams in {conferenceFilter}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {season.error && (
          <div role="alert" className="mb-3 rounded-md border border-destructive p-3 text-sm">
            {season.hasData
              ? 'Showing last available season stats. Totals may be incomplete.'
              : 'Season stats are unavailable. Missing scores are not counted as zero or replaced with projections.'}
            <Button variant="outline" size="sm" className="ml-2" onClick={() => void seasonStatsResource.refresh(true)}>
              Retry season stats
            </Button>
          </div>
        )}
        {season.isLoading && <p role="status" className="mb-3 text-sm text-muted-foreground">Loading season stats...</p>}
        <div className="space-y-2 md:hidden">
          {paginatedPlayers.map((player) => {
            const playerStatus = getPlayerStatus(player);
            const canSelect = !isLocked && (playerStatus.status === 'available' || playerStatus.status === 'used');
            const points = seasonPointsDisplay(player);
            const keyStats = keyStatsDisplay(player);

            return (
              <div
                key={player.id}
                className={`rounded-md border p-3 ${playerStatus.status === 'in-lineup' ? 'bg-secondary/20' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <div className="relative w-9 h-9 rounded-full overflow-hidden bg-muted flex-shrink-0">
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

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setDetailPlayer(player)}
                      className="block max-w-full truncate text-left font-semibold hover:text-primary hover:underline"
                    >
                      {player.name}
                    </button>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {player.position}
                      </Badge>
                      <Badge variant={playerStatus.variant} className="text-[10px] px-1.5 py-0">
                        {playerStatus.label}
                      </Badge>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={canSelect ? "default" : "secondary"}
                    disabled={!canSelect}
                    onClick={() => onPlayerSelect(player)}
                    className="h-7 px-2 text-xs flex-shrink-0"
                  >
                    {playerStatus.status === 'in-lineup' ? 'Added' : 'Add'}
                  </Button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
                  <TeamLogo player={player} size="lg" showFallback />
                  {showConference && (
                    <>
                      <span>•</span>
                      <span>{player.conference}</span>
                    </>
                  )}
                  <span>•</span>
                  <span className={points.muted ? 'italic' : undefined} title={points.title}>
                    {points.summary}
                  </span>
                  <span>•</span>
                  <WeekMatchup
                    teamName={player.team}
                    week={currentWeek}
                    matchup={matchups.get(player.team.toLowerCase())}
                    isLoading={isLoadingMatchups}
                  />
                </div>

                {keyStats && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {keyStats}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[320px]">Player</TableHead>
                <TableHead className="w-16 text-center">Team</TableHead>
                {showConference && <TableHead>Conf</TableHead>}
                <TableHead className="text-center">Schedule</TableHead>
                {renderSortableHeader(
                  'fantasyPoints',
                  <span className="flex items-center gap-1">
                    <Trophy size={14} />
                    Season pts
                  </span>,
                )}
                {statsColumns.map(col => renderSortableHeader(col.key, col.label))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPlayers.map((player) => {
                const playerStatus = getPlayerStatus(player);
                const canSelect = !isLocked && (playerStatus.status === 'available' || playerStatus.status === 'used');
                const points = seasonPointsDisplay(player);
                const seasonStats = season.actuals.get(player.id);

                return (
                  <TableRow
                    key={player.id}
                    className={playerStatus.status === 'in-lineup' ? 'bg-secondary/20' : ''}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
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
                            <User size={20} className="text-muted-foreground" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setDetailPlayer(player)}
                            className="block max-w-full truncate text-left font-semibold hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title={`View ${player.name}'s season stats`}
                          >
                            {player.name}
                          </button>
                          <div className="text-xs text-muted-foreground">{player.position}</div>
                        </div>

                        <Badge variant={playerStatus.variant} className="text-xs flex-shrink-0">
                          {playerStatus.label}
                        </Badge>
                        <Button
                          size="sm"
                          variant={canSelect ? "default" : "secondary"}
                          disabled={!canSelect}
                          onClick={() => onPlayerSelect(player)}
                          className="h-7 px-2 text-xs flex-shrink-0"
                        >
                          {playerStatus.status === 'in-lineup' ? 'Added' : 'Add'}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <TeamLogo player={player} size="lg" className="mx-auto" showFallback />
                    </TableCell>
                    {showConference && (
                      <TableCell className="text-sm text-muted-foreground">{player.conference}</TableCell>
                    )}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <WeekMatchup
                          teamName={player.team}
                          week={currentWeek}
                          matchup={matchups.get(player.team.toLowerCase())}
                          isLoading={isLoadingMatchups}
                        />
                        <ByeWeekIndicator player={player} currentWeek={currentWeek} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      <span className={points.muted ? 'text-muted-foreground' : undefined} title={points.title}>
                        {points.text}
                      </span>
                    </TableCell>
                    {statsColumns.map(col => (
                      <TableCell key={col.key} className="text-center">
                        {col.format(
                          seasonStatValue(seasonStats, col.key, season.complete),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {totalPlayers > 0 && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {showingStart}-{showingEnd} of {totalPlayers}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((previous) => previous - 1)} disabled={currentPage <= 1}>
                Previous
              </Button>
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((previous) => previous + 1)} disabled={currentPage >= totalPages}>
                Next
              </Button>
            </div>
          </div>
        )}
        
        {totalPlayers === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? (
              <>
                <p>No {positionName.toLowerCase()} matching "{searchTerm}".</p>
                {(conferenceFilter !== 'All Conferences' || teamFilter !== 'All Teams') && (
                  <p className="text-xs mt-1">A conference or team filter is also narrowing this list.</p>
                )}
              </>
            ) : (
              'No players found matching your filters.'
            )}
          </div>
        )}
        
        {detailPlayer && <PlayerDetailDialog
          player={detailPlayer}
          open={detailPlayer !== null}
          onOpenChange={(open) => {
            if (!open) setDetailPlayer(null);
          }}
        />}
      </CardContent>
    </Card>
  );
}
