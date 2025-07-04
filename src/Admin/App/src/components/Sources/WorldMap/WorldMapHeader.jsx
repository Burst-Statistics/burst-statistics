import { __ } from '@wordpress/i18n';
import UnifiedMapPopover from './MapSettingsPopover';

const WorldMapHeader = () => {
  return (
    <div className="flex items-center gap-2">
      <UnifiedMapPopover />
    </div>
  );
};

export default WorldMapHeader;
