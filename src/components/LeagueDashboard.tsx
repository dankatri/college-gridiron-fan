import { useMemo, useState } from 'react';
import { League, WeeklyLineup } from '@/lib/types';
import { CreateLeague } from '@/components/CreateLeague';
import { LeagueList } from '@/components/LeagueList';
import { LeagueView } from '@/components/LeagueView';
import { toLeagueSummary, type ApiLeague, type LeagueViewCache } from '@/lib/league-view-data';
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
  leagues: ApiLeague[];
  isLoadingLeagues: boolean;
  viewCache: LeagueViewCache;
  onRefreshLeagues: () => Promise<void>;
  onLineupsChanged: () => Promise<void>;
}

export function LeagueDashboard({
  currentWeek,
  weeklyLineups,
  currentUserId,
  currentUsername,
  leagues,
  isLoadingLeagues,
  viewCache,
  onRefreshLeagues: fetchMyLeagues,
  onLineupsChanged,
}: LeagueDashboardProps) {
  const [activeTab, setActiveTab] = useState<'my-leagues' | 'browse' | 'create'>('my-leagues');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null | undefined>(undefined);
  const myLeagues = useMemo(() => leagues.map(toLeagueSummary), [leagues]);
  const selectedLeague = selectedLeagueId === undefined
    ? myLeagues[0]
    : myLeagues.find(league => league.id === selectedLeagueId);

  const [joinCode, setJoinCode] = useState('');
  const [isJoiningLeague, setIsJoiningLeague] = useState(false);

  const handleLeagueCreated = (league: League) => {
    setSelectedLeagueId(null);
    void fetchMyLeagues();
    setActiveTab('my-leagues');
  };

  const handleJoinLeague = async () => {
    if (!joinCode.trim()) {
      toast.error('Please enter a join code');
      return;
    }

    setSelectedLeagueId(null);
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
      await fetchMyLeagues();
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

  const handleSelectLeague = (league: League) => setSelectedLeagueId(league.id);

  const handleBackToLeagues = () => {
    setSelectedLeagueId(null);
    if (!isLoadingLeagues) void fetchMyLeagues();
  };

  if (isLoadingLeagues && selectedLeagueId !== null && !selectedLeague) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-8">
          <p role="status" className="text-muted-foreground">Loading your leagues...</p>
          <Button variant="outline" onClick={handleBackToLeagues}>Back to Leagues</Button>
        </CardContent>
      </Card>
    );
  }

  if (selectedLeague) {
    return (
      <LeagueView key={selectedLeague.id} league={selectedLeague} currentWeek={currentWeek}
        currentUserId={currentUserId} viewCache={viewCache} onBack={handleBackToLeagues}
        onRefreshLeagues={fetchMyLeagues} onLineupsChanged={onLineupsChanged} />
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

      <Tabs value={activeTab} onValueChange={(value) => {
        setSelectedLeagueId(null);
        setActiveTab(value as 'my-leagues' | 'browse' | 'create');
      }}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="my-leagues" aria-label="My leagues" className="flex items-center gap-1 sm:gap-2">
            <Users size={16} />
            <span className="hidden sm:inline">My Leagues ({myLeagues.length})</span>
          </TabsTrigger>
          <TabsTrigger value="browse" aria-label="Browse leagues" className="flex items-center gap-1 sm:gap-2">
            <Target size={16} />
            <span className="hidden sm:inline">Browse</span>
          </TabsTrigger>
          <TabsTrigger value="create" aria-label="Create league" className="flex items-center gap-1 sm:gap-2">
            <Plus size={16} />
            <span className="hidden sm:inline">Create</span>
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
