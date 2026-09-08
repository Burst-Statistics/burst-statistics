import { ScrollDepthDatum } from '@/api/getScrollAnalyticsData';

export const SCROLL_DEPTH_DATA: ScrollDepthDatum[] = [
	{
		range: '0–25%',
		percentage: 100,
		visitors: 2410,
		dwellSeconds: 11
	},
	{
		range: '25–50%',
		percentage: 71,
		visitors: 1711,
		dwellSeconds: 26
	},
	{
		range: '50–75%',
		percentage: 39,
		visitors: 940,
		dwellSeconds: 8
	},
	{
		range: '75–100%',
		percentage: 24,
		visitors: 578,
		dwellSeconds: 22
	}
];
