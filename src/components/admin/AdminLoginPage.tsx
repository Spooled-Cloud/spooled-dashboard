import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Shield } from 'lucide-react';
import { adminAPI, setAdminKey } from '@/lib/api/admin';

export function AdminLoginPage() {
  const [adminKey, setAdminKeyState] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const isValid = await adminAPI.verifyKey(adminKey);
      if (isValid) {
        setAdminKey(adminKey);
        window.location.href = '/admin';
      } else {
        setError('Invalid admin key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify admin key');
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
          <h1 className="text-3xl font-bold tracking-tight">Admin Portal</h1>
          <p className="mt-2 text-muted-foreground">Platform administration access</p>
        </div>

        {/* Login Card */}
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              Admin Access
            </CardTitle>
            <CardDescription>
              Enter your admin API key to access platform management
            </CardDescription>
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
                <label htmlFor="adminKey" className="text-sm font-medium">
                  Admin API Key
                </label>
                <Input
                  id="adminKey"
                  type="password"
                  placeholder="Enter admin key..."
                  value={adminKey}
                  onChange={(e) => setAdminKeyState(e.target.value)}
                  required
                  disabled={isLoading}
                  className="mt-1 font-mono"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  This is the ADMIN_API_KEY configured on the server
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700"
                disabled={isLoading || !adminKey}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Access Admin Portal
                  </>
                )}
              </Button>

              <div className="text-center">
                <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
                  Back to Dashboard Login
                </a>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Warning */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-center text-sm text-amber-600 dark:text-amber-400">
          <Shield className="mx-auto mb-2 h-5 w-5" />
          <p>Admin access provides full platform control.</p>
          <p className="mt-1 text-xs opacity-75">
            Only authorized personnel should access this portal.
          </p>
        </div>
      </div>
    </div>
  );
}
