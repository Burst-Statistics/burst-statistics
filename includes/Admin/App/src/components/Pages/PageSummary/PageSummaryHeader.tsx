import { __, _n, sprintf } from '@wordpress/i18n';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Icon from '@/utils/Icon';
import {
	formatDate,
	formatNumber,
	getRelativeTime
} from '@/utils/formatting';
import type { PageSummaryData } from '@/api/getPageSummaryData';

interface PageSummaryHeaderProps {
	data: PageSummaryData;
	pagePath: string;
	pageHref: string;
	editUrl: string;
}

interface MetaItemProps {
	icon: string;
	children: React.ReactNode;
}

/**
 * Renders one icon-labelled page metadata item.
 *
 * @param props - Component properties.
 * @param props.icon - Icon key from the shared icon map.
 * @param props.children - Metadata content.
 * @return The metadata item.
 */
const MetaItem = ({ icon, children }: MetaItemProps ): JSX.Element => (
	<span className="inline-flex items-center gap-1.5 text-sm text-text-gray">
		<Icon name={icon} size={16} color="gray" />
		{children}
	</span>
);

/**
 * Displays page metadata and links for the selected page.
 *
 * @param props - Component properties.
 * @param props.data - Page-summary data.
 * @param props.pagePath - Display path for the selected page.
 * @param props.pageHref - Absolute public page URL.
 * @param props.editUrl - WordPress edit URL, or an empty string when unavailable.
 * @return The page-summary heading.
 */
export const PageSummaryHeader = ({
	data,
	pagePath,
	pageHref,
	editUrl
}: PageSummaryHeaderProps ): JSX.Element => {
	const relativeEditTime = getRelativeTime( data.editedAt );
	const readingTime = sprintf(
		_n( '%s min read', '%s min read', data.readingMinutes, 'burst-statistics' ),
		formatNumber( data.readingMinutes, 0, false )
	);

	return (
		<div className="flex min-w-0 flex-1 flex-col justify-center">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<h2 className="m-0 text-xl font-semibold text-text-black">
						{data.title}
					</h2>
					<a
						href={pageHref}
						target="_blank"
						rel="noopener noreferrer"
						className="mt-0.5 inline-flex max-w-full items-center gap-1 text-sm font-medium text-primary hover:underline"
					>
						<span className="truncate">{pagePath}</span>
						<Icon
							name="external-link"
							size={13}
							color="green"
							className="shrink-0"
						/>
					</a>
				</div>

				{editUrl && (
					<ButtonInput
						btnVariant="tertiary"
						size="md"
						onClick={() => window.location.assign( editUrl )}
						className="inline-flex shrink-0 items-center gap-2 bg-white"
						ariaLabel={__( 'Edit page', 'burst-statistics' )}
					>
						<Icon name="pencil" size={16} />
						{__( 'Edit page', 'burst-statistics' )}
					</ButtonInput>
				)}
			</div>

			<div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
				<MetaItem icon="file">
					{sprintf(
						__( '%1$s · %2$s', 'burst-statistics' ),
						data.postType,
						data.status
					)}
				</MetaItem>
				<MetaItem icon="user">{data.author}</MetaItem>
				<MetaItem icon="calendar">
					{sprintf(
						__( 'Published %s', 'burst-statistics' ),
						formatDate( data.publishedAt )
					)}
				</MetaItem>
				<MetaItem icon="pencil">
					{sprintf(
						__( 'Edited %s', 'burst-statistics' ),
						relativeEditTime
					)}
				</MetaItem>
				<MetaItem icon="time">
					{sprintf(
						__( '%1$s words · %2$s', 'burst-statistics' ),
						formatNumber( data.wordCount, 0, false ),
						readingTime
					)}
				</MetaItem>
			</div>
		</div>
	);
};
