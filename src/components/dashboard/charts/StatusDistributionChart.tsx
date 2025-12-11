import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { JobStatus } from '@/lib/types';

interface StatusData {
  name: string;
  value: number;
  status: JobStatus;
}

interface StatusDistributionChartProps {
  data?: Record<JobStatus, number>;
}

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: '#fbbf24',
  scheduled: '#60a5fa',
  processing: '#3b82f6',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#6b7280',
  deadletter: '#dc2626',
};

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  deadletter: 'Dead Letter',
};

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
  const mockData: Record<JobStatus, number> = {
    pending: 45,
    scheduled: 12,
    processing: 8,
    completed: 234,
    failed: 15,
    cancelled: 5,
    deadletter: 2,
  };

  const statusData = data || mockData;

  const chartData: StatusData[] = Object.entries(statusData)
    .filter(([_, value]) => value > 0)
    .map(([status, value]) => ({
      name: STATUS_LABELS[status as JobStatus],
      value,
      status: status as JobStatus,
    }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.value / total) * 100).toFixed(1);

      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="mb-1 text-sm font-medium">{data.name}</p>
          <p className="text-lg font-bold">{data.value}</p>
          <p className="text-xs text-muted-foreground">{percentage}% of total</p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;

    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
    const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={CustomLabel}
          outerRadius={80}
          innerRadius={50}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          wrapperStyle={{ fontSize: '12px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
