import { useState, useMemo, useEffect } from 'react';
import { Player, PlayerUsage } from '@/lib/types';
import { getConferences, getTeams, getPlayers } from '@/lib/data';
import { isPlayerAvailable, isPlayerInLineup } from '@/lib/utils-fantasy';
import { MAX_PLAYER_USES } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineupSlot } from '@/lib/types';
import { ByeWeekIndicator } from '@/components/ByeWeekIndicator';
import { Users, Funnel as Filter, Trophy, ArrowClockwise as RefreshCw, User } from '@phosphor-icons/react';

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
  const [conferenceFilter, setConferenceFilter] = useState('All Conferences');
  const [teamFilter, setTeamFilter] = useState('All Teams');
  const [conferences, setConferences] = useState<string[]>(['All Conferences']);
  const [teams, setTeams] = useState<string[]>(['All Teams']);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [enhancedPlayers, setEnhancedPlayers] = useState<Player[]>(players);

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

  // Update enhanced players when base players change
  useEffect(() => {
    setEnhancedPlayers(players);
  }, [players]);

  // Load additional players when filters change
  useEffect(() => {
    const loadFilteredPlayers = async () => {
      // Only load more players if a specific filter is applied
      if (conferenceFilter === 'All Conferences' && teamFilter === 'All Teams') {
        setEnhancedPlayers(players);
        return;
      }

      setIsLoadingPlayers(true);
      try {
        const filterOptions: { specificTeam?: string; specificConference?: string } = {};
        
        if (teamFilter !== 'All Teams') {
          filterOptions.specificTeam = teamFilter;
        }
        
        if (conferenceFilter !== 'All Conferences') {
          filterOptions.specificConference = conferenceFilter;
        }

        console.log('Loading filtered players with options:', filterOptions);
        const newPlayers = await getPlayers(filterOptions);
        
        // Ensure we have a good mix of players for the filtered view
        if (newPlayers.length > 0) {
          setEnhancedPlayers(newPlayers);
          
          // Optionally notify parent component about the new players
          if (onPlayersUpdate) {
            onPlayersUpdate(newPlayers);
          }
          
          console.log(`Loaded ${newPlayers.length} players for filtered view`);
        } else {
          console.warn('No players found for filter, keeping existing players');
          // Keep existing players rather than showing empty results
          setEnhancedPlayers(players);
        }
        
      } catch (error) {
        console.error('Failed to load filtered players:', error);
        // Fall back to original players
        setEnhancedPlayers(players);
      } finally {
        setIsLoadingPlayers(false);
      }
    };

    loadFilteredPlayers();
  }, [conferenceFilter, teamFilter, players, onPlayersUpdate]);

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
    
    // Sort by projected points descending
    return filtered.sort((a, b) => b.projectedPoints - a.projectedPoints);
  }, [enhancedPlayers, position, conferenceFilter, teamFilter]);

  // Reset team filter when conference changes
  useEffect(() => {
    if (conferenceFilter !== 'All Conferences') {
      setTeamFilter('All Teams');
    }
  }, [conferenceFilter]);

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

  const getPlayerCountDisplay = () => {
    const baseCount = `${filteredPlayers.length}`;
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
        </CardTitle>
        
        {/* Filters */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-muted-foreground" />
            <Select 
              value={conferenceFilter} 
              onValueChange={setConferenceFilter} 
              disabled={isLoadingFilters && conferences.length <= 1}
            >
              <SelectTrigger className="w-[160px]">
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
              <SelectTrigger className="w-[140px]">
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px]">Player</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Conf</TableHead>
                <TableHead className="text-center">Schedule</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Trophy size={14} />
                    Proj
                  </div>
                </TableHead>
                {statsColumns.map(col => (
                  <TableHead key={col.key} className="text-center">{col.label}</TableHead>
                ))}
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player) => {
                const playerStatus = getPlayerStatus(player);
                const canSelect = !isLocked && (playerStatus.status === 'available' || playerStatus.status === 'used');
                
                return (
                  <TableRow 
                    key={player.id}
                    className={playerStatus.status === 'in-lineup' ? 'bg-secondary/20' : ''}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
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
                            <User size={20} className="text-muted-foreground" />
                          </div>
                        </div>
                        
                        {/* Player Info */}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate">{player.name}</div>
                          <div className="text-xs text-muted-foreground">{player.position}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {/* Team Logo */}
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
                      <ByeWeekIndicator player={player} currentWeek={currentWeek} />
                    </TableCell>
                    <TableCell className="text-center font-medium">{player.projectedPoints}</TableCell>
                    {statsColumns.map(col => (
                      <TableCell key={col.key} className="text-center">
                        {col.format((player as any)[col.key])}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Badge variant={playerStatus.variant} className="text-xs">
                        {playerStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={canSelect ? "default" : "secondary"}
                        disabled={!canSelect}
                        onClick={() => onPlayerSelect(player)}
                        className="h-8 px-3"
                      >
                        {playerStatus.status === 'in-lineup' ? 'Added' : 'Add'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        {filteredPlayers.length === 0 && !isLoadingPlayers && (
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
      </CardContent>
    </Card>
  );
}