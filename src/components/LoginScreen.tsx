import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuthError, useAuth } from '@/hooks/use-auth';
import { ShieldCheck, SignIn, Trophy, User, Key, ArrowLeft, EnvelopeSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';

type View = 'auth' | 'forgot' | 'reset';

function readResetTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  if (!url.pathname.replace(/\/+$/, '').endsWith('/reset-password')) return null;
  return url.searchParams.get('token');
}

export function LoginScreen() {
  const { signIn, register, signInWithPasskey, requestPasswordReset, resetPassword } = useAuth();
  const [resetToken, setResetToken] = useState<string | null>(() => readResetTokenFromUrl());
  const [view, setView] = useState<View>(() => (readResetTokenFromUrl() ? 'reset' : 'auth'));
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [registerDisplayName, setRegisterDisplayName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');

  const clearFeedback = () => {
    setError(null);
    setErrorCode(null);
    setNotice(null);
  };

  const goToView = (next: View, email?: string) => {
    clearFeedback();
    if (email !== undefined) {
      if (next === 'forgot') setForgotEmail(email);
      if (next === 'auth') setSignInEmail(email);
    }
    setView(next);
  };


  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    if (!signInEmail.trim() || !signInPassword) {
      setError('Please enter your email and password');
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(signInEmail.trim(), signInPassword);
      toast.success('Signed in successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasskeySignIn = async () => {
    clearFeedback();
    if (!signInEmail.trim()) {
      setError('Enter your account email first');
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithPasskey(signInEmail.trim());
      toast.success('Signed in with passkey');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey sign-in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (!registerDisplayName.trim()) {
      setError('Please enter a display name');
      return;
    }
    if (registerPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(registerEmail.trim(), registerPassword, registerDisplayName.trim());
      toast.success('Account created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register');
      setErrorCode(err instanceof AuthError ? err.code ?? null : null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (!forgotEmail.trim()) {
      setError('Please enter your email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const message = await requestPasswordReset(forgotEmail.trim());
      setNotice(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send password reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (!resetToken) {
      setError('This password reset link is invalid or has expired. Please request a new one.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(resetToken, newPassword);
      window.history.replaceState({}, '', '/');
      toast.success('Password updated — you are signed in');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
      if (err instanceof AuthError && err.code === 'INVALID_RESET_TOKEN') {
        setResetToken(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const errorBlock = error && (
    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-3">
      <p className="text-sm text-destructive">{error}</p>
      {errorCode === 'REGISTRATION_CONFLICT' && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => {
              setActiveTab('signin');
              setSignInEmail(registerEmail.trim());
              clearFeedback();
            }}
          >
            Sign in instead
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => goToView('forgot', registerEmail.trim())}
          >
            Reset password
          </Button>
        </div>
      )}
    </div>
  );

  const noticeBlock = notice && (
    <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
      <p className="text-sm">{notice}</p>
    </div>
  );

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
            Sign in to save your fantasy lineup securely
          </p>
        </div>

        {/* Login Card */}
        {view !== 'auth' ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <ShieldCheck size={20} />
                {view === 'forgot' ? 'Reset your password' : 'Choose a new password'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {view === 'forgot' ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter your account email and we&apos;ll send you a link to set a new password.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      autoFocus
                    />
                  </div>

                  {errorBlock}
                  {noticeBlock}

                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    <div className="flex items-center gap-2">
                      <EnvelopeSimple size={18} />
                      Send reset link
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => goToView('auth', forgotEmail.trim())}
                    disabled={isSubmitting}
                  >
                    <div className="flex items-center gap-2">
                      <ArrowLeft size={16} />
                      Back to sign in
                    </div>
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirm new password</Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      placeholder="Re-enter password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                    />
                  </div>

                  {errorBlock}

                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || !resetToken}>
                    <div className="flex items-center gap-2">
                      <Key size={18} />
                      Update password
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      window.history.replaceState({}, '', '/');
                      goToView(resetToken ? 'auth' : 'forgot');
                    }}
                    disabled={isSubmitting}
                  >
                    <div className="flex items-center gap-2">
                      <ArrowLeft size={16} />
                      {resetToken ? 'Back to sign in' : 'Request a new link'}
                    </div>
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <ShieldCheck size={20} />
              Account Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value as 'signin' | 'register'); clearFeedback(); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        onClick={() => goToView('forgot', signInEmail.trim())}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                    />
                  </div>

                  {errorBlock}

                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    <div className="flex items-center gap-2">
                      <SignIn size={18} />
                      Sign In
                    </div>
                  </Button>
                  <Button type="button" variant="outline" className="w-full" size="lg" onClick={handlePasskeySignIn} disabled={isSubmitting}>
                    <div className="flex items-center gap-2">
                      <Key size={18} />
                      Use Passkey
                    </div>
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-display-name">Display Name</Label>
                    <Input
                      id="register-display-name"
                      placeholder="Your display name"
                      value={registerDisplayName}
                      onChange={(e) => setRegisterDisplayName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="you@example.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="At least 8 characters"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password">Confirm Password</Label>
                    <Input
                      id="register-confirm-password"
                      type="password"
                      placeholder="Re-enter password"
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    />
                  </div>

                  {errorBlock}

                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    <div className="flex items-center gap-2">
                      <User size={18} />
                      Create Account
                    </div>
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="text-center mt-4">
              <div className="flex justify-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Secure sessions
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Optional passkeys
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

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
