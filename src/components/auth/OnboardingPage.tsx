import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  Loader2,
  Building2,
  Key,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { organizationsAPI } from '@/lib/api/organizations';
import type { CreateOrganizationResponse } from '@/lib/api/organizations';

export function OnboardingPage() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreateOrganizationResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    const generatedSlug = value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  };

  const handleCopyKey = async () => {
    if (result?.api_key.key) {
      await navigator.clipboard.writeText(result.api_key.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await organizationsAPI.create(
        {
          name,
          slug,
          billing_email: billingEmail || undefined,
        },
        {
          adminKey: adminKey || undefined,
        }
      );

      setResult(response);
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

  // Success screen with API key
  if (result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-6">
              <img src="/logo-horizontal.webp" alt="Spooled Cloud" className="mx-auto h-16" />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                Organization Created!
              </CardTitle>
              <CardDescription>
                Your organization <strong>{result.organization.name}</strong> has been set up
                successfully
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Warning about saving the key */}
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>Important:</strong> Save your API key now! This is the only time it will
                  be shown. You'll need it to log in.
                </AlertDescription>
              </Alert>

              {/* API Key Display */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Your API Key
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={result.api_key.key}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyKey}
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Key name: {result.api_key.name}
                </p>
              </div>

              {/* Organization Info */}
              <div className="rounded-md bg-muted p-4 space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Organization:</span>{' '}
                  <strong>{result.organization.name}</strong>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Slug:</span>{' '}
                  <code className="rounded bg-background px-1">{result.organization.slug}</code>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Plan:</span> {result.organization.plan_tier}
                </p>
              </div>

              {/* Next Steps */}
              <div className="space-y-3">
                <h4 className="font-medium">Next Steps:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>
                    <strong>Copy and save</strong> your API key somewhere secure
                  </li>
                  <li>
                    <strong>Go to login</strong> and paste your API key to sign in
                  </li>
                  <li>
                    <strong>Create additional API keys</strong> in Settings → API Keys
                  </li>
                </ol>
              </div>

              <Button asChild className="w-full">
                <a href="/">Go to Login</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Form screen
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
              Enter your organization information. An API key will be generated for you.
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
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  title="Only lowercase letters, numbers, and hyphens (cannot start or end with hyphen)"
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
                  Already have an API key? Sign in
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
