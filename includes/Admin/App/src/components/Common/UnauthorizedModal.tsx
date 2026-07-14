import React from 'react';
import { __ } from '@wordpress/i18n';
import AccessStateModal from './AccessStateModal';

interface UnauthorizedModalProps {
	header?: string;
	message?: string;
	actionLabel?: string;
}

const UnauthorizedModal: React.FC<UnauthorizedModalProps> = ({
	header = __( 'Access Restricted', 'burst-statistics' ),
	message = __(
		'You don’t have permission to view this page.',
		'burst-statistics'
	),
	actionLabel = __( 'Go Back', 'burst-statistics' )
}) => {
	return (
		<AccessStateModal
			header={header}
			message={message}
			actionLabel={actionLabel}
			iconName="warning"
			iconColor="red"
			iconBgClassName="bg-red-100"
			headingClassName="text-text-gray"
			messageClassName="text-text-gray-light"
		/>
	);
};

export default UnauthorizedModal;
