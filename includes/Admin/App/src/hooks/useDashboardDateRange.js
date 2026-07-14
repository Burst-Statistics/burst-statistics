import { useMemo } from 'react';
import { endOfDay, format, startOfDay } from 'date-fns';
import { getDateWithOffset } from '@//utils/formatting';

const useDashboardDateRange = () => {
	const currentDateWithOffset = useMemo( () => getDateWithOffset(), []);
	const startDate = useMemo(
		() => format( startOfDay( currentDateWithOffset ), 'yyyy-MM-dd' ),
		[ currentDateWithOffset ]
	);
	const endDate = useMemo(
		() => format( endOfDay( currentDateWithOffset ), 'yyyy-MM-dd' ),
		[ currentDateWithOffset ]
	);
	const today = useMemo(
		() => format( currentDateWithOffset, 'yyyy-MM-dd' ),
		[ currentDateWithOffset ]
	);

	return {
		startDate,
		endDate,
		today,
		currentDateWithOffset
	};
};

export default useDashboardDateRange;
