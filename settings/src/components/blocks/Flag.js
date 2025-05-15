import { ReactSVG } from 'react-svg';

/**
 * Display a flag with SVG icon from pro/assets/flags/4x3
 * @param country
 * @param countryNiceName
 * @constructor
 */
const Flag = ({country, countryNiceName = ''}) => {

  // country to lowercase
  // check if country is a string
  if ( 'string' !== typeof country ) {
    return (
        <span className={'burst-flag-wrapper'}>{countryNiceName}</span>
    );
  }
  if ( '' === countryNiceName ) {
    countryNiceName = country;
  }

  country = country.toLowerCase();
  const src = `${burst_settings.plugin_url}pro/assets/flags/4x3/${country}.svg`;
  return (
      <span className={'burst-flag-wrapper'}><ReactSVG src={src} className={`burst-flag burst-flag-${country}`} title={countryNiceName}/> {countryNiceName}</span>
  );
};
export default Flag;
