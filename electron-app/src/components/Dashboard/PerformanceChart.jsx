import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Box, Typography, useTheme } from '@mui/material';

const PerformanceChart = ({ data }) => {
  const theme = useTheme();

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Real-time System Performance
      </Typography>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 0,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis 
            dataKey="time" 
            stroke="rgba(255,255,255,0.5)" 
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis 
            domain={[0, 100]} 
            stroke="rgba(255,255,255,0.5)" 
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
            tickLine={false}
            unit="%"
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e1e1e', 
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px'
            }}
            itemStyle={{ color: '#fff' }}
            labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '5px' }}
          />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          
          <Line 
            type="monotone" 
            dataKey="cpu" 
            name="CPU Usage" 
            stroke="#00bcd4" 
            strokeWidth={3} 
            dot={false} 
            activeDot={{ r: 6 }} 
            isAnimationActive={false} // Disable animation for smoother real-time updates
          />
          <Line 
            type="monotone" 
            dataKey="memory" 
            name="Memory Usage" 
            stroke="#66bb6a" 
            strokeWidth={3} 
            dot={false} 
            activeDot={{ r: 6 }} 
            isAnimationActive={false}
          />
          {/* Render GPU line only if data exists */}
          {data.length > 0 && data[0].gpu !== undefined && (
            <Line 
              type="monotone" 
              dataKey="gpu" 
              name="GPU Usage" 
              stroke="#ef5350" 
              strokeWidth={3} 
              dot={false} 
              activeDot={{ r: 6 }} 
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default PerformanceChart;
