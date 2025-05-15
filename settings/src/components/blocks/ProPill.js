import {__} from '@wordpress/i18n';

const ProPill = () => {
  return (
      <span className={'burst-pill burst-pill--green'}>
        {__( 'Pro', 'burst-statistics' )}
      </span>
  );
};
export default ProPill;
