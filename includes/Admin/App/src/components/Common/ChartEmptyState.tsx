import { __ } from '@wordpress/i18n';

/**
 * Centered no-data state for a chart block, matching the chart height so the
 * layout does not jump when data arrives.
 *
 * @param props - Explanation message and an optional leading icon.
 * @return The empty-state element.
 */
export function ChartEmptyState({
	message,
	icon
}: {
	message: string;
	icon?: JSX.Element;
}): JSX.Element {
	return (
		<div className="flex h-[360px] items-center justify-center px-6 py-8 text-center">
			<div className="max-w-md">
				{ icon && <div className="mb-4 flex justify-center">{ icon }</div> }

				<h3 className="mb-1 text-base font-medium text-gray-600">
					{ __( 'No data to display', 'burst-statistics' ) }
				</h3>

				<p className="text-sm text-gray-400">{ message }</p>
			</div>
		</div>
	);
}
