import { useState, useMemo } from 'react';
import { Player, PlayerUsage } from '@/lib/types';
import { CONFERENCES, TEAMS } from '@/lib/data';
import { isPlayerAvailable, isPlayerInLineup } from '@/lib/utils-fantasy';
import { MAX_PLAYER_USES } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineupSlot } from '@/lib/types';
import { Users, Filter, Trophy } from '@phosphor-icons/react';

interface PlayerTableProps {
  position: 'QB' | 'RB' | 'WR';
  players: Player[];
  playerUsage: PlayerUsage[];
  currentLineup: LineupSlot[];
  onPlayerSelect: (player: Player) => void;
}

export function PlayerTable({ position, players, playerUsage, currentLineup, onPlayerSelect }: PlayerTableProps) {
  const [conferenceFilter, setConferenceFilter] = useState('All Conferences');
  const [teamFilter, setTeamFilter] = useState('All Teams');

  // Filter players based on position and filters
  const filteredPlayers = useMemo(() => {
    let filtered = players.filter(p => p.position === position);
    
    if (conferenceFilter !== 'All Conferences') {
      filtered = filtered.filter(p => p.conference === conferenceFilter);
    }
    
    if (teamFilter !== 'All Teams') {
      filtered = filtered.filter(p => p.team === teamFilter);
    }
    
    // Sort by projected points descending
    return filtered.sort((a, b) => b.projectedPoints - a.projectedPoints);
  }, [players, position, conferenceFilter, teamFilter]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users size={20} />
          {positionName} ({filteredPlayers.length})
        </CardTitle>
        
        {/* Filters */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-muted-foreground" />
            <Select value={conferenceFilter} onValueChange={setConferenceFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONFERENCES.map(conf => (
                  <SelectItem key={conf} value={conf}>{conf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAMS.map(team => (
                  <SelectItem key={team} value={team}>{team}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Player</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Conf</TableHead>
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
                const canSelect = playerStatus.status === 'available' || playerStatus.status === 'used';
                
                return (
                  <TableRow 
                    key={player.id}
                    className={playerStatus.status === 'in-lineup' ? 'bg-secondary/20' : ''}
                  >
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{player.name}</div>
                        <div className="text-xs text-muted-foreground">{player.position}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{player.team}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{player.conference}</TableCell>
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
        
        {filteredPlayers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No players found matching your filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}