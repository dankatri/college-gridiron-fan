import { useState } from 'react';
import { League } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Crown, 
  Copy, 
  Check, 
  UserMinus,
  Gear as Settings,
  User,
  Trash,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

interface LeagueManagementProps {
  league: League;
  currentUserId: string;
  onRefreshLeague: () => Promise<void>;
  onLeftLeague: () => void;
  onDeletedLeague: () => void;
}

export function LeagueManagement({ 
  league, 
  currentUserId, 
  onRefreshLeague,
  onLeftLeague,
  onDeletedLeague,
}: LeagueManagementProps) {
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isOwner = league.ownerId === currentUserId;
  const leagueJoinCode = league.joinCode ?? 'UNAVAILABLE';

  const handleCopyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(leagueJoinCode);
      setCopiedInvite(true);
      toast.success('League code copied to clipboard!');
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch (error) {
      toast.error('Failed to copy invite code');
    }
  };

  const handleRemoveMember = async (memberId: string, memberUsername: string) => {
    if (!isOwner) {
      toast.error('Only the league owner can remove members');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/leagues/${league.id}/members?userId=${encodeURIComponent(memberId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to remove member');
      }
      toast.success(`Removed ${memberUsername} from the league`);
      await onRefreshLeague();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove member';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLeaveLeague = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/leagues/${league.id}/members?userId=me`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to leave league');
      }
      toast.success('You left the league');
      onLeftLeague();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to leave league';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLeague = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/leagues/${league.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete league');
      }
      toast.success('League deleted');
      onDeletedLeague();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete league';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* League Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={20} />
            {league.name}
          </CardTitle>
          {league.description && (
            <p className="text-sm text-muted-foreground">
              {league.description}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold">{league.members.length}</div>
              <div className="text-xs text-muted-foreground">Members</div>
            </div>
            <div>
              <div className="text-lg font-semibold">{league.settings.maxMembers}</div>
              <div className="text-xs text-muted-foreground">Max Size</div>
            </div>
            <div>
              <div className="text-lg font-semibold">{league.season}</div>
              <div className="text-xs text-muted-foreground">Season</div>
            </div>
            <div>
              <Badge variant={league.settings.isPublic ? 'default' : 'secondary'}>
                {league.settings.isPublic ? 'Public' : 'Private'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">League Join Code</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Share this code for others to join</div>
            </div>
            <div className="flex items-center gap-2">
              <code className="px-2 py-1 bg-background rounded font-mono text-sm tracking-wider">
                {leagueJoinCode}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyInviteCode}>
                {copiedInvite ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users size={16} />
            Members ({league.members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {league.members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center gap-3 p-3 rounded-lg border"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage 
                    src={member.avatarUrl} 
                    alt={member.username}
                  />
                  <AvatarFallback>
                    <User size={16} />
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{member.username}</span>
                    {member.userId === league.ownerId && (
                      <Crown size={14} className="text-yellow-500" />
                    )}
                    {member.userId === currentUserId && (
                      <Badge variant="secondary" className="text-xs">You</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Joined {member.joinedAt.toLocaleDateString()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-medium">{member.totalPoints.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">pts</div>
                </div>

                {isOwner && member.userId !== currentUserId && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => handleRemoveMember(member.userId, member.username)}
                  >
                    <UserMinus size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings size={16} />
            League Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isOwner && (
            <Button
              variant="destructive"
              onClick={handleLeaveLeague}
              disabled={isSaving}
              className="w-full"
            >
              Leave League
            </Button>
          )}

          {isOwner && (
            <Button
              variant="destructive"
              onClick={handleDeleteLeague}
              disabled={isSaving}
              className="w-full"
            >
              <Trash size={16} className="mr-2" />
              Delete League
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
