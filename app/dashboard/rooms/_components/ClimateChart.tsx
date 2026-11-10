'use client';

/**
 * ClimateChart — Recharts line chart for room sensor history.
 * Temperature (and optionally humidity on a right axis) with ReferenceLine
 * guides at the room's configured temp_min/temp_max.
 */

import {
  Line,
  LineChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SensorReadingDTO } from '@/lib/storerooms/types';

interface ClimateChartProps {
  readings: SensorReadingDTO[];
  tempMin: number | null;
  tempMax: number | null;
  showHumidity?: boolean;
}

interface Point {
  t: number;
  label: string;
  temperature?: number;
  humidity?: number;
}

export default function ClimateChart({
  readings,
  tempMin,
  tempMax,
  showHumidity = true,
}: ClimateChartProps) {
  const data: Point[] = readings.map((r) => {
    const d = new Date(r.recorded_at);
    return {
      t: d.getTime(),
      label: d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      ...(r.metric === 'temperature' ? { temperature: r.value } : {}),
      ...(r.metric === 'humidity' ? { humidity: r.value } : {}),
    };
  });

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        No sensor readings yet — run the simulator or ingest device data.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            minTickGap={40}
          />
          <YAxis
            yAxisId="temp"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            domain={['auto', 'auto']}
            unit="°"
          />
          {showHumidity && (
            <YAxis
              yAxisId="rh"
              orientation="right"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              domain={[0, 100]}
              unit="%"
            />
          )}
          <Tooltip />
          {tempMin !== null && (
            <ReferenceLine
              yAxisId="temp"
              y={tempMin}
              stroke="hsl(var(--info))"
              strokeDasharray="4 4"
              label={{ value: `min ${tempMin}°`, fontSize: 10, fill: 'hsl(var(--info))' }}
            />
          )}
          {tempMax !== null && (
            <ReferenceLine
              yAxisId="temp"
              y={tempMax}
              stroke="hsl(var(--destructive))"
              strokeDasharray="4 4"
              label={{ value: `max ${tempMax}°`, fontSize: 10, fill: 'hsl(var(--destructive))' }}
            />
          )}
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temperature"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            connectNulls
            name="Temp °C"
          />
          {showHumidity && (
            <Line
              yAxisId="rh"
              type="monotone"
              dataKey="humidity"
              stroke="hsl(var(--lavender))"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              name="Humidity %RH"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
