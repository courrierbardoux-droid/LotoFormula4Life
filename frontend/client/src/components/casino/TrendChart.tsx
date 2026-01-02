
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendChartProps {
  data: { name: string; value: number }[];
  color?: string;
}

export const TrendChart = ({ data, color = "#FFD700" }: TrendChartProps) => {
  return (
    <div className="w-full h-[200px] bg-black/50 border border-zinc-800 rounded p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="name" stroke="#666" fontSize={10} tick={{fill: '#666'}} />
          <YAxis stroke="#666" fontSize={10} tick={{fill: '#666'}} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }}
            itemStyle={{ color: color }}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={2} 
            dot={{ r: 2, fill: color }}
            activeDot={{ r: 5, fill: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
