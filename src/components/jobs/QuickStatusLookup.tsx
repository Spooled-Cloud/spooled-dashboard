import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { JobStatusBadge } from '@/components/ui/status-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useMutation } from '@tanstack/react-query';
import { jobsAPI, type BatchJobStatus } from '@/lib/api/jobs';
import { formatJobId, formatRelativeTime } from '@/lib/utils/format';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { CopyButton } from '@/components/ui/data-table';
import { toast } from 'sonner';

export function QuickStatusLookup() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<BatchJobStatus[] | null>(null);

  const lookupMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return jobsAPI.batchStatus(ids);
    },
    onSuccess: (data) => {
      setResults(data);
      if (data.length === 0) {
        toast.info('No jobs found', { description: 'None of the provided IDs matched any jobs' });
      }
    },
    onError: (error) => {
      toast.error('Lookup failed', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleLookup = () => {
    // Parse job IDs from input (comma, newline, or space separated)
    const ids = input
      .split(/[,\n\s]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (ids.length === 0) {
      toast.warning('No job IDs provided', { description: 'Enter at least one job ID' });
      return;
    }

    if (ids.length > 100) {
      toast.warning('Too many IDs', { description: 'Maximum 100 job IDs per lookup' });
      return;
    }

    lookupMutation.mutate(ids);
  };

  const handleReset = () => {
    setInput('');
    setResults(null);
  };

  const statusSummary = results
    ? results.reduce(
        (acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      )
    : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Search className="mr-2 h-4 w-4" />
          Quick Lookup
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quick Job Status Lookup</DialogTitle>
          <DialogDescription>
            Paste up to 100 job IDs (comma, newline, or space separated) to check their status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Textarea
              placeholder="Paste job IDs here...&#10;&#10;e.g.&#10;550e8400-e29b-41d4-a716-446655440000&#10;job_abc123, job_def456"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-32 font-mono text-sm"
              disabled={lookupMutation.isPending}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {input.split(/[,\n\s]+/).filter((id) => id.trim().length > 0).length} ID(s) detected
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleLookup} disabled={lookupMutation.isPending || !input.trim()}>
              {lookupMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Looking up...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Lookup Status
                </>
              )}
            </Button>
            {results && (
              <Button variant="outline" onClick={handleReset}>
                Clear
              </Button>
            )}
          </div>

          {/* Results */}
          {results && results.length > 0 && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex flex-wrap gap-2 rounded-lg bg-muted/50 p-3">
                <span className="text-sm font-medium">Summary:</span>
                {Object.entries(statusSummary).map(([status, count]) => (
                  <Badge key={status} variant="outline" className="text-xs">
                    {status}: {count}
                  </Badge>
                ))}
              </div>

              {/* Results Table */}
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur-sm">
                    <tr>
                      <th className="p-2 text-left font-medium">Job ID</th>
                      <th className="p-2 text-left font-medium">Status</th>
                      <th className="p-2 text-left font-medium">Queue</th>
                      <th className="p-2 text-center font-medium">Attempt</th>
                      <th className="p-2 text-left font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.map((job) => (
                      <tr key={job.id} className="hover:bg-muted/30">
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <a
                              href={`/jobs/${job.id}`}
                              className="font-mono text-xs hover:text-primary hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {formatJobId(job.id, 12)}
                            </a>
                            <CopyButton value={job.id} />
                          </div>
                        </td>
                        <td className="p-2">
                          <JobStatusBadge status={job.status} size="sm" />
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">
                            {job.queue_name}
                          </Badge>
                        </td>
                        <td className="p-2 text-center text-xs text-muted-foreground">
                          {job.attempt}/{job.max_retries}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {formatRelativeTime(job.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {results && results.length === 0 && (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 p-6 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              <span>No matching jobs found</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
