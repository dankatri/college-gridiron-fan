import { useState } from 'react';
import { League, LeagueMember, LeagueInvite } from '@/lib/types';
import { generateInviteId } from '@/lib/league-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Plus, 
  Crown, 
  Copy, 
  Check, 
  UserMinus,
  Settings,
  User
} from '@phosphor-icons/react';
import { toast } from 'sonner';

interface LeagueManagementProps {
  league: League;
  currentUserId: string;
  onUpdateLeague: (league: League) => void;
  onLeaveLeague?: () => void;
}

export function LeagueManagement({ 
  league, 
  currentUserId, 
  onUpdateLeague,
  onLeaveLeague 
}: LeagueManagementProps) {
  const [inviteUsername, setInviteUsername] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const isOwner = league.ownerId === currentUserId;
  const leagueJoinCode = league.id.slice(-8).toUpperCase();

  const handleInviteMember = async () => {
    if (!inviteUsername.trim()) {
      toast.error('Please enter a username');
      return;
    }

    if (league.members.some(m => m.username.toLowerCase() === inviteUsername.toLowerCase())) {
      toast.error('User is already a member');
      return;
    }

    if (league.members.length >= league.settings.maxMembers) {
      toast.error('League is full');
      return;
    }

    setIsInviting(true);

    try {
      // In a real app, you'd validate the username and send an invite
      // For demo purposes, we'll simulate adding a user
      const newMember: LeagueMember = {
        userId: `user_${Date.now()}`,
        username: inviteUsername.trim(),
        avatarUrl: undefined,
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

      onUpdateLeague(updatedLeague);
      setInviteUsername('');
      toast.success(`Invited ${inviteUsername} to the league!`);
    } catch (error) {
      toast.error('Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = (memberId: string, memberUsername: string) => {
    if (!isOwner) {
      toast.error('Only the league owner can remove members');
      return;
    }

    const updatedLeague = {
      ...league,
      members: league.members.filter(m => m.userId !== memberId)
    };

    onUpdateLeague(updatedLeague);
    toast.success(`Removed ${memberUsername} from the league`);
  };

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

  const handleLeaveLeague = () => {
    if (isOwner) {
      toast.error('League owners cannot leave. Transfer ownership first.');
      return;
    }

    if (onLeaveLeague) {
      onLeaveLeague();
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

      {/* Invite Section */}
      {isOwner && league.members.length < league.settings.maxMembers && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus size={16} />
              Invite Members
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter username to invite..."
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInviteMember()}
              />
              <Button 
                onClick={handleInviteMember}
                disabled={isInviting || !inviteUsername.trim()}
              >
                {isInviting ? 'Inviting...' : 'Invite'}
              </Button>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium">League Join Code</div>
                <div className="text-xs text-muted-foreground">
                  Share this code for others to join
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="px-2 py-1 bg-background rounded font-mono text-sm">
                  {leagueJoinCode}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyInviteCode}
                >
                  {copiedInvite ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
      {!isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings size={16} />
              League Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleLeaveLeague}
              className="w-full"
            >
              Leave League
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}