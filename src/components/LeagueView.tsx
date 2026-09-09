import { useMemo, useState, useSyncExternalStore } from 'react';
import { Crown, ShieldCheck, Trophy, Users } from '@phosphor-icons/react';
import type { League, LeaderboardEntry } from '@/lib/types';
import { toLeagueDetail, type LeagueViewCache } from '@/lib/league-view-data';
import { useResource } from '@/hooks/use-resource';
import { optionalFeature } from '@/components/optional-feature';
import { Leaderboard } from '@/components/Leaderboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const LeagueManagement = optionalFeature('League Management', () => import('./LeagueManagement').then(module => ({ default: module.LeagueManagement })));
const LeagueAdmin = optionalFeature('League Admin', () => import('./LeagueAdmin').then(module => ({ default: module.LeagueAdmin })));
const MemberLineupDialog = optionalFeature('Member Lineup', () => import('./MemberLineupDialog').then(module => ({ default: module.MemberLineupDialog })));

interface LeagueViewProps {
  league: League;
  currentWeek: number;
  currentUserId: string;
  viewCache: LeagueViewCache;
  onBack: () => void;
  onRefreshLeagues: () => Promise<void>;
  onLineupsChanged: () => Promise<void>;
}

export function LeagueView({ league, currentWeek, currentUserId, viewCache, onBack, onRefreshLeagues, onLineupsChanged }: LeagueViewProps) {
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [viewedMember, setViewedMember] = useState<{ userId: string; username: string; avatarUrl?: string } | null>(null);
  const resources = viewCache.get(league.id);
  const standings = useResource(resources.standings, activeTab === 'leaderboard');
  const details = useResource(resources.details, activeTab === 'manage', false);
  const isOwner = league.ownerId === currentUserId;
  const accessError = useSyncExternalStore(resources.observeAccess, resources.getAccessError, resources.getAccessError);
  const entries = useMemo<LeaderboardEntry[]>(() => (standings.data ?? []).map(entry => {
    const points = Object.values(entry.weeklyPoints);
    const weeksPlayed = entry.weeksScored ?? points.length;
    return {
      rank: entry.rank, userId: entry.userId, username: entry.username,
      avatarUrl: entry.avatarUrl ?? undefined, totalPoints: entry.totalPoints,
      winningWeeks: entry.winningWeeks ?? 0, weeksPlayed,
      weeklyAverage: weeksPlayed > 0 ? entry.totalPoints / weeksPlayed : 0,
      bestWeek: points.length ? Math.max(...points) : 0,
      worstWeek: points.length ? Math.min(...points) : 0,
      pointsThisWeek: entry.weeklyPoints[currentWeek] ?? 0, trend: 'same', trendChange: 0,
    };
  }), [standings.data, currentWeek]);

  const leaveView = () => {
    viewCache.remove(league.id);
    onBack();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Crown size={24} className="text-accent" />{league.name}
          </h2>
          <p className="text-muted-foreground">{league.memberCount ?? league.members.length} members &bull; Season {league.season}</p>
        </div>
        <Button variant="outline" onClick={accessError ? leaveView : onBack}>Back to Leagues</Button>
      </div>

      {accessError ? (
        <Card><CardContent className="space-y-3 py-6">
          <p role="alert">{accessError.message}</p>
          <Button variant="outline" onClick={() => {
            void resources.standings.refresh(true);
            void resources.details.refresh(true);
          }}>Retry league access</Button>
        </CardContent></Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full ${isOwner ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="leaderboard" aria-label="Leaderboard"><Trophy size={16} /><span className="hidden sm:inline">Leaderboard</span></TabsTrigger>
            <TabsTrigger value="manage" aria-label="Manage league"><Users size={16} /><span className="hidden sm:inline">Manage</span></TabsTrigger>
            {isOwner && <TabsTrigger value="admin" aria-label="League admin"><ShieldCheck size={16} /><span className="hidden sm:inline">Admin</span></TabsTrigger>}
          </TabsList>

          <TabsContent value="leaderboard" className="mt-6 space-y-3">
            {standings.error && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div>
                  <p>{standings.error.message}</p>
                  {standings.data !== undefined && <p className="text-muted-foreground">Showing the last loaded standings.</p>}
                </div>
                <Button variant="outline" size="sm" onClick={() => void resources.standings.refresh(true)}>Retry standings</Button>
              </div>
            )}
            {standings.data !== undefined ? (
              <>
                {standings.isLoading && <p role="status" className="text-xs text-muted-foreground">Updating standings...</p>}
                <Leaderboard entries={entries} currentWeek={currentWeek} currentUserId={currentUserId}
                  onSelectMember={entry => setViewedMember({ userId: entry.userId, username: entry.username, avatarUrl: entry.avatarUrl })} />
              </>
            ) : !standings.error && (
              <Card><CardContent role="status" className="py-8 text-muted-foreground">Loading standings...</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="manage" className="mt-6 space-y-3">
            {details.error && (
              <div role="alert" className="space-y-2 rounded-lg border p-3 text-sm">
                <p>{details.error.message}</p>
                {details.data && <p>Showing the last loaded league details.</p>}
                <Button variant="outline" size="sm" onClick={() => void resources.details.refresh(true)}>Retry league details</Button>
              </div>
            )}
            {details.data ? (
              <LeagueManagement league={toLeagueDetail(details.data)} currentUserId={currentUserId}
                onRefreshLeague={async () => {
                  viewCache.invalidate(league.id);
                  await Promise.all([resources.details.read(), resources.standings.read(), onRefreshLeagues()]);
                }}
                onLeftLeague={leaveView} onDeletedLeague={leaveView} />
            ) : !details.error && (
              <Card><CardContent role="status" className="py-8 text-muted-foreground">Loading league details...</CardContent></Card>
            )}
          </TabsContent>

          {isOwner && <TabsContent value="admin" className="mt-6">
            <LeagueAdmin leagueId={league.id} currentWeek={currentWeek} isOwner={isOwner} onSaved={async () => {
              viewCache.invalidateStandings(league.id);
              setViewedMember(null);
              await Promise.all([resources.standings.read(), onLineupsChanged()]);
            }} />
          </TabsContent>}
        </Tabs>
      )}

      {!accessError && viewedMember && <MemberLineupDialog
        key={`${league.id}:${viewedMember.userId}:${currentWeek}`}
        leagueId={league.id} member={viewedMember} week={currentWeek} currentUserId={currentUserId}
        open onOpenChange={open => { if (!open) setViewedMember(null); }} />}
    </div>
  );
}
