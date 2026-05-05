import { ReportLogsResponse } from '@/store/reports/types';
import { getReportLogs } from '@/utils/api';

export async function getReportLogsData(): Promise<ReportLogsResponse> {
	const response = await getReportLogs();

	if ( ! response?.data?.logs ) {
		return [];
	}

	return response.data.logs as ReportLogsResponse;
}
