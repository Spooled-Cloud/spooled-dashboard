import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface QueueMetrics {
  name: string;
  throughput: number;
  avgProcessingTime: number;
  errorRate: number;
}

interface QueuePerformanceChartProps {
  data?: QueueMetrics[];
  metric?: 'throughput' | 'avgProcessingTime' | 'errorRate';
}

export function QueuePerformanceChart({ data, metric = 'throughput' }: QueuePerformanceChartProps) {
  // Show empty state if no data
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
        <BarChart3 className="mb-2 h-8 w-8 opacity-50" />
        <p className="text-sm">No queue data available</p>
        <p className="text-xs">Queue metrics will appear here</p>
      </div>
    );
  }

  const chartData = data;

  const getColor = (value: number, metric: string) => {
    if (metric === 'errorRate') {
      if (value < 2) return '#10b981';
      if (value < 5) return '#fbbf24';
      return '#ef4444';
    }
    if (metric === 'avgProcessingTime') {
      if (value < 200) return '#10b981';
      if (value < 500) return '#fbbf24';
      return '#ef4444';
    }
    return '#3b82f6';
  };

  const metricConfig = {
    throughput: {
      label: 'Throughput (jobs/min)',
      dataKey: 'throughput',
      unit: ' j/min',
    },
    avgProcessingTime: {
      label: 'Avg. Processing Time (ms)',
      dataKey: 'avgProcessingTime',
      unit: 'ms',
    },
    errorRate: {
      label: 'Error Rate (%)',
      dataKey: 'errorRate',
      unit: '%',
    },
  };

  const config = metricConfig[metric];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="mb-2 text-sm font-medium">{data.name}</p>
          <div className="space-y-1 text-xs">
            <p>
              <span className="text-muted-foreground">Throughput:</span>{' '}
              <span className="font-medium">{data.throughput} j/min</span>
            </p>
            <p>
              <span className="text-muted-foreground">Avg. Time:</span>{' '}
              <span className="font-medium">{data.avgProcessingTime}ms</span>
            </p>
            <p>
              <span className="text-muted-foreground">Error Rate:</span>{' '}
              <span className="font-medium">{data.errorRate}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" tick={{ fontSize: 12 }} className="text-muted-foreground" />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px' }}
          content={() => (
            <div className="mb-2 text-center text-sm text-muted-foreground">{config.label}</div>
          )}
        />
        <Bar dataKey={config.dataKey} radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={getColor(entry[config.dataKey as keyof QueueMetrics] as number, metric)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
