import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp } from 'lucide-react';

interface JobsOverTimeData {
  timestamp: string;
  created: number;
  completed: number;
  failed: number;
}

interface JobsOverTimeChartProps {
  data?: JobsOverTimeData[];
  timeRange?: '24h' | '7d' | '30d';
}

export function JobsOverTimeChart({ data, timeRange = '24h' }: JobsOverTimeChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item) => ({
      ...item,
      time: format(new Date(item.timestamp), timeRange === '24h' ? 'HH:mm' : 'MMM dd'),
    }));
  }, [data, timeRange]);

  // Show empty state if no data
  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
        <TrendingUp className="mb-2 h-8 w-8 opacity-50" />
        <p className="text-sm">No job data available</p>
        <p className="text-xs">Jobs will appear here once processed</p>
      </div>
    );
  }

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: { timestamp: string } }>;
  }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0]?.payload;
      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="mb-2 text-sm font-medium">
            {data?.timestamp ? format(new Date(data.timestamp), 'MMM dd, HH:mm') : 'N/A'}
          </p>
          <div className="space-y-1">
            {payload[0] && (
              <p className="flex items-center gap-2 text-xs">
                <span className="h-3 w-3 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">Created:</span>
                <span className="font-medium">{payload[0].value}</span>
              </p>
            )}
            {payload[1] && (
              <p className="flex items-center gap-2 text-xs">
                <span className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Completed:</span>
                <span className="font-medium">{payload[1].value}</span>
              </p>
            )}
            {payload[2] && (
              <p className="flex items-center gap-2 text-xs">
                <span className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Failed:</span>
                <span className="font-medium">{payload[2].value}</span>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="time" tick={{ fontSize: 12 }} className="text-muted-foreground" />
        <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
        <Line
          type="monotone"
          dataKey="created"
          name="Created"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="completed"
          name="Completed"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="failed"
          name="Failed"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
