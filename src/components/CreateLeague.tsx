import { useState } from 'react';
import { League, LeagueSettings } from '@/lib/types';
import { generateLeagueId, generateLeagueJoinCode } from '@/lib/league-utils';
import { SEASON_YEAR } from '@/lib/season-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Plus, Users } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface CreateLeagueProps {
  onLeagueCreated: (league: League) => void;
  onCancel: () => void;
  currentUserId: string;
  currentUsername: string;
}

export function CreateLeague({ 
  onLeagueCreated, 
  onCancel, 
  currentUserId, 
  currentUsername 
}: CreateLeagueProps) {
  const [leagueName, setLeagueName] = useState('');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState([8]);
  const [isPublic, setIsPublic] = useState(false);
  const [allowLateJoins, setAllowLateJoins] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateLeague = async () => {
    if (!leagueName.trim()) {
      toast.error('Please enter a league name');
      return;
    }

    setIsCreating(true);

    try {
      // In a real app, you'd get user info from authentication
      const currentUser = await spark.user();
      
      const settings: LeagueSettings = {
        maxMembers: maxMembers[0],
        isPublic,
        allowLateJoins,
        scoringMultiplier: 1.0
      };

      const league: League = {
        id: generateLeagueId(),
        name: leagueName.trim(),
        description: description.trim() || undefined,
        ownerId: currentUser.id,
        ownerName: currentUser.login,
        members: [{
          userId: currentUser.id,
          username: currentUser.login,
          avatarUrl: currentUser.avatarUrl,
          joinedAt: new Date(),
          isActive: true,
          totalPoints: 0,
          weeklyPoints: {},
          rank: 1
        }],
        settings,
        createdAt: new Date(),
        season: SEASON_YEAR
      };

      onLeagueCreated(league);
      toast.success(`League "${leagueName}" created successfully!`);
    } catch (error) {
      console.error('Error creating league:', error);
      toast.error('Failed to create league. Please try again.');
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