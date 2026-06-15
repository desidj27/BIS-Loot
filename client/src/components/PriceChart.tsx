import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PriceHistoryPoint } from '@/api/client';

interface PriceChartProps {
  data: PriceHistoryPoint[];
  loading?: boolean;
  interval?: string;
}

const CHART = {
  grid: '#2a241c',
  axis: '#4a4338',
  tick: '#8a7f72',
  tickMuted: '#6b6258',
  tooltipBg: '#171411',
  tooltipBorder: '#4a4338',
  tooltipText: '#ddd6cb',
  legend: '#8a7f72',
  volume: '#5c534a',
  avg: '#d4a054',
  min: '#8a7f72',
  max: '#c9bfb0',
};

function formatTime(timestamp: string, interval?: string): string {
  const date = new Date(timestamp);

  if (interval === '1w') {
    const weekEnd = new Date(date);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${date.toLocaleDateString(undefined, opts)} – ${weekEnd.toLocaleDateString(undefined, opts)}`;
  }

  if (interval === '1d') {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PriceChart({ data, loading, interval }: PriceChartProps) {
  if (loading) {
    return (
      <div className="px-4 py-16 text-center text-sm text-[#8a7f72]">Loading price history…</div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-sm text-[#8a7f72]">
        No price history available for this item.
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    label: formatTime(point.timestamp, interval),
  }));

  return (
    <div className="p-4">
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
          <XAxis
            dataKey="label"
            tick={{ fill: CHART.tick, fontSize: 11 }}
            minTickGap={32}
            stroke={CHART.axis}
          />
          <YAxis
            yAxisId="price"
            tick={{ fill: CHART.tick, fontSize: 11 }}
            stroke={CHART.axis}
            tickFormatter={(v) => `${v}G`}
          />
          <YAxis
            yAxisId="volume"
            orientation="right"
            tick={{ fill: CHART.tickMuted, fontSize: 11 }}
            stroke={CHART.axis}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              background: CHART.tooltipBg,
              border: `1px solid ${CHART.tooltipBorder}`,
              borderRadius: 0,
              color: CHART.tooltipText,
              fontSize: 12,
            }}
            formatter={(value, name) => {
              if (value == null || value === '') return ['—', name];
              if (name === 'Volume') {
                return [Number(value).toLocaleString(), name];
              }
              return [`${Number(value).toLocaleString()}G`, name];
            }}
            labelFormatter={(label) => String(label)}
            labelStyle={{ color: '#c9a86a', fontFamily: 'Cinzel, Georgia, serif' }}
          />
          <Legend wrapperStyle={{ color: CHART.legend, fontSize: 11 }} />
          <Bar
            yAxisId="volume"
            dataKey="volume"
            name="Volume"
            fill={CHART.volume}
            opacity={0.55}
            barSize={8}
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="avg"
            name="Average"
            stroke={CHART.avg}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="min"
            name="Min"
            stroke={CHART.min}
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 4"
            connectNulls
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="max"
            name="Max"
            stroke={CHART.max}
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 4"
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
