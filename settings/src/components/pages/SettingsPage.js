import Menu from '../blocks/Menu/Menu';
import Settings from '../blocks/Settings';
import Notices from '../blocks/Notices';

const SettingsPage = () => {

  return (
      <div className={'burst-content-area burst-grid burst-dashboard'}>
        <Menu/>
        <Settings/>
        <Notices className="burst-wizard-notices"/>
      </ div>
  );
};

export default SettingsPage;
