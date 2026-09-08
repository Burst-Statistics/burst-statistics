import { getData } from '@/utils/api';
import { isValidObject } from '@/utils/objectUtils';

export interface PageSummaryData {
	title: string;
	fallbackPath: string;
	postType: string;
	status: string;
	author: string;
	publishedAt: string;
	editedAt: string;
	wordCount: number;
	readingMinutes: number;
}

interface GetPageSummaryArgs {
	id?: string;
	pageUrl?: string;
}

export async function getPageSummaryData(
	args: GetPageSummaryArgs
): Promise<PageSummaryData> {
	const { id, pageUrl } = args;

	const { data } = await getData(
		'page-summary',
		'',
		'',
		'',
		{
			page_id: id,
			page_url: pageUrl
		}
	);

	return ( isValidObject<PageSummaryData>( data ) ? data : null ) || {
		title: pageUrl || 'Page Overview',
		fallbackPath: pageUrl || '/',
		postType: 'Page',
		status: 'Published',
		author: 'System',
		publishedAt: new Date().toISOString(),
		editedAt: new Date().toISOString(),
		wordCount: 0,
		readingMinutes: 1
	};
}
