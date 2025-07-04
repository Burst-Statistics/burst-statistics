import {__} from '@wordpress/i18n';
import {burst_get_website_url} from '../../utils/lib';
import useLicenseStore from '../../store/useLicenseStore';

/**
 * Render a premium tag
 */
const Pro = ({pro, id}) => {
  const { isPro } = useLicenseStore();
  if ( isPro || ! pro ) {
    return null;
  }

  let url = burst_get_website_url( 'pricing', {
    burst_source: 'settings-pro-tag',
    burst_content: id
  });
  return (
        <a className="bg-primary py-0.5 px-3 rounded-2xl text-white" target="_blank" href={url}>
          {__( 'Pro', 'burst-statistics' )}
        </a>
  );

};

export default Pro;
