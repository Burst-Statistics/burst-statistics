import { memo } from 'react';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';

type ReferrerActionLinkProps = {
	isInternal: boolean;
	editUrl?: string;
	url: string;
};

export const ReferrerActionLink = memo(
	({ isInternal, editUrl, url }: ReferrerActionLinkProps ) => {
		if ( isInternal ) {
			const label = editUrl ?
				__( 'Edit page', 'burst-statistics' ) :
				__( 'View page', 'burst-statistics' );
			return (
				<a
					href={editUrl || url}
					target="_blank"
					rel="noopener noreferrer"
					className="p-0.5 text-text-gray hover:text-text-black transition-colors"
					title={label}
				>
					<Icon
						name={editUrl ? 'pencil' : 'external-link'}
						size={12}
						color="currentColor"
					/>
				</a>
			);
		}

		return (
			<a
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				className="p-0.5 text-text-gray hover:text-text-black transition-colors"
				title={__( 'Open referrer', 'burst-statistics' )}
			>
				<Icon name="external-link" size={12} color="currentColor" />
			</a>
		);
	}
);

ReferrerActionLink.displayName = 'ReferrerActionLink';
