import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Legend,
  Tooltip,
  Filler,
  CategoryScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Legend, Tooltip, Filler, CategoryScale);

export default function ChartPanel({ title = 'Chart', series = [], onRemoveSeries, height = 260 }) {
  const data = {
    datasets: series.map(s => ({
      label: s.label,
      data: (s.points || []).map(p => ({ x: p.ts, y: p.value })),
      borderColor: s.color || 'rgb(37, 99, 235)',
      backgroundColor: (s.color || 'rgb(37, 99, 235)') + '22',
      fill: false,
      pointRadius: 2,
      tension: 0.25,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const s = series[ctx.datasetIndex];
            const unit = s?.unit ? ` ${s.unit}` : '';
            return `${ctx.dataset.label}: ${ctx.parsed.y}${unit}`;
          }
        }
      }
    },
    scales: {
      x: { type: 'time', time: { tooltipFormat: 'PPpp' }, ticks: { maxRotation: 0 } },
      y: { beginAtZero: false }
    }
  };

  return (
    <div className="border rounded-md bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="font-medium text-sm">{title}</div>
        {onRemoveSeries && (
          <div className="text-xs text-gray-500">{series.length} serie(s)</div>
        )}
      </div>
      <div className="p-2" style={{ height }}>
        <Line data={data} options={options} />
      </div>
      {onRemoveSeries && series.length > 0 && (
        <div className="px-3 py-2 border-t flex flex-wrap gap-2 text-xs">
          {series.map((s, i) => (
            <button key={s.id}
              className="inline-flex items-center gap-1 px-2 py-1 border rounded hover:bg-gray-50"
              onClick={() => onRemoveSeries(s.id)}
              title="Remove series">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color || '#2563eb' }} />
              <span>{s.label}</span>
              <span>×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}