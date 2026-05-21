import { useCallback, useEffect, useState } from 'react';
import { League, WeeklyLineup } from '@/lib/types';
import { calculateLeaderboard } from '@/lib/league-utils';
import { CreateLeague } from '@/components/CreateLeague';
import { LeagueList } from '@/components/LeagueList';
import { LeagueManagement } from '@/components/LeagueManagement';
import { Leaderboard } from '@/components/Leaderboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Trophy,
  Users,
  Plus,
  Crown,
  Target,
  Medal,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

interface LeagueDashboardProps {
  currentWeek: number;
  weeklyLineups: WeeklyLineup[];
  currentUserId: string;
  currentUsername: string;
}

type ApiLeague = {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  ownerName?: string;
  season: number;
  joinCode?: string;
  maxMembers: number;
  isPublic: number | boolean;
  allowLateJoins: number | boolean;
  createdAt: string;
  memberCount?: number;
  members?: Array<{
    userId: string;
    displayName: string;
    avatarUrl?: string | null;
    role?: 'owner' | 'member';
    joinedAt: string;
  }>;
};

function toLeagueSummary(apiLeague: ApiLeague): League {
  return {
    id: apiLeague.id,
    name: apiLeague.name,
    description: apiLeague.description ?? undefined,
    ownerId: apiLeague.ownerId,
    ownerName: apiLeague.ownerName ?? 'Owner',
    joinCode: apiLeague.joinCode,
    memberCount: apiLeague.memberCount ?? 0,
    members: [],
    settings: {
      maxMembers: apiLeague.maxMembers,
      isPublic: Boolean(apiLeague.isPublic),
      allowLateJoins: Boolean(apiLeague.allowLateJoins),
      scoringMultiplier: 1,
    },
    createdAt: new Date(apiLeague.createdAt),
    season: apiLeague.season,
  };
}

function toLeagueDetail(apiLeague: ApiLeague): League {
  return {
    ...toLeagueSummary(apiLeague),
    members: (apiLeague.members ?? []).map((member, index) => ({
      userId: member.userId,
      username: member.displayName,
      avatarUrl: member.avatarUrl ?? undefined,
      role: member.role ?? 'member',
      joinedAt: new Date(member.joinedAt),
      isActive: true,
      totalPoints: 0,
      weeklyPoints: {},
      rank: index + 1,
    })),
  };
}

export function LeagueDashboard({
  currentWeek,
  weeklyLineups,
  currentUserId,
  currentUsername,
}: LeagueDashboardProps) {
  const [activeTab, setActiveTab] = useState<'my-leagues' | 'browse' | 'create'>('my-leagues');
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);
  const [isJoiningLeague, setIsJoiningLeague] = useState(false);

  const fetchMyLeagues = useCallback(async () => {
    if (!currentUserId) {
      return;
    }

    setIsLoadingLeagues(true);
    try {
      const response = await fetch('/api/leagues', {
        method: 'GET',
        credentials: 'include',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch leagues');
      }
      const leagues = (payload.leagues ?? []).map((league: ApiLeague) => toLeagueSummary(league));
      setMyLeagues(leagues);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch leagues';
      toast.error(message);
    } finally {
      setIsLoadingLeagues(false);
    }
  }, [currentUserId]);

  const fetchLeagueDetails = useCallback(async (leagueId: string) => {
    const response = await fetch(`/api/leagues/${leagueId}`, {
      method: 'GET',
      credentials: 'include',
    });
    const payload = await response.json();
    if (!response.ok || !payload.league) {
      throw new Error(payload.error || 'Failed to load league');
    }
    const league = toLeagueDetail(payload.league as ApiLeague);
    setSelectedLeague(league);
  }, []);

  useEffect(() => {
    fetchMyLeagues();
  }, [fetchMyLeagues]);

  const handleLeagueCreated = (league: League) => {
    setMyLeagues((previous) => [league, ...previous.filter((item) => item.id !== league.id)]);
    setActiveTab('my-leagues');
  };

  const handleJoinLeague = async () => {
    if (!joinCode.trim()) {
      toast.error('Please enter a join code');
      return;
    }

    setIsJoiningLeague(true);
    try {
      const response = await fetch('/api/leagues/join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: joinCode.trim().toUpperCase() }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.league) {
        throw new Error(payload.error || 'Failed to join league');
      }

      const league = toLeagueSummary(payload.league as ApiLeague);
      setMyLeagues((previous) => [league, ...previous.filter((item) => item.id !== league.id)]);
      setJoinCode('');
      setActiveTab('my-leagues');
      toast.success(`Joined ${league.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join league';
      toast.error(message);
    } finally {
      setIsJoiningLeague(false);
    }
  };

  const handleSelectLeague = async (league: League) => {
    try {
      await fetchLeagueDetails(league.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load league';
      toast.error(message);
    }
  };

  const getLeaderboardForLeague = (league: League) => {
    const allLineups: { [userId: string]: WeeklyLineup[] } = {};

    league.members.forEach((member) => {
      allLineups[member.userId] = member.userId === currentUserId ? weeklyLineups : [];
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
              {(selectedLeague.memberCount ?? selectedLeague.members.length)} members • Season {selectedLeague.season}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedLeague(null);
              fetchMyLeagues();
            }}
          >
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
            <Leaderboard entries={getLeaderboardForLeague(selectedLeague)} currentWeek={currentWeek} currentUserId={currentUserId} />
          </TabsContent>

          <TabsContent value="manage" className="mt-6">
            <LeagueManagement
              league={selectedLeague}
              currentUserId={currentUserId}
              onRefreshLeague={async () => {
                await fetchLeagueDetails(selectedLeague.id);
                await fetchMyLeagues();
              }}
              onLeftLeague={() => {
                setSelectedLeague(null);
                fetchMyLeagues();
              }}
              onDeletedLeague={() => {
                setSelectedLeague(null);
                fetchMyLeagues();
              }}
            />
          </TabsContent>
        </Tabs>
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
        <p className="text-xs text-muted-foreground">Signed in as {currentUsername}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target size={18} />
            Join League with Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Enter 8-character join code"
              value={joinCode}
              maxLength={8}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleJoinLeague();
                }
              }}
            />
            <Button onClick={handleJoinLeague} disabled={isJoiningLeague || joinCode.trim().length !== 8}>
              {isJoiningLeague ? 'Joining...' : 'Join League'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'my-leagues' | 'browse' | 'create')}>
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
          {isLoadingLeagues ? (
            <Card>
              <CardContent className="text-center py-10 text-muted-foreground">Loading leagues...</CardContent>
            </Card>
          ) : myLeagues.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Medal size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No leagues yet</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Join an existing league or create your own to start competing.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => setActiveTab('create')}>Create League</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myLeagues.map((league) => (
                <Card key={league.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSelectLeague(league)}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {league.name}
                          {league.ownerId === currentUserId && <Crown size={16} className="text-yellow-500" />}
                        </CardTitle>
                        {league.description && <p className="text-sm text-muted-foreground mt-1">{league.description}</p>}
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
                          {(league.memberCount ?? league.members.length)}/{league.settings.maxMembers} members
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
          <LeagueList leagues={myLeagues} currentUserId={currentUserId} onSelectLeague={handleSelectLeague} onCreateLeague={() => setActiveTab('create')} />
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <CreateLeague onLeagueCreated={handleLeagueCreated} onCancel={() => setActiveTab('my-leagues')} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
