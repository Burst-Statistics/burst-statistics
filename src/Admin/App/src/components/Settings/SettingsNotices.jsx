import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import CollapsableBlock from '@/components/Blocks/CollapsableBlock';
import { __ } from '@wordpress/i18n';
import useSettingsData from '@/hooks/useSettingsData';

const SettingsNotices = ({ settingsGroup }) => {
  const { settings } = useSettingsData();

  const notices = settings.filter(
    ( setting ) => setting.notice && setting.menu_id === settingsGroup.id
  );


  const [ openStates, setOpenStates ] = useState( notices.map( () => false ) );


  if ( ! notices.length ) {
    return null;
  }

  const toggleAllNotices = () => {
    const openCount = openStates.filter( ( isOpen ) => isOpen ).length;
    const shouldOpenAll = openCount <= notices.length / 2;
    setOpenStates( notices.map( () => shouldOpenAll ) );
  };

  const handleToggle = ( index, isOpen ) => {
    setOpenStates( ( prevStates ) => {
      const newStates = [ ...prevStates ];
      newStates[index] = isOpen;
      return newStates;
    });
  };

  const openCount = openStates.filter( ( isOpen ) => isOpen ).length;
  const toggleButtonText =
    openCount > notices.length / 2 ?
      __( 'Collapse all', 'burst-statistics' ) :
      __( 'Expand all', 'burst-statistics' );

  return (
    <>
      <div className="flex justify-between  w-full">
        <h2 className="py-4 text-base font-bold">
          {__( 'Notifications', 'burst-statistics' )}
        </h2>
        <button
          className="text-gray-500 cursor-pointer text-sm underline"
          onClick={toggleAllNotices}
        >
          {toggleButtonText}
        </button>
      </div>

      {0 < notices.length &&
        notices.map( ( notice, index ) => (
          <CollapsableBlock
            key={index}
            title={notice.notice.title}
            className="mb-4 w-full flex-1 !bg-accent-light"
            isOpen={openStates[index]}
            onToggle={( isOpen ) => handleToggle( index, isOpen )}
          >
            <div className="flex flex-col justify-start">
              <p className="font-normal text-base">{notice.notice.description}</p>
              <Link
                className="text-gray-500 mt-2 text-base underline"
                to={notice.notice.url}
                from={'/'}
              >
                {__( 'Learn more', 'burst-statistics' )}
              </Link>
            </div>
          </CollapsableBlock>
        ) )}
    </>
  );
};

SettingsNotices.displayName = 'SettingsNotices';
export default SettingsNotices;
