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
import { format, subHours, startOfHour } from 'date-fns';

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

function generateMockData(hours: number): JobsOverTimeData[] {
  const data: JobsOverTimeData[] = [];
  const now = new Date();

  for (let i = hours; i >= 0; i--) {
    const timestamp = startOfHour(subHours(now, i));
    data.push({
      timestamp: timestamp.toISOString(),
      created: Math.floor(Math.random() * 100) + 20,
      completed: Math.floor(Math.random() * 80) + 15,
      failed: Math.floor(Math.random() * 20),
    });
  }

  return data;
}

export function JobsOverTimeChart({ data, timeRange = '24h' }: JobsOverTimeChartProps) {
  const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;

  const chartData = useMemo(() => {
    const mockData = data || generateMockData(hours);
    return mockData.map((item) => ({
      ...item,
      time: format(new Date(item.timestamp), timeRange === '24h' ? 'HH:mm' : 'MMM dd'),
    }));
  }, [data, hours, timeRange]);

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
