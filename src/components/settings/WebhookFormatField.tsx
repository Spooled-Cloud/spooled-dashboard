import { Label } from '@/components/ui/label';
import { WEBHOOK_FORMATS } from '@/lib/api/webhooks';
import type { WebhookFormat } from '@/lib/api/webhooks';

interface WebhookFormatFieldProps {
  id: string;
  value: WebhookFormat;
  onChange: (value: WebhookFormat) => void;
  disabled?: boolean;
}

/** Format picker of the create and edit webhook dialogs (JSON, Slack, Discord, Teams). */
export function WebhookFormatField({ id, value, onChange, disabled }: WebhookFormatFieldProps) {
  const selected = WEBHOOK_FORMATS.find((format) => format.value === value);
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Format</Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as WebhookFormat)}
        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {WEBHOOK_FORMATS.map((format) => (
          <option key={format.value} value={format.value}>
            {format.label}
          </option>
        ))}
      </select>
      {selected && <p className="text-xs text-muted-foreground">{selected.description}</p>}
      {value !== 'json' && (
        <p className="text-xs text-muted-foreground">
          Chat services do not verify signatures. A secret is still sent as{' '}
          <code className="rounded bg-muted px-1">X-Spooled-Signature</code>, but the message itself
          carries no Spooled envelope.
        </p>
      )}
    </div>
  );
}
