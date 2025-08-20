import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, User, GitBranch, ShieldCheck } from '@phosphor-icons/react';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already authenticated on component mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        const user = await spark.user();
        if (user && user.id) {
          onLoginSuccess(user);
        }
      } catch (error) {
        // User not authenticated, show login screen
        console.log('User not authenticated, showing login screen');
      }
    };
    
    checkExistingAuth();
  }, [onLoginSuccess]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const user = await spark.user();
      if (user && user.id) {
        onLoginSuccess(user);
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Unable to authenticate. Please ensure you are logged into GitHub and try again.');
    } finally {
      setIsLoading(false);
    }
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
            Sign in to create and manage your fantasy lineups
          </p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <ShieldCheck size={20} />
              Authentication Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <GitBranch size={20} className="text-primary" />
                <div className="text-sm">
                  <div className="font-medium">GitHub Authentication</div>
                  <div className="text-muted-foreground">Secure login with your GitHub account</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <User size={20} className="text-secondary" />
                <div className="text-sm">
                  <div className="font-medium">Personalized Experience</div>
                  <div className="text-muted-foreground">Your lineups and stats are saved to your account</div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button 
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Authenticating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <GitBranch size={18} />
                  Sign in with GitHub
                </div>
              )}
            </Button>

            <div className="text-center space-y-2">
              <div className="text-xs text-muted-foreground">
                Powered by GitHub Spark
              </div>
              <div className="flex justify-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Secure
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Private
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Fast
                </Badge>
              </div>
            </div>
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