import { useState, useEffect } from 'react';
import { useLocalStorage as useKV } from '@/hooks/use-local-storage';
import { League, LeagueMember, WeeklyLineup } from '@/lib/types';
import { calculateLeaderboard, updateLeagueMemberPoints } from '@/lib/league-utils';
import { SEASON_YEAR } from '@/lib/season-config';
import { CreateLeague } from '@/components/CreateLeague';
import { LeagueList } from '@/components/LeagueList';
import { LeagueManagement } from '@/components/LeagueManagement';
import { Leaderboard } from '@/components/Leaderboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  Users, 
  Plus, 
  Crown, 
  TrendUp,
  Target,
  Medal
} from '@phosphor-icons/react';
import { toast } from 'sonner';

interface LeagueDashboardProps {
  currentWeek: number;
  weeklyLineups: WeeklyLineup[];
  currentUserId: string;
}

export function LeagueDashboard({ 
  currentWeek, 
  weeklyLineups,
  currentUserId 
}: LeagueDashboardProps) {
  const [activeTab, setActiveTab] = useState<'my-leagues' | 'browse' | 'create'>('my-leagues');
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Persistent data
  const [allLeagues, setAllLeagues] = useKV<League[]>(`all-leagues-${currentUserId}-${SEASON_YEAR}`, []);
  const [userLeagues, setUserLeagues] = useKV<string[]>(`user-leagues-${currentUserId}-${SEASON_YEAR}`, []);

  // Sample leagues for demo
  useEffect(() => {
    if (allLeagues.length === 0) {
      const sampleLeagues: League[] = [
        {
          id: 'league_sample_1',
          name: 'College Football Champions',
          description: 'Competitive league for serious fantasy players',
          ownerId: 'sample_user_1',
          ownerName: 'FantasyPro',
          members: [
            {
              userId: 'sample_user_1',
              username: 'FantasyPro',
              joinedAt: new Date(`${SEASON_YEAR}-01-01`),
              isActive: true,
              totalPoints: 145.8,
              weeklyPoints: { 1: 72.4, 2: 73.4 },
              rank: 1
            },
            {
              userId: 'sample_user_2',
              username: 'GridironGuru',
              joinedAt: new Date(`${SEASON_YEAR}-01-02`),
              isActive: true,
              totalPoints: 138.2,
              weeklyPoints: { 1: 65.8, 2: 72.4 },
              rank: 2
            }
          ],
          settings: {
            maxMembers: 12,
            isPublic: true,
            allowLateJoins: true,
            scoringMultiplier: 1.0
          },
          createdAt: new Date(`${SEASON_YEAR}-01-01`),
          season: SEASON_YEAR
        },
        {
          id: 'league_sample_2',
          name: 'Friends & Football',
          description: 'Casual league for friends',
          ownerId: 'sample_user_3',
          ownerName: 'CasualFan',
          members: [
            {
              userId: 'sample_user_3',
              username: 'CasualFan',
              joinedAt: new Date(`${SEASON_YEAR}-01-03`),
              isActive: true,
              totalPoints: 125.6,
              weeklyPoints: { 1: 58.2, 2: 67.4 },
              rank: 1
            }
          ],
          settings: {
            maxMembers: 8,
            isPublic: false,
            allowLateJoins: false,
            scoringMultiplier: 1.0
          },
          createdAt: new Date(`${SEASON_YEAR}-01-03`),
          season: SEASON_YEAR
        }
      ];
      setAllLeagues(sampleLeagues);
    }
  }, [allLeagues, setAllLeagues]);

  const myLeagues = allLeagues.filter(league => 
    league.members.some(member => member.userId === currentUserId)
  );

  const handleCreateLeague = (league: League) => {
    setAllLeagues(prev => [...prev, league]);
    setUserLeagues(prev => [...prev, league.id]);
    setShowCreateForm(false);
    setActiveTab('my-leagues');
    toast.success('League created successfully!');
  };

  const handleJoinLeague = async (league: League) => {
    try {
      const newMember: LeagueMember = {
        userId: currentUserId,
        username: currentUsername,
        joinedAt: new Date(),
        isActive: true,
        totalPoints: 0,
        weeklyPoints: {},
        rank: league.members.length + 1
      };

      const updatedLeague = {
        ...league,
        members: [...league.members, newMember]
      };

      setAllLeagues(prev => 
        prev.map(l => l.id === league.id ? updatedLeague : l)
      );
      setUserLeagues(prev => [...prev, league.id]);
      toast.success(`Joined ${league.name}!`);
    } catch (error) {
      toast.error('Failed to join league');
    }
  };

  const handleUpdateLeague = (updatedLeague: League) => {
    setAllLeagues(prev => 
      prev.map(l => l.id === updatedLeague.id ? updatedLeague : l)
    );
    setSelectedLeague(updatedLeague);
  };

  const handleLeaveLeague = (leagueId: string) => {
    setAllLeagues(prev => 
      prev.map(league => {
        if (league.id === leagueId) {
          return {
            ...league,
            members: league.members.filter(m => m.userId !== currentUserId)
          };
        }
        return league;
      })
    );
    setUserLeagues(prev => prev.filter(id => id !== leagueId));
    setSelectedLeague(null);
    toast.success('Left league successfully');
  };

  // Calculate leaderboard for selected league
  const getLeaderboardForLeague = (league: League) => {
    const allLineups: { [userId: string]: WeeklyLineup[] } = {};
    
    // For demo, we'll use the current user's lineups for all members
    league.members.forEach(member => {
      if (member.userId === currentUserId) {
        allLineups[member.userId] = weeklyLineups;
      } else {
        // Generate mock data for other members
        allLineups[member.userId] = [];
      }
    });

    return calculateLeaderboard(league.members, allLineups, currentWeek);
  };

  if (selectedLeague) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Crown size={24} className="text-accent" />
              {selectedLeague.name}
            </h2>
            <p className="text-muted-foreground">
              {selectedLeague.members.length} members • Season {selectedLeague.season}
            </p>
          </div>
          <Button variant="outline" onClick={() => setSelectedLeague(null)}>
            Back to Leagues
          </Button>
        </div>

        <Tabs defaultValue="leaderboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leaderboard" className="flex items-center gap-2">
              <Trophy size={16} />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <Users size={16} />
              Manage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard" className="mt-6">
            <Leaderboard
              entries={getLeaderboardForLeague(selectedLeague)}
              currentWeek={currentWeek}
              currentUserId={currentUserId}
            />
          </TabsContent>

          <TabsContent value="manage" className="mt-6">
            <LeagueManagement
              league={selectedLeague}
              currentUserId={currentUserId}
              onUpdateLeague={handleUpdateLeague}
              onLeaveLeague={() => handleLeaveLeague(selectedLeague.id)}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Create League</h2>
          <Button variant="outline" onClick={() => setShowCreateForm(false)}>
            Cancel
          </Button>
        </div>
        <CreateLeague
          onLeagueCreated={handleCreateLeague}
          onCancel={() => setShowCreateForm(false)}
          currentUserId={currentUserId}
          currentUsername="User" // Will be replaced with real user data
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Trophy size={28} className="text-accent" />
          League Competition
        </h2>
        <p className="text-muted-foreground">
          Join or create leagues to compete with friends and other fantasy players
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="my-leagues" className="flex items-center gap-2">
            <Users size={16} />
            My Leagues ({myLeagues.length})
          </TabsTrigger>
          <TabsTrigger value="browse" className="flex items-center gap-2">
            <Target size={16} />
            Browse
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus size={16} />
            Create
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-leagues" className="mt-6">
          {myLeagues.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Medal size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No leagues yet</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Join an existing league or create your own to start competing!
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => setActiveTab('browse')}>
                    Browse Leagues
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('create')}>
                    Create League
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myLeagues.map(league => (
                <Card 
                  key={league.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedLeague(league)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {league.name}
                          {league.ownerId === currentUserId && (
                            <Crown size={16} className="text-yellow-500" />
                          )}
                        </CardTitle>
                        {league.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {league.description}
                          </p>
                        )}
                      </div>
                      <Badge variant={league.settings.isPublic ? 'default' : 'secondary'}>
                        {league.settings.isPublic ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {league.members.length}/{league.settings.maxMembers} members
                        </span>
                        <span>Season {league.season}</span>
                      </div>
                      <Button variant="outline" size="sm">
                        View League
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="browse" className="mt-6">
          <LeagueList
            leagues={allLeagues}
            currentUserId={currentUserId}
            onJoinLeague={handleJoinLeague}
            onCreateLeague={() => setActiveTab('create')}
          />
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <CreateLeague
            onLeagueCreated={handleCreateLeague}
            onCancel={() => setActiveTab('my-leagues')}
            currentUserId={currentUserId}
            currentUsername="User"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}