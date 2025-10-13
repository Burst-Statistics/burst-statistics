import { ResponsiveWrapper } from '@nivo/core'
import { forwardRef } from 'react'
import Choropleth from './Choropleth'

const ResponsiveChoropleth = forwardRef((props, ref) => (
    <ResponsiveWrapper>
        {({ width, height }) => <Choropleth ref={ref} width={width} height={height} {...props} />}
    </ResponsiveWrapper>
))

export default ResponsiveChoropleth