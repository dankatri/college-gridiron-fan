import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { Player, PlayerUsage } from '@/lib/types';
import { getConferences, getTeams, getPlayers } from '@/lib/data';
import { isPlayerAvailable, isPlayerInLineup } from '@/lib/utils-fantasy';
import { MAX_PLAYER_USES } from '@/lib/types';
import { describeWeekPoints, resolveWeekPoints, weekStatValue } from '@/lib/week-actuals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineupSlot } from '@/lib/types';
import { ByeWeekIndicator } from '@/components/ByeWeekIndicator';
import { WeekMatchup } from '@/components/WeekMatchup';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import { useWeekMatchups } from '@/hooks/use-week-matchups';
import { useWeekActuals } from '@/hooks/use-week-actuals';
import {
  Users,
  Funnel as Filter,
  Trophy,
  ArrowClockwise as RefreshCw,
  User,
  CaretUp,
  CaretDown,
  CaretUpDown,
} from '@phosphor-icons/react';

type SortKey = 'projectedPoints' | keyof Player;
type SortDirection = 'asc' | 'desc';

interface PlayerTableProps {
  position: 'QB' | 'RB' | 'WR';
  players: Player[];
  playerUsage: PlayerUsage[];
  currentLineup: LineupSlot[];
  currentWeek?: number;
  onPlayerSelect: (player: Player) => void;
  onPlayersUpdate?: (players: Player[]) => void; // New callback to update parent's player list
  isLocked?: boolean;
}

