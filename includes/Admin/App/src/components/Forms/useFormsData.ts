import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDate } from '@/store/useDateStore';
import { getDatatableData } from '@/utils/api';
import useLicenseData from '@/hooks/useLicenseData';
import useFilters from '@/hooks/useFilters';

/**
 * A single form data row as returned by the Forms block.
 */
export type FormRow = {

	/** Unique form identifier (string, may be numeric). */
	formId: string;

	/** Human-readable form title (resolved from post title or provider API). */
	formTitle: string;

	/** Provider slug, e.g. 'contact-form-7', 'wpforms'. */
	formProvider: string;

	/** Human-readable provider label, e.g. 'Contact Form 7'. */
	formProviderLabel: string;

	/** Number of form submissions in the current period. */
	submissions: number;

	/** Number of unique site visitors in the current period (the denominator). */
	pageviews: number;

	/** Conversion rate (submissions / unique visitors × 100), rounded to 2 dp. */
	conversionRate: number;

	/** Submissions in the previous period (for period-over-period comparison). */
	previousSubmissions: number;

	/** Unique visitors in the previous period. */
	previousPageviews: number;

	/** Conversion rate in the previous period. */
	previousConversionRate: number;

	/** Submissions/Entries URL of the form. */
	submissionsUrl?: string;
};

/**
 * Raw row shape returned directly from the burst/v1/data/datatable/forms endpoint.
 */
type ApiRow = {
	form_id: string;
	form_title: string;
	form_provider: string;
	form_provider_label: string;
	submissions: number;
	pageviews: number;
	conversion_rate: number;
	previous_submissions: number;
	previous_pageviews: number;
	previous_conversion_rate: number;
	submissions_url?: string;
};

type UseFormsDataReturn = {

	/** All available rows, ordered by submissions descending. */
	data: FormRow[];

	/** True while the API request is in-flight. */
	isLoading: boolean;

	/** Non-null when the request failed. */
	error: Error | null;
};

/**
 * Returns form submission and conversion data for the current date range.
 *
 * Fetches from the `burst/v1/data/datatable/forms` REST endpoint which returns
 * per-form submission counts and conversion rates (unique-visitor denominator)
 * for both the current and previous period in a single request.
 *
 * @return {UseFormsDataReturn} The forms dataset and request state.
 */
export function useFormsData(): UseFormsDataReturn {
	const { startDate, endDate, range } = useDate( ( state ) => state );
	const { isLicenseValid } = useLicenseData();
	const { getActiveFilters } = useFilters();
	const filters = getActiveFilters();

	const { data: apiData, isLoading, error } = useQuery({
		queryKey: [ 'forms', startDate, endDate, range, filters ],
		enabled: isLicenseValid,
		queryFn: async() => {
			const response = await getDatatableData(
				'forms',
				false,
				startDate,
				endDate,
				range,
				{ filters }
			);

			// getDatatableData returns the full REST response; the datatable data is in response.data.
			const rows: ApiRow[] = response?.data?.data ?? [];
			return rows;
		},
		placeholderData: []
	});

	const data = useMemo( () => {
		const rows = ( apiData ?? []).map( ( row: ApiRow ) => ({
			formId: String( row.form_id ),
			formTitle: row.form_title,
			formProvider: row.form_provider,
			formProviderLabel: row.form_provider_label,
			submissions: Number( row.submissions ) || 0,
			pageviews: Number( row.pageviews ) || 0,
			conversionRate: Number( row.conversion_rate ) || 0,
			previousSubmissions: Number( row.previous_submissions ) || 0,
			previousPageviews: Number( row.previous_pageviews ) || 0,
			previousConversionRate: Number( row.previous_conversion_rate ) || 0,
			submissionsUrl: row.submissions_url
		}) );

		return rows.sort( ( a, b ) => b.submissions - a.submissions );
	}, [ apiData ]);

	return {
		data,
		isLoading,
		error: ( error as Error | null )
	};
}
