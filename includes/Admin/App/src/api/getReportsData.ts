import {
	Report,
	FrequencyType,
	DayOfWeekType,
	WeekOfMonthType
} from '@/store/reports/types';

import { getReports } from '@/utils/api';

interface ApiResponse {
	success: boolean;
	data: {
		reports: any // eslint-disable-line @typescript-eslint/no-explicit-any
	};
}

/**
 * Fetch and normalize reports for frontend usage
 */
export async function getReportsData(): Promise<Report[]> {
	const response = await getReports();
	const result = response as ApiResponse;

	const reports = result.data.reports;

	return reports.map( ( r: any ): Report => { // eslint-disable-line @typescript-eslint/no-explicit-any
		const contentKeys = Array.isArray( r.content ) ? r.content : [];

		const frequency = r.frequency as FrequencyType;
		const hasDayOfWeek = 'string' === typeof r.dayOfWeek && 0 < r.dayOfWeek.length;
		const hasWeekOfMonth = null !== r.weekOfMonth && r.weekOfMonth !== undefined;
		return {
			id: Number( r.id ),
			reportDateRange: r.reportDateRange,
			name: String( r.name ),
			format: r.format,
			enabled: Boolean( r.enabled ),
			lastEdit: Number( r.lastEdit ),
			content: contentKeys,
			recipients: r.recipients,
			scheduled: Boolean( r.scheduled ),
			frequency,
			fixedEndDate: String( r.fixedEndDate ),
			lastSendStatus: r.lastSendStatus,
			lastSendMessage: r.lastSendMessage,
			dayOfWeek:
				hasDayOfWeek && 'daily' !== frequency ?
					( r.dayOfWeek as DayOfWeekType ) :
					undefined,
			weekOfMonth:
				'monthly' === frequency && hasWeekOfMonth ?
					( r.weekOfMonth as WeekOfMonthType ) :
					undefined,
			sendTime: r.sendTime
		};
	});
}

