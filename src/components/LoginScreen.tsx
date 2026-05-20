import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trophy, User, ShieldCheck } from '@phosphor-icons/react';

interface LoginScreenProps {
  onLoginSuccess: (login: string, email?: string) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setError('Please enter a display name');
      return;
    }
    onLoginSuccess(name, email.trim() || undefined);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Trophy size={48} className="text-accent" />
          </div>
          <h1 className="text-3xl font-bold">College Fantasy Football</h1>
          <p className="text-muted-foreground">
            Enter your name to get started
          </p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <ShieldCheck size={20} />
              Create Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name *</Label>
                <Input
                  id="displayName"
                  placeholder="Enter your name or GitHub username"
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); setError(null); }}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Tip: use your GitHub username to show your avatar
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" size="lg">
                <div className="flex items-center gap-2">
                  <User size={18} />
                  Get Started
                </div>
              </Button>

              <div className="text-center">
                <div className="flex justify-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    No signup required
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Data saved locally
                  </Badge>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Features Preview */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <h3 className="font-semibold">What you'll get access to:</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>• Build weekly lineups with current college players</div>
                <div>• Track player usage (3 times max per season)</div>
                <div>• Live scoring and statistics</div>
                <div>• League competition with friends</div>
                <div>• Schedule integration and bye week alerts</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}