import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Key, Mail } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { EmailLoginStartResponse, EmailLoginVerifyResponse, LoginResponse } from '@/lib/types';

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

      setAuth(response);

      // Check if there's a redirect path stored from before login
      const redirectPath = sessionStorage.getItem('redirect_after_login');
      sessionStorage.removeItem('redirect_after_login');

      // Small delay to ensure state is persisted before navigation
      setTimeout(() => {
        window.location.href = redirectPath || '/dashboard';
      }, 100);
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
      const response = await apiClient.post<EmailLoginVerifyResponse>(
        API_ENDPOINTS.AUTH.EMAIL_VERIFY,
        { email, code },
        { skipAuth: true }
      );

      // Email auth returns the same token shape as normal login
      const login: LoginResponse = {
        access_token: response.access_token,
        refresh_token: response.refresh_token,
        token_type: response.token_type,
        expires_in: response.expires_in,
        refresh_expires_in: response.refresh_expires_in,
      };

      setAuth(login);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="mx-auto mb-6">
            <img src="/logo-horizontal.webp" alt="Spooled Cloud" className="mx-auto h-16" />
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
                    placeholder="sk_live_..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                    disabled={isLoading}
                    className="mt-1 font-mono"
                    autoComplete="current-password"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your API key starts with sk_live_ or sk_test_
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
      </div>
    </div>
  );
}
