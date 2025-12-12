import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Key } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { LoginResponse } from '@/lib/types';

export function LoginPage() {
  const [apiKey, setApiKey] = useState('');
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
      window.location.href = redirectPath || '/dashboard';
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Login failed. Please check your API key.'
      );
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
              <Key className="h-5 w-5" />
              Sign In
            </CardTitle>
            <CardDescription>Enter your API key to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
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

              <div className="text-center">
                <a
                  href="/onboarding"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Need to create an organization?
                </a>
              </div>
            </form>
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
