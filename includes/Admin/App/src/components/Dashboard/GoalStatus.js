import Icon from '@/utils/Icon';
import { __ } from '@wordpress/i18n';

const getStatusColor = ( status ) => {
	switch ( status ) {
		case 'active':
			return 'green';
		case 'inactive':
			return 'gray';
		default:
			return 'gray';
	}
};

const getStatusLabel = ( status ) => {
	switch ( status ) {
		case 'active':
			return __( 'Active', 'burst-statistics' );
		case 'inactive':
			return __( 'Inactive', 'burst-statistics' );
		default:
			return __( 'Unknown', 'burst-statistics' );
	}
};
const GoalStatus = ({ data }) => {
	const { status } = data;

	const iconColor = getStatusColor( status );
	const statusLabel = getStatusLabel( status );

	return (
		<div className="flex items-center gap-1.5">
			<Icon name="dot" color={iconColor} size={12} />
			<p className="text-gray text-sm">{statusLabel}</p>
		</div>
	);
};

export default GoalStatus;
