import { useState } from 'react';
import { League } from '@/lib/types';
import { SEASON_YEAR } from '@/lib/season-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Plus } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface CreateLeagueProps {
  onLeagueCreated: (league: League) => void;
  onCancel: () => void;
}

export function CreateLeague({ 
  onLeagueCreated, 
  onCancel 
}: CreateLeagueProps) {
  const [leagueName, setLeagueName] = useState('');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState([8]);
  const [isPublic, setIsPublic] = useState(false);
  const [allowLateJoins, setAllowLateJoins] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createdJoinCode, setCreatedJoinCode] = useState<string | null>(null);

  const parseLeagueFromApi = (payload: any): League => {
    const league = payload.league;
    return {
      id: league.id,
      name: league.name,
      description: league.description ?? undefined,
      ownerId: league.ownerId,
      ownerName: league.ownerName ?? 'Owner',
      joinCode: league.joinCode,
      memberCount: league.memberCount ?? 1,
      members: [
        {
          userId: league.ownerId,
          username: league.ownerName ?? 'Owner',
          avatarUrl: undefined,
          role: 'owner',
          joinedAt: new Date(league.createdAt),
          isActive: true,
          totalPoints: 0,
          weeklyPoints: {},
          rank: 1,
        },
      ],
      settings: {
        maxMembers: league.maxMembers,
        isPublic: Boolean(league.isPublic),
        allowLateJoins: Boolean(league.allowLateJoins),
        scoringMultiplier: 1,
      },
      createdAt: new Date(league.createdAt),
      season: league.season,
    };
  };

  const handleCreateLeague = async () => {
    if (!leagueName.trim()) {
      toast.error('Please enter a league name');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/leagues', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leagueName.trim(),
          description: description.trim() || undefined,
          season: SEASON_YEAR,
          maxMembers: maxMembers[0],
          isPublic,
          allowLateJoins,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.league) {
        throw new Error(payload.error || 'Failed to create league');
      }

      const league = parseLeagueFromApi(payload);
      setCreatedJoinCode(league.joinCode ?? null);
      onLeagueCreated(league);
      toast.success(`League "${league.name}" created successfully!`);
    } catch (error) {
      console.error('Error creating league:', error);
      const message = error instanceof Error ? error.message : 'Failed to create league. Please try again.';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus size={20} />
          Create New League
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {createdJoinCode && (
          <div className="rounded-lg border p-4 bg-muted/40">
            <p className="text-sm text-muted-foreground mb-1">Share this join code:</p>
            <p className="text-2xl font-mono font-semibold tracking-wider">{createdJoinCode}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="league-name">League Name *</Label>
          <Input
            id="league-name"
            placeholder="Enter league name..."
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            placeholder="Describe your league..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={3}
          />
        </div>

        <div className="space-y-3">
          <Label>Maximum Members: {maxMembers[0]}</Label>
          <Slider
            value={maxMembers}
            onValueChange={setMaxMembers}
            min={2}
            max={20}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>2</span>
            <span>20</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="public-league"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
            <div className="space-y-1">
              <Label htmlFor="public-league">Public League</Label>
              <p className="text-xs text-muted-foreground">
                Allow anyone to find and join
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="late-joins"
              checked={allowLateJoins}
              onCheckedChange={setAllowLateJoins}
            />
            <div className="space-y-1">
              <Label htmlFor="late-joins">Allow Late Joins</Label>
              <p className="text-xs text-muted-foreground">
                Let people join after season starts
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateLeague}
            disabled={isCreating || !leagueName.trim()}
            className="flex-1"
          >
            {isCreating ? 'Creating...' : 'Create League'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
