import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { burst_get_website_url } from '@/utils/lib';

/**
 * What anonymous usage data includes and never includes, always visible for transparency.
 *
 * @return The two lists and a link to the data handling page.
 */
const DataSharingDetails = () => (
	<>
		{/* Details */ }
		<div className="grid gap-4 @sm:grid-cols-2">
			{/* What we collect */ }
			<div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
				<h4 className="flex items-center gap-2 text-sm font-semibold text-text-black">
					<Icon name="circle-check" color="green" size={ 16 } />
					{ __( 'What we collect', 'burst-statistics' ) }
				</h4>
				<ul className="flex flex-col gap-1.5 text-sm text-text-gray">
					<li className="flex items-start gap-2">
						<span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
						{ __( 'General site metrics (e.g., monthly visitors, bounce rate)', 'burst-statistics' ) }
					</li>
					<li className="flex items-start gap-2">
						<span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
						{ __( 'Active plugins & WordPress/PHP versions', 'burst-statistics' ) }
					</li>
					<li className="flex items-start gap-2">
						<span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
						{ __( 'Burst settings you use', 'burst-statistics' ) }
					</li>
				</ul>
			</div>

			{/* What we don't collect */ }
			<div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
				<h4 className="flex items-center gap-2 text-sm font-semibold text-text-black">
					<Icon name="ban" color="red" size={ 16 } />
					{ __( 'What we never collect', 'burst-statistics' ) }
				</h4>
				<ul className="flex flex-col gap-1.5 text-sm text-text-gray">
					<li className="flex items-start gap-2">
						<span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
						{ __( 'Your site URL, admin emails, or user data', 'burst-statistics' ) }
					</li>
					<li className="flex items-start gap-2">
						<span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
						{ __( 'Visitor IP addresses or specific page URLs', 'burst-statistics' ) }
					</li>
				</ul>
			</div>
		</div>

		{/* Learn more link */ }
		<a
			href={burst_get_website_url( 'how-we-handle-anonymous-usage-data' )}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center gap-1 text-sm text-wp-blue hover:underline"
		>
			{ __( 'Learn more about how we handle data', 'burst-statistics' ) }

		</a>
	</>
);

export default DataSharingDetails;
