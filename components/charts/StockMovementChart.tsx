'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StockMovementChartProps {
  data: Array<{
    date: string;
    inbound: number;
    outbound: number;
    scrap: number;
  }>;
}

export default function StockMovementChart({ data }: StockMovementChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="inbound" stroke="#22c55e" name="Inbound" strokeWidth={2} />
        <Line type="monotone" dataKey="outbound" stroke="#3b82f6" name="Outbound" strokeWidth={2} />
        <Line type="monotone" dataKey="scrap" stroke="#ef4444" name="Scrap" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
