import React from 'react';
import StringFilterSetup from './Setup/StringFilterSetup';
import BooleanFilterSetup from './Setup/BooleanFilterSetup';
import IntFilterSetup from './Setup/IntFilterSetup';
import DeviceFilterSetup from './Setup/DeviceFilterSetup';
import { type FilterConfig } from '@/config/filterConfig';
import TimePerSessionFilterSetup from './Setup/TimePerSessionFilterSetup';

interface FilterSetupViewProps {
	filterKey: string;
	config: FilterConfig;
	onBack: () => void;
	tempValue: string;
	onTempValueChange: ( value: string ) => void;
}

const FilterSetupView: React.FC<FilterSetupViewProps> = ({
	filterKey,
	config,
	tempValue,
	onTempValueChange
}) => {
	const renderSetupComponent = (): React.ReactNode => {
		const commonProps = {
			filterKey,
			config,
			initialValue: tempValue,
			onChange: onTempValueChange
		};

		switch ( filterKey ) {
			case 'device_id':

				// Special case for device filter - use custom UI.
				return <DeviceFilterSetup {...commonProps} />;
			case 'time_per_session':

				// Special case for time per session - use dedicated UI
				return <TimePerSessionFilterSetup {...commonProps} />;
		}

		switch ( config.type ) {
			case 'string':
				return <StringFilterSetup {...commonProps} />;
			case 'boolean':
				return <BooleanFilterSetup {...commonProps} />;
			case 'int':
				return <IntFilterSetup {...commonProps} />;
			default:
				return <StringFilterSetup {...commonProps} />;
		}
	};

	return (
		<div className="h-full">
			{ renderSetupComponent() }
		</div>
	);
};

export default FilterSetupView;
