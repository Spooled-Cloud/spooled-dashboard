import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, subMinutes } from 'date-fns';

interface ProcessingRateData {
  timestamp: string;
  jobsPerSecond: number;
}

interface ProcessingRateChartProps {
  data?: ProcessingRateData[];
  realtime?: boolean;
}

export function ProcessingRateChart({ data, realtime = true }: ProcessingRateChartProps) {
  const [chartData, setChartData] = useState<ProcessingRateData[]>(() => {
    if (data) return data;

    const initialData: ProcessingRateData[] = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      initialData.push({
        timestamp: subMinutes(now, i).toISOString(),
        jobsPerSecond: Math.random() * 10 + 5,
      });
    }
    return initialData;
  });

  useEffect(() => {
    if (!realtime || data) return;

    const interval = setInterval(() => {
      setChartData((prev) => {
        const newPoint = {
          timestamp: new Date().toISOString(),
          jobsPerSecond: Math.random() * 10 + 5,
        };

        const updated = [...prev.slice(1), newPoint];
        return updated;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [realtime, data]);

  const displayData = data || chartData;
  const formattedData = displayData.map((item) => ({
    ...item,
    time: format(new Date(item.timestamp), 'HH:mm:ss'),
  }));

  const average =
    displayData.reduce((sum, item) => sum + item.jobsPerSecond, 0) / displayData.length;
  const peak = Math.max(...displayData.map((item) => item.jobsPerSecond));

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: { timestamp: string } }>;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="mb-1 text-xs text-muted-foreground">
            {format(new Date(payload[0].payload.timestamp), 'HH:mm:ss')}
          </p>
          <p className="text-lg font-bold">
            {payload[0].value.toFixed(2)}{' '}
            <span className="text-sm text-muted-foreground">jobs/sec</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mb-2 flex gap-4 text-xs">
        <div>
          <span className="text-muted-foreground">Average: </span>
          <span className="font-medium">{average.toFixed(2)} j/s</span>
        </div>
        <div>
          <span className="text-muted-foreground">Peak: </span>
          <span className="font-medium">{peak.toFixed(2)} j/s</span>
        </div>
        {realtime && !data && (
          <div className="ml-auto flex items-center gap-1">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-muted-foreground">Live</span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={formattedData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" domain={[0, 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="jobsPerSecond"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRate)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
