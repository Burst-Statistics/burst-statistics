import React from 'react';
import { __ } from '@wordpress/i18n';
import AccessStateModal from './AccessStateModal';

interface NotFoundModalProps {
	header?: string;
	message?: string;
	actionLabel?: string;
}

const NotFoundModal: React.FC<NotFoundModalProps> = ({
	header = __( 'Page Not Found', 'burst-statistics' ),
	message = __(
		'The page you are trying to access does not exist or is not available.',
			'burst-statistics'
	),
	actionLabel = __( 'Go Back', 'burst-statistics' )
}) => {
	return (
		<AccessStateModal
			header={header}
			message={message}
			actionLabel={actionLabel}
			iconName="search"
			iconColor="gray"
			iconBgClassName="bg-gray-200"
			headingClassName="text-gray-900"
			messageClassName="text-gray-600"
		/>
	);
};

export default NotFoundModal;
