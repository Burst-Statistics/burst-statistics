
import getAnchor from '../utils/getAnchor';
import Header from './common/Header';
import PagePlaceholder from './pages/PagePlaceholder';
import {useMenu} from '../store/useMenuStore';
import {useEffect, useState} from '@wordpress/element';
import {useFields} from '../store/useFieldsStore';
import {setLocaleData} from '@wordpress/i18n';
import ErrorBoundary from './ErrorBoundary';

const Page = () => {
  const menuLoaded = useMenu( ( state ) => state.menuLoaded );
  const selectedMainMenuItem = useMenu( ( state ) => state.selectedMainMenuItem );
  const fetchSubMenuData = useMenu( ( state ) => state.fetchSubMenuData );
  const fields = useFields( ( state ) => state.fields );
  const fieldsLoaded = useFields( ( state ) => state.fieldsLoaded );
  const fetchFieldsData = useFields( ( state ) => state.fetchFieldsData );
  const [ ToastContainer, setToastContainer ] = useState( null );
  const [ DashboardPage, setDashboardPage ] = useState( null );
  const [ StatisticsPage, setStatisticsPage ] = useState( null );
  const [ SettingsPage, setSettingsPage ] = useState( null );
  const [ Tour, setTour ] = useState( null );

  //load the chunk translations passed to us from the rsssl_settings object
  //only works in build mode, not in dev mode.
  useEffect( () => {
    burst_settings.json_translations.forEach( ( translationsString ) => {
      let translations = JSON.parse( translationsString );
      let localeData = translations.locale_data[ 'burst-statistics' ] || translations.locale_data.messages;
      localeData[''].domain = 'burst-statistics';
      setLocaleData( localeData, 'burst-statistics' );
    });
  }, []);

  useEffect( () => {
    if ( ! burst_settings.tour_shown || ( 'dashboard' === getAnchor() && 'tour' === getAnchor( 'menu' ) ) && ! Tour ) {
      import ( './common/Tour' ).then( ({default: Tour}) => {
        setTour( () => Tour );
      });
    }
    if ( 'dashboard' === selectedMainMenuItem && ! DashboardPage ) {
      import ( './pages/DashboardPage' ).then( ({default: DashboardPage}) => {
        setDashboardPage( () => DashboardPage );
      });
    }
    if ( 'statistics' === selectedMainMenuItem && ! StatisticsPage ) {
      import ( './pages/StatisticsPage' ).then( ({default: StatisticsPage}) => {
        setStatisticsPage( () => StatisticsPage );
      });
    }
    if ( 'settings' === selectedMainMenuItem && ! SettingsPage ) {
      import ( './pages/SettingsPage' ).then( ({default: SettingsPage}) => {
        setSettingsPage( () => SettingsPage );
      });
    }
  }, [ selectedMainMenuItem ]);

  // change pages
  useEffect( () => {
      if ( fieldsLoaded ) {
        fetchSubMenuData( fields );
      }
      window.addEventListener( 'hashchange', () => {
        fetchSubMenuData( fields );
      });
  }, [ fields ]);

  useEffect( () => {
    let subMenuItem = getAnchor( 'menu' );
    fetchFieldsData( subMenuItem );

    // initGoals();
  }, []);

  // async load react-toastify
  useEffect( () => {
    import( 'react-toastify' ).then( ( module ) => {
      const ToastContainer = module.ToastContainer;
      setToastContainer( () => ToastContainer );
    });
  }, []);

  return (
      <>
        <Header />
        {menuLoaded ? (
            <>
                { Tour && <Tour />}
              <ErrorBoundary fallback={'Could not load page'}>
                {'dashboard' === selectedMainMenuItem && DashboardPage && <DashboardPage />}
                {'dashboard' === selectedMainMenuItem && ! DashboardPage && <PagePlaceholder />}
                {'statistics' === selectedMainMenuItem && StatisticsPage && <StatisticsPage />}
                {'statistics' === selectedMainMenuItem && ! StatisticsPage && <PagePlaceholder />}
                {'settings' === selectedMainMenuItem && SettingsPage && <SettingsPage />}
                {'settings' === selectedMainMenuItem && ! SettingsPage && <PagePlaceholder />}
              </ErrorBoundary>
            </>
        ) : (
            <PagePlaceholder />
        )}
        {ToastContainer && (
            <ToastContainer
                position="bottom-right"
                autoClose={2000}
                limit={5}
                hideProgressBar
                newestOnTop
                closeOnClick
                pauseOnFocusLoss
                pauseOnHover
                theme="light"
            />
        )}
      </>
  );
};

export default Page;
