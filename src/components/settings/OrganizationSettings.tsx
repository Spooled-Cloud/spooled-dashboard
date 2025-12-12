import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsAPI } from '@/lib/api/organizations';
import type { UpdateOrganizationRequest, OrganizationMember } from '@/lib/api/organizations';
import { useAuthStore } from '@/stores/auth';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import { Save, Loader2, Building, Users, Crown, Shield, User } from 'lucide-react';
import { UsageWidget } from '@/components/usage/UsageWidget';
import { toast } from 'sonner';

function MemberRoleBadge({ role }: { role: OrganizationMember['role'] }) {
  switch (role) {
    case 'owner':
      return (
        <Badge className="border-amber-500 bg-amber-500/10 text-amber-700">
          <Crown className="mr-1 h-3 w-3" />
          Owner
        </Badge>
      );
    case 'admin':
      return (
        <Badge className="border-blue-500 bg-blue-500/10 text-blue-700">
          <Shield className="mr-1 h-3 w-3" />
          Admin
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <User className="mr-1 h-3 w-3" />
          Member
        </Badge>
      );
  }
}

function OrganizationSettingsContent() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const orgId = currentOrganization?.id;

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: queryKeys.organizations.detail(orgId || ''),
    queryFn: () => organizationsAPI.get(orgId!),
    enabled: !!orgId,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.organizations.members(orgId || ''),
    queryFn: () => organizationsAPI.getMembers(orgId!),
    enabled: !!orgId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateOrganizationRequest) => organizationsAPI.update(orgId!, data),
    onSuccess: () => {
      toast.success('Organization updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(orgId!) });
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error('Failed to update organization', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleEdit = () => {
    if (org) {
      setName(org.name);
      setDescription('');
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setName('');
    setDescription('');
  };

  if (!orgId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Building className="mx-auto mb-3 h-12 w-12 opacity-50" />
        <p className="mb-1 text-lg font-medium">No organization selected</p>
        <p className="text-sm">Please select an organization to view settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-muted-foreground">Manage your organization details and members</p>
      </div>

      {/* Organization Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>Basic information about your organization</CardDescription>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {orgLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : org ? (
            <>
              <div className="grid gap-2">
                <Label>Organization Name</Label>
                {isEditing ? (
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Organization name"
                  />
                ) : (
                  <p className="text-sm font-medium">{org.name}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Description</Label>
                {isEditing ? (
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    className="min-h-[80px]"
                  />
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <Label className="text-muted-foreground">Slug</Label>
                  <p className="font-mono text-sm">{org.slug}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Plan</Label>
                  <Badge variant="outline" className="mt-1">
                    {org.plan_tier.charAt(0).toUpperCase() + org.plan_tier.slice(1)}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Billing Email</Label>
                  <p className="text-sm font-medium">{org.billing_email || 'Not set'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="text-sm">{formatRelativeTime(org.created_at)}</p>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Usage & Limits */}
      <UsageWidget />

      {/* Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Members
              </CardTitle>
              <CardDescription>People who have access to this organization</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : members && members.length > 0 ? (
            <div className="divide-y">
              {members.map((member) => (
                <div key={member.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{member.name}</p>
                        <MemberRoleBadge role={member.role} />
                      </div>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Joined {formatRelativeTime(member.joined_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No members found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function OrganizationSettingsPage() {
  return (
    <ProtectedPage>
      <OrganizationSettingsContent />
    </ProtectedPage>
  );
}
