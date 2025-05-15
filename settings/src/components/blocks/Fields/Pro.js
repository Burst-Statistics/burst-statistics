import {__} from '@wordpress/i18n';
import {burst_get_website_url} from '../../../utils/lib';

/**
 * Render a premium tag
 */
const Pro = ({pro, id}) => {
  if ( burst_settings.is_pro || ! pro ) {
    return null;
  }

  let url = burst_get_website_url( 'pricing', {
    burst_source: 'settings-pro-tag',
    burst_content: id
  });
  return (
      <div className="burst-pro">
        <a target="_blank" href={url} rel="noreferrer">
          {__( 'Pro', 'burst-statistics' )}
        </a>
      </div>
  );

};

export default Pro;
