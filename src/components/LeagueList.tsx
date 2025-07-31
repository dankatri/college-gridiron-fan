import { useState } from 'react';
import { League } from '@/lib/types';
import { canJoinLeague } from '@/lib/league-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Search, 
  Plus, 
  Crown, 
  Calendar,
  Lock,
  Globe
} from '@phosphor-icons/react';
import { toast } from 'sonner';

interface LeagueListProps {
  leagues: League[];
  currentUserId: string;
  onJoinLeague: (league: League) => void;
  onCreateLeague: () => void;
}

export function LeagueList({ 
  leagues, 
  currentUserId, 
  onJoinLeague,
  onCreateLeague 
}: LeagueListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const filteredLeagues = leagues.filter(league => {
    // Filter out leagues the user is already in
    if (league.members.some(m => m.userId === currentUserId)) {
      return false;
    }

    // Apply search filter
    if (searchTerm) {
      return league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             league.description?.toLowerCase().includes(searchTerm.toLowerCase());
    }

    return true;
  });

  const handleJoinLeague = (league: League) => {
    const { canJoin, reason } = canJoinLeague(league, currentUserId);
    
    if (!canJoin) {
      toast.error(reason || 'Cannot join this league');
      return;
    }

    onJoinLeague(league);
  };

  const handleJoinByCode = () => {
    if (!joinCode.trim()) {
      toast.error('Please enter a league code');
      return;
    }

    const league = leagues.find(l => 
      l.id.slice(-8).toUpperCase() === joinCode.trim().toUpperCase()
    );

    if (!league) {
      toast.error('League not found. Check the code and try again.');
      return;
    }

    handleJoinLeague(league);
    setJoinCode('');
  };

  return (
    <div className="space-y-6">
      {/* Search and Join by Code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search size={20} />
            Find a League
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search leagues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={onCreateLeague} className="flex items-center gap-2">
              <Plus size={16} />
              Create
            </Button>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter league code..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
            />
            <Button 
              variant="outline" 
              onClick={handleJoinByCode}
              disabled={!joinCode.trim()}
            >
              Join by Code
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Leagues */}
      <div className="space-y-4">
        {filteredLeagues.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Users size={32} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">No leagues found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm 
                  ? 'Try adjusting your search or create a new league'
                  : 'Be the first to create a league!'
                }
              </p>
              <Button onClick={onCreateLeague}>
                <Plus size={16} className="mr-2" />
                Create League
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredLeagues.map((league) => {
            const { canJoin, reason } = canJoinLeague(league, currentUserId);
            
            return (
              <Card key={league.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold truncate">{league.name}</h3>
                        <div className="flex items-center gap-1">
                          {league.settings.isPublic ? (
                            <Globe size={14} className="text-green-600" />
                          ) : (
                            <Lock size={14} className="text-muted-foreground" />
                          )}
                          <Badge variant="outline" className="text-xs">
                            {league.settings.isPublic ? 'Public' : 'Private'}
                          </Badge>
                        </div>
                      </div>

                      {league.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {league.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users size={14} />
                          <span>{league.members.length}/{league.settings.maxMembers}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Crown size={14} />
                          <span>{league.ownerName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>{league.season}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => handleJoinLeague(league)}
                        disabled={!canJoin}
                        size="sm"
                      >
                        {canJoin ? 'Join League' : 'Full'}
                      </Button>
                      
                      {!canJoin && reason && (
                        <p className="text-xs text-muted-foreground text-right">
                          {reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {league.members.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-muted-foreground mb-2">
                        Recent Members:
                      </div>
                      <div className="flex gap-1">
                        {league.members.slice(-5).map((member, index) => (
                          <Badge key={member.userId} variant="secondary" className="text-xs">
                            {member.username}
                          </Badge>
                        ))}
                        {league.members.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{league.members.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}