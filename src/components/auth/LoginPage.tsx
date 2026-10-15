import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Key, Mail } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { consumeReturnPath } from '@/stores/return-path';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { EmailLoginStartResponse, LoginResponse } from '@/lib/types';

/** POST /auth/email/verify is a tagged union: login tokens or a signup token. */
export function loginTokensFromEmailVerify(response: {
  type?: string;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  unverified_org_exists?: boolean;
}): LoginResponse | 'signup' | 'unconfirmed' | null {
  if (response.type === 'signup') {
    // An org uses this address but never confirmed it, so email login cannot
    // open it (backend 0.1.117). Its owner signs in with an API key instead.
    return response.unverified_org_exists ? 'unconfirmed' : 'signup';
  }
  if (typeof response.access_token !== 'string' || response.access_token.length === 0) {
    return null;
  }
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token ?? '',
    token_type: response.token_type ?? 'Bearer',
    expires_in: response.expires_in ?? 0,
    refresh_expires_in: response.refresh_expires_in ?? 0,
  };
}

export function LoginPage() {
  const [apiKey, setApiKey] = useState('');
  const [mode, setMode] = useState<'api_key' | 'email'>('api_key');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailStep, setEmailStep] = useState<'start' | 'verify'>('start');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await apiClient.post<LoginResponse>(
        API_ENDPOINTS.AUTH.LOGIN,
        { api_key: apiKey },
        { skipAuth: true }
      );

      // Persist the new organization before leaving. Navigating sooner left the
      // previous org's name in storage, and the next page would not fetch again.
      await setAuth(response);

      // Return to the page the user was sent away from (same-origin paths only).
      const redirectPath = consumeReturnPath();
      window.location.href = redirectPath || '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await apiClient.post<EmailLoginStartResponse>(
        API_ENDPOINTS.AUTH.EMAIL_START,
        { email },
        { skipAuth: true }
      );
      setEmailStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start email login.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await apiClient.post<{
        type?: string;
        access_token?: string;
        refresh_token?: string;
        token_type?: string;
        expires_in?: number;
        refresh_expires_in?: number;
        unverified_org_exists?: boolean;
      }>(API_ENDPOINTS.AUTH.EMAIL_VERIFY, { email, code }, { skipAuth: true });

      const login = loginTokensFromEmailVerify(response);
      if (login === 'unconfirmed') {
        setError(
          'An organization uses this email but has not confirmed it yet, so email sign-in cannot open it. Sign in with its API key, then confirm the address under Settings → Organization.'
        );
        return;
      }
      if (login === 'signup') {
        setError('No account found for this email. Sign in with an API key instead.');
        return;
      }
      if (!login) {
        setError('Invalid email or code.');
        return;
      }

      await setAuth(login);
      const redirectPath = consumeReturnPath();
      window.location.href = redirectPath || '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="to-muted/30 flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background p-6">
      <main id="main-content" tabIndex={-1} className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="mx-auto mb-6">
            <img src="/logo-horizontal.svg" alt="Spooled Cloud" className="mx-auto h-16" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">Job Queue Management System</p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {mode === 'api_key' ? <Key className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
              {mode === 'api_key' ? 'Sign In' : 'Recover Access'}
            </CardTitle>
            <CardDescription>
              {mode === 'api_key'
                ? 'Enter your API key to access the dashboard'
                : 'Request a one-time code to sign in via email'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'api_key' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <label htmlFor="apiKey" className="text-sm font-medium">
                    API Key
                  </label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sp_live_..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                    disabled={isLoading}
                    className="mt-1 font-mono"
                    autoComplete="current-password"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your API key starts with sp_live_ or sp_test_
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading || !apiKey}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('email');
                      setEmailStep('start');
                      setEmail('');
                      setCode('');
                      setError('');
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </button>

                  <a
                    href="/onboarding"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Need to create an organization?
                  </a>
                </div>
              </form>
            ) : (
              <form
                onSubmit={emailStep === 'start' ? handleEmailStart : handleEmailVerify}
                className="space-y-4"
              >
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading || emailStep === 'verify'}
                    className="mt-1"
                    autoComplete="email"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    We’ll send a 6-digit code to this email (always returns success to prevent
                    enumeration).
                  </p>
                </div>

                {emailStep === 'verify' ? (
                  <div>
                    <label htmlFor="code" className="text-sm font-medium">
                      Code
                    </label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                      disabled={isLoading}
                      className="mt-1 font-mono tracking-widest"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Codes expire in ~15 minutes.
                    </p>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !email || (emailStep === 'verify' && code.length < 4)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {emailStep === 'start' ? 'Sending code...' : 'Verifying...'}
                    </>
                  ) : emailStep === 'start' ? (
                    'Send code'
                  ) : (
                    'Verify & sign in'
                  )}
                </Button>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('api_key');
                      setError('');
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Back to API key login
                  </button>

                  {emailStep === 'verify' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailStep('start');
                        setCode('');
                        setError('');
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Resend code
                    </button>
                  ) : null}
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Real-time job monitoring • Queue management • Worker oversight • Workflow orchestration
          </p>
        </div>
      </main>
    </div>
  );
}
