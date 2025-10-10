import ResponsiveChoropleth from '@/components/Sources/WorldMap/ResponsiveChoropleth';
import { useGeoData } from '@/hooks/useGeoData';
import { useGeoStore } from '@/store/useGeoStore';

const GhostWorldMap = () => {

  const { 
    simplifiedWorldGeoJson,
    isGeoSimpleLoading
   } = useGeoData();

     // Get projection values from store
  const projection = useGeoStore( ( state ) => state.projection );


   if ( isGeoSimpleLoading ) {
    return <div>Loading...</div>;
   }

   if ( ! simplifiedWorldGeoJson ) {
    return <div>No data available</div>;
   }

  return (
    <div className="relative h-full min-h-[450px] w-full rounded-b-lg"
    style={{ boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.06)' }}>
      <ResponsiveChoropleth
        // Provide empty features and data arrays to prevent main data layer rendering
        features={[]}
        data={[]}
        
        // Base map layer - this is what we want to display
        baseMapFeatures={simplifiedWorldGeoJson.features}
        transform={simplifiedWorldGeoJson.transform}
        baseLayerOpacity={1}
        baseMapFeatureColor="#006d2c" // green

        // Basic required props
        match="id"
        value="value"
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}

        // Styling for the base map
        
        // Projection settings
        projectionType="naturalEarth1"
        projectionScale={projection.scale}
        projectionTranslation={projection.translation}
        projectionRotation={projection.rotation}
        
        // Disable graticule and interactions
        enableGraticule={true}
        graticuleLineColor="#dddddd"
        borderWidth={0.5}
        borderColor="#adb5bd"

        isInteractive={false}
        
        // Only render the layers we need
        layers={['baseMapFeatures', 'graticule']}
        
        // Remove legends since it's decorative
        legends={[]}
        
        // Disable zoom functionality
        zoomToFeature={null}
      />
    </div>
  );
};

export default GhostWorldMap;