export function PlayerTable({ 
  position, 
  players, 
  playerUsage, 
  currentLineup, 
  currentWeek,
  onPlayerSelect,
  onPlayersUpdate,
  isLocked = false
}: PlayerTableProps) {
  const pageSizeOptions = ['10', '15', '20', '25'] as const;
  const [conferenceFilter, setConferenceFilter] = useState('All Conferences');
  const [teamFilter, setTeamFilter] = useState('All Teams');
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [conferences, setConferences] = useState<string[]>(['All Conferences']);
  const [teams, setTeams] = useState<string[]>(['All Teams']);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [enhancedPlayers, setEnhancedPlayers] = useState<Player[]>(players);
  const [sortKey, setSortKey] = useState<SortKey>('projectedPoints');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const isUnfiltered = conferenceFilter === 'All Conferences' && teamFilter === 'All Teams';
  const { matchups, isLoading: isLoadingMatchups } = useWeekMatchups(currentWeek);
  const { actuals, hasStarted, isLoading: isLoadingActuals } = useWeekActuals(currentWeek);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);

  // Once a week has kicked off its real scores are more useful than the
  // preseason projection, so the points and stat columns switch over to them.
  const showActuals = hasStarted && !isLoadingActuals;

  const weekPointsFor = (player: Player) =>
    resolveWeekPoints(player, actuals.get(player.id), matchups.get(player.team.toLowerCase())?.game);

  // Immediately set initial conference data from players if available
  useEffect(() => {
    if (players.length > 0 && conferences.length <= 1) {
      const playerConferences = Array.from(new Set(
        players.map(p => p.conference).filter(conf => conf)
      )).sort();
      
      const playerTeams = Array.from(new Set(
        players.map(p => p.team).filter(team => team)
      )).sort();
      
      if (playerConferences.length > 0) {
        setConferences(['All Conferences', ...playerConferences]);
      }
      
      if (playerTeams.length > 0) {
        setTeams(['All Teams', ...playerTeams]);
      }
      
      console.log('PlayerTable: Set initial filter data from players:', {
        conferences: playerConferences.length,
        teams: playerTeams.length
      });
    }
  }, [players, conferences.length]);

  // Load filter options
  useEffect(() => {
    const loadFilters = async () => {
      console.log('PlayerTable: Starting to load filters...');
      try {
        const [confs, tms] = await Promise.all([
          getConferences(),
          getTeams()
        ]);
        
        console.log('PlayerTable: Loaded conferences:', confs);
        console.log('PlayerTable: Loaded teams:', tms);
        
        // Ensure we always have at least the default values
        if (confs.length === 0) {
          console.warn('PlayerTable: No conferences loaded, using defaults');
          setConferences(['All Conferences']);
        } else {
          setConferences(confs);
        }
        
        if (tms.length === 0) {
          console.warn('PlayerTable: No teams loaded, using defaults');
          setTeams(['All Teams']);
        } else {
          setTeams(tms);
        }
      } catch (error) {
        console.error('PlayerTable: Failed to load filter options:', error);
        
        // Fallback: extract conferences and teams from current players data
        if (players.length > 0) {
          const playerConferences = Array.from(new Set(
            players.map(p => p.conference).filter(conf => conf)
          )).sort();
          
          const playerTeams = Array.from(new Set(
            players.map(p => p.team).filter(team => team)
          )).sort();
          
          setConferences(['All Conferences', ...playerConferences]);
          setTeams(['All Teams', ...playerTeams]);
          
          console.log('PlayerTable: Using fallback data - conferences:', playerConferences);
          console.log('PlayerTable: Using fallback data - teams:', playerTeams);
        } else {
          // Ultimate fallback
          setConferences(['All Conferences']);
          setTeams(['All Teams']);
        }
      } finally {
        setIsLoadingFilters(false);
      }
    };
    
    loadFilters();
  }, [players]);

  // Show the full pool whenever nothing is narrowing it, including after a
  // refresh. While a filter is applied the filtered result below owns the list.
  useEffect(() => {
    if (isUnfiltered) {
      setEnhancedPlayers(players);
    }
  }, [players, isUnfiltered]);

  // Load the narrower set of players a filter asks for. This deliberately does
  // not depend on `players`: the fetched players are merged into the parent
  // pool, and re-running on that would refetch the same filter forever.
  useEffect(() => {
    if (isUnfiltered) return;

    let cancelled = false;

    const loadFilteredPlayers = async () => {
      setIsLoadingPlayers(true);
      try {
        const filterOptions: { specificTeam?: string; specificConference?: string } = {};

        if (teamFilter !== 'All Teams') {
          filterOptions.specificTeam = teamFilter;
        }

        if (conferenceFilter !== 'All Conferences') {
          filterOptions.specificConference = conferenceFilter;
        }

        const newPlayers = await getPlayers(filterOptions);
        if (cancelled) return;

        if (newPlayers.length > 0) {
          setEnhancedPlayers(newPlayers);

          // Let the parent widen its pool so selected players stay resolvable.
          onPlayersUpdate?.(newPlayers);
        } else {
          console.warn('No players found for filter, keeping existing players');
        }
      } catch (error) {
        console.error('Failed to load filtered players:', error);
      } finally {
        if (!cancelled) setIsLoadingPlayers(false);
      }
    };

    loadFilteredPlayers();

    return () => {
      cancelled = true;
    };
  }, [conferenceFilter, teamFilter, isUnfiltered, onPlayersUpdate]);

  // Get teams filtered by conference for dropdown
  const filteredTeams = useMemo(() => {
    if (conferenceFilter === 'All Conferences') {
      return teams;
    }
    
    // Get teams from players that match the selected conference
    const teamsInConference = Array.from(new Set(
      enhancedPlayers
        .filter(p => p.conference === conferenceFilter)
        .map(p => p.team)
        .filter(team => team) // Remove empty/undefined team names
    )).sort();
    
    console.log(`Teams in ${conferenceFilter}:`, teamsInConference);
    
    // Always include "All Teams" as first option
    const result = ['All Teams', ...teamsInConference];
    
    // If no teams found for this conference, log a warning but still return the structure
    if (teamsInConference.length === 0) {
      console.warn(`No teams found for conference: ${conferenceFilter}`);
    }
    
    return result;
  }, [enhancedPlayers, conferenceFilter, teams]);

  // Filter players based on position and filters
  const filteredPlayers = useMemo(() => {
    let filtered = enhancedPlayers.filter(p => p.position === position);
    
    if (conferenceFilter !== 'All Conferences') {
      filtered = filtered.filter(p => p.conference === conferenceFilter);
    }
    
    if (teamFilter !== 'All Teams') {
      filtered = filtered.filter(p => p.team === teamFilter);
    }

    // Missing stats sort last in both directions rather than counting as zero.
    const direction = sortDirection === 'asc' ? 1 : -1;

    // Sort on whatever the column is actually showing, so a week of real
    // scores does not get ordered by last season's totals.
    const sortValue = (player: Player): number | undefined => {
      if (!showActuals) {
        const value = player[sortKey as keyof Player];
        return typeof value === 'number' ? value : undefined;
      }
      if (sortKey === 'projectedPoints') return weekPointsFor(player).points;
      return weekStatValue(actuals.get(player.id), String(sortKey));
    };

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
  }, [enhancedPlayers, position, conferenceFilter, teamFilter, sortKey, sortDirection, showActuals, actuals, matchups]);

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
  }, [conferenceFilter, teamFilter, position, pageSize, sortKey, sortDirection, showActuals]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Get relevant stats columns based on position
  const getStatsColumns = (position: 'QB' | 'RB' | 'WR') => {
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

  const getUsageCount = (playerId: string) => {
    const usage = playerUsage.find(u => u.playerId === playerId);
    return usage?.timesUsed || 0;
  };

  const getPlayerStatus = (player: Player) => {
    const isAvailable = isPlayerAvailable(player.id, playerUsage, MAX_PLAYER_USES);
    const inLineup = isPlayerInLineup(player.id, currentLineup);
    const usageCount = getUsageCount(player.id);

    if (inLineup) return { status: 'in-lineup', label: 'In Lineup', variant: 'secondary' as const };
    if (!isAvailable) return { status: 'maxed', label: 'Max Uses', variant: 'destructive' as const };
    if (usageCount > 0) return { status: 'used', label: `Used ${usageCount}x`, variant: 'outline' as const };
    return { status: 'available', label: 'Available', variant: 'default' as const };
  };

  const weekName = currentWeek === undefined ? 'this week' : `Week ${currentWeek}`;

  const weekPointsDisplay = (player: Player) =>
    describeWeekPoints(player, {
      showActuals,
      stats: actuals.get(player.id),
      game: matchups.get(player.team.toLowerCase())?.game,
      weekName,
    });

  const getPlayerCountDisplay = () => {    const baseCount = `${filteredPlayers.length}`;
    const isFiltered = conferenceFilter !== 'All Conferences' || teamFilter !== 'All Teams';
    
    if (isLoadingPlayers && isFiltered) {
      return `${baseCount} (loading more...)`;
    }
    
    return baseCount;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users size={20} />
          {positionName} ({getPlayerCountDisplay()})
          {showActuals && (
            <Badge variant="secondary" className="text-xs font-normal">
              {weekName} actuals
            </Badge>
          )}
        </CardTitle>
        
        {/* Filters */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={16} className="text-muted-foreground" />
            <Select 
              value={conferenceFilter} 
              onValueChange={setConferenceFilter} 
              disabled={isLoadingFilters && conferences.length <= 1}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder={isLoadingFilters && conferences.length <= 1 ? "Loading..." : "All Conferences"} />
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
              disabled={isLoadingFilters && filteredTeams.length <= 1}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder={isLoadingFilters && filteredTeams.length <= 1 ? "Loading..." : "All Teams"} />
              </SelectTrigger>
              <SelectContent>
                {filteredTeams.map(team => (
                  <SelectItem key={team} value={team}>{team}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {(isLoadingPlayers || (isLoadingFilters && conferences.length <= 1)) && (
              <RefreshCw size={16} className="animate-spin text-muted-foreground" />
            )}

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
        <div className="space-y-2 md:hidden">
          {paginatedPlayers.map((player) => {
            const playerStatus = getPlayerStatus(player);
            const canSelect = !isLocked && (playerStatus.status === 'available' || playerStatus.status === 'used');
            const points = weekPointsDisplay(player);

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
                  <span>{player.team}</span>
                  <span>•</span>
                  <span>{player.conference}</span>
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
              </div>
            );
          })}
        </div>

        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[320px]">Player</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Conf</TableHead>
                <TableHead className="text-center">Schedule</TableHead>
                {renderSortableHeader(
                  'projectedPoints',
                  <span className="flex items-center gap-1">
                    <Trophy size={14} />
                    {showActuals ? 'Pts' : 'Proj'}
                  </span>,
                )}
                {statsColumns.map(col => renderSortableHeader(col.key as SortKey, col.label))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPlayers.map((player) => {
                const playerStatus = getPlayerStatus(player);
                const canSelect = !isLocked && (playerStatus.status === 'available' || playerStatus.status === 'used');
                const points = weekPointsDisplay(player);
                const weekStats = actuals.get(player.id);

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
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {player.teamLogoUrl && (
                          <img
                            src={player.teamLogoUrl}
                            alt={`${player.team} logo`}
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        )}
                        <span className="truncate">{player.team}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{player.conference}</TableCell>
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
                          showActuals
                            ? weekStatValue(weekStats, col.key)
                            : ((player as any)[col.key] as number | undefined),
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
        
        {totalPlayers === 0 && !isLoadingPlayers && (
          <div className="text-center py-8 text-muted-foreground">
            No players found matching your filters.
          </div>
        )}
        
        {isLoadingPlayers && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <RefreshCw size={20} className="animate-spin" />
              Loading more players...
            </div>
          </div>
        )}

        <PlayerDetailDialog
          player={detailPlayer}
          open={detailPlayer !== null}
          onOpenChange={(open) => {
            if (!open) setDetailPlayer(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
