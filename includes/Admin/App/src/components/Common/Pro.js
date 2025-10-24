import {__} from '@wordpress/i18n';
import {burst_get_website_url} from '../../utils/lib';
import useLicenseData from "@/hooks/useLicenseData";

/**
 * Render a premium tag
 */
const Pro = ({pro, id}) => {
  const {
    isPro,
  } = useLicenseData();
  if ( isPro || ! pro ) {
    return null;
  }

  let url = burst_get_website_url( 'pricing', {
    utm_source: 'settings-pro-tag',
    utm_content: id
  });
  return (
        <a className="bg-primary py-0.5 px-3 rounded-2xl text-white" target="_blank" href={url}>
          {__( 'Pro', 'burst-statistics' )}
        </a>
  );

};

export default Pro;
