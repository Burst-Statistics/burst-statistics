import { useMemo } from '@wordpress/element';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const InsightsGraph = ({data, loading}) => {
  const options = useMemo( () => ({
    responsive: 'true',
    maintainAspectRatio: false,
    cubicInterpolationMode: 'monotone',
    plugins: {
      legend: {
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 13,
            weight: 400
          }
        }
      }
    },
    scales: {
      y: {
        ticks: {
          beginAtZero: true,
          stepSize: 20,
          maxTicksLimit: 6
        }
      },
      x: {
        ticks: {
          maxTicksLimit: 8
        }
      }
    },
    layout: {
      padding: 0
    }
  }), []);

  const loadingClass = loading ? 'burst-loading' : '';

  return (
      <Line className={`burst-loading-container ${loadingClass}`} options={options} data={data} />
  );
};

export default InsightsGraph;
