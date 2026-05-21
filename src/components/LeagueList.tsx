import { useState } from 'react';
import { League } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  MagnifyingGlass as Search, 
  Plus, 
  Crown, 
  Calendar,
  Lock,
  Globe,
} from '@phosphor-icons/react';

interface LeagueListProps {
  leagues: League[];
  currentUserId: string;
  onSelectLeague: (league: League) => void;
  onCreateLeague: () => void;
}

export function LeagueList({ 
  leagues, 
  currentUserId, 
  onSelectLeague,
  onCreateLeague 
}: LeagueListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLeagues = leagues.filter(league => {
    if (searchTerm) {
      return league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             league.description?.toLowerCase().includes(searchTerm.toLowerCase());
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search */}
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
        </CardContent>
      </Card>

      {/* Leagues */}
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
                          <span>{league.memberCount ?? league.members.length}/{league.settings.maxMembers}</span>
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
                        onClick={() => onSelectLeague(league)}
                        size="sm"
                      >
                        {league.ownerId === currentUserId ? 'Manage League' : 'View League'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
