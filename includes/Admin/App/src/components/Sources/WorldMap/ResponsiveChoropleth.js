import { forwardRef } from 'react';
import Choropleth from './Choropleth';
import { useMeasure } from '@nivo/core';


const ResponsiveChoropleth = forwardRef( ( props, ref ) => {
	const [ measureRef, bounds ] = useMeasure();
	return (
		<div ref={measureRef} style={{ width: '100%', height: '100%' }}>
			{0 < bounds.width && 0 < bounds.height ? (
				<Choropleth
					ref={ref}
					width={bounds.width}
					height={bounds.height}
					{...props}
				/>
			) : (
				<div></div>
			)}
		</div>
	);
});

ResponsiveChoropleth.displayName = 'ResponsiveChoropleth';
export default ResponsiveChoropleth;
