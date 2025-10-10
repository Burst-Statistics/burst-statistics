import { ReactSVG } from 'react-svg';

/**
 * Display a flag with SVG icon from pro/assets/flags/4x3
 * @param country
 * @param countryNiceName
 * @param iconOnly
 * @constructor
 */
const Flag = ({country, countryNiceName = '', iconOnly=false}) => {
  

  // country to lowercase
  // check if country is a string
  if ( 'string' !== typeof country ) {
 
    return (
        <span className="flex items-center justify-start gap-1.5">{countryNiceName}</span>
    );
  }

  
  if ( '' === countryNiceName ) {
    countryNiceName = country;
  }

  if ( '' === countryNiceName) {
    countryNiceName = __('Unknown', 'burst-statistics');
  }

  country = country.toLowerCase();
  const src = `${burst_settings.plugin_url}src/Pro/assets/flags/4x3/${country}.svg`;
  if ( iconOnly ) {
    return (
        <ReactSVG src={src} className={`burst-flag [&_svg]:h-[13px] [&_svg]:w-auto [&_div]:flex burst-flag-${country}`} title={countryNiceName}/>
    );
  }

  return (
      <span className="flex items-center justify-start gap-1.5"><ReactSVG src={src} className={`burst-flag [&_svg]:h-[13px] [&_svg]:w-auto [&_div]:flex burst-flag-${country}`} title={countryNiceName}/> {countryNiceName}</span>
  );
};
export default Flag;