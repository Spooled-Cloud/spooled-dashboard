import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Building2, Key } from 'lucide-react';
import { organizationsAPI, type CreateOrganizationRequest } from '@/lib/api/organizations';

export function OnboardingPage() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    // Generate slug: lowercase, replace spaces with hyphens, remove special chars
    const generatedSlug = value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const request: CreateOrganizationRequest = {
        name,
        slug,
        billing_email: billingEmail || undefined,
      };

      await organizationsAPI.create(request, {
        adminKey: adminKey || undefined,
      });

      setSuccess(true);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create organization. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-6">
              <img src="/logo-horizontal.webp" alt="Spooled Cloud" className="mx-auto h-16" />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-green-500" />
                Organization Created!
              </CardTitle>
              <CardDescription>Your organization has been set up successfully</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm font-medium">Organization: {name}</p>
                <p className="text-sm text-muted-foreground">Slug: {slug}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Next, you'll need to create an API key to access the API and dashboard. Use the API
                or CLI to generate your first API key.
              </p>
              <Button asChild className="w-full">
                <a href="/">Go to Login</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="mx-auto mb-6">
            <img src="/logo-horizontal.webp" alt="Spooled Cloud" className="mx-auto h-16" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Create Organization</h1>
          <p className="mt-2 text-muted-foreground">Set up your organization to get started</p>
        </div>

        {/* Onboarding Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Details
            </CardTitle>
            <CardDescription>
              Enter your organization information to create your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="My Company"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  type="text"
                  placeholder="my-company"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  disabled={isLoading}
                  pattern="[a-z0-9-]+"
                  title="Only lowercase letters, numbers, and hyphens"
                />
                <p className="text-xs text-muted-foreground">
                  Used in URLs and API endpoints. Only lowercase letters, numbers, and hyphens.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingEmail">Billing Email (optional)</Label>
                <Input
                  id="billingEmail"
                  type="email"
                  placeholder="billing@example.com"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {/* Admin Key Section */}
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdminKey(!showAdminKey)}
                  className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Admin Access
                  </span>
                  <span>{showAdminKey ? '−' : '+'}</span>
                </button>

                {showAdminKey && (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="adminKey">Admin API Key</Label>
                    <Input
                      id="adminKey"
                      type="password"
                      placeholder="Enter admin key..."
                      value={adminKey}
                      onChange={(e) => setAdminKey(e.target.value)}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required when public registration is disabled (REGISTRATION_MODE=closed)
                    </p>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !name || !slug}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Organization'
                )}
              </Button>

              <div className="text-center">
                <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
                  Already have an account? Sign in
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
