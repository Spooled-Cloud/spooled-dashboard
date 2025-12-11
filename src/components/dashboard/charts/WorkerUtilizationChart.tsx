import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface WorkerUtilization {
  name: string;
  active: number;
  idle: number;
  capacity: number;
}

interface WorkerUtilizationChartProps {
  data?: WorkerUtilization[];
}

export function WorkerUtilizationChart({ data }: WorkerUtilizationChartProps) {
  const mockData: WorkerUtilization[] = [
    { name: 'worker-1', active: 8, idle: 2, capacity: 10 },
    { name: 'worker-2', active: 5, idle: 5, capacity: 10 },
    { name: 'worker-3', active: 15, idle: 5, capacity: 20 },
    { name: 'worker-4', active: 3, idle: 7, capacity: 10 },
    { name: 'worker-5', active: 12, idle: 8, capacity: 20 },
    { name: 'worker-6', active: 4, idle: 1, capacity: 5 },
  ];

  const chartData = (data || mockData).map((worker) => ({
    ...worker,
    utilization: ((worker.active / worker.capacity) * 100).toFixed(0),
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="mb-2 text-sm font-medium">{data.name}</p>
          <div className="space-y-1 text-xs">
            <p className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-blue-500" />
              <span className="text-muted-foreground">Active:</span>
              <span className="font-medium">{data.active}</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-gray-300" />
              <span className="text-muted-foreground">Idle:</span>
              <span className="font-medium">{data.idle}</span>
            </p>
            <p className="mt-1 border-t pt-1">
              <span className="text-muted-foreground">Utilization:</span>{' '}
              <span className="font-medium">{data.utilization}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          label={{ value: 'Jobs', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px' }} iconType="square" />
        <Bar dataKey="active" stackId="a" fill="#3b82f6" name="Active" radius={[0, 0, 0, 0]} />
        <Bar dataKey="idle" stackId="a" fill="#d1d5db" name="Idle" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
