import { useContext, useEffect } from '@wordpress/element';
import { ShepherdTour, ShepherdTourContext } from 'react-shepherd';
import { __ } from '@wordpress/i18n';
import * as burst_api from '../../utils/api';

const newSteps = [
  {
    title: __( 'Welcome to Burst Statistics', 'burst-statistics' ),
    text: '<p>' +  __( 'The plugin is now active.', 'burst-statistics' ) + ' ' + __( 'Follow a quick tour and make sure everything works.', 'burst-statistics' ) + '</p>',
    classes: 'burst-shepherd',
    buttons: [
      {
        type: 'cancel',
        classes: 'burst-button burst-button--secondary',
        text: __( 'Exit tour', 'burst-statistics' )
      },
      {
        classes: 'burst-button burst-button--primary',
        text: __( 'Start tour', 'burst-statistics' ),
        action() {
          window.location.hash = 'dashboard';
          return this.next();
        }
      }
    ]
  },
  {
    title: __( 'Your dashboard', 'burst-statistics' ),
    text: '<p>' + __( 'This is your Dashboard. This will give you an overview of notices, real time data, and settings.', 'burst-statistics' ) + '</p>',
    classes: 'burst-shepherd',
    buttons: [
      {
        classes: 'burst-button burst-button--secondary',
        text: __( 'Previous', 'burst-statistics' ),
        action() {
          window.location.hash = 'dashboard';
          return this.back();
        }
      },
      {
        classes: 'burst-button burst-button--primary',
        text: __( 'Next', 'burst-statistics' ),
        action() {
          window.location.hash = 'dashboard';
          return this.next();
        }
      }
    ],
    attachTo: { element: '.burst-progress', on: 'auto' }
  },
  {
    title: __( 'Real time data', 'burst-statistics' ),
    text: '<p>' +  __( 'This block will show you real time visitors.', 'burst-statistics' ) + ' '  + __( 'To make sure Burst Statistics is setup properly, try visiting this website on another device or open a private window.', 'burst-statistics' ) + '</p>',
    classes: 'burst-shepherd',
    buttons: [
      {
        classes: 'burst-button burst-button--secondary',
        text: __( 'Previous', 'burst-statistics' ),
        action() {
          window.location.hash = 'dashboard';
          return this.back();
        }
      },
      {
        classes: 'burst-button burst-button--primary',
        text: __( 'Next', 'burst-statistics' ),
        action() {
          window.location.hash = 'statistics';
          return this.next();
        }
      }
    ],
    attachTo: { element: '.burst-today', on: 'auto' }
  },
  {
    title: __( 'Your website statistics', 'burst-statistics' ),
    text: '<p>' + __( 'This page is probably quite empty at the moment. The data from your website will show up here in a few days. So be sure to come back soon.', 'burst-statistics' ) + '</p>',
    classes: 'burst-shepherd',
    buttons: [
      {
        classes: 'burst-button burst-button--secondary',
        text: __( 'Previous', 'burst-statistics' ),
        action() {
          window.location.hash = 'dashboard';
          return this.back();
        }
      },
      {
        classes: 'burst-button burst-button--primary',
        text: __( 'Next', 'burst-statistics' ),
        action() {
          window.location.hash = 'statistics';
          return this.next();
        }
      }
    ]

    // attachTo: { element: '.burst-today', on: 'right' },
  },
  {
    title: __( 'Changing the date range', 'burst-statistics' ),
    text: '<p>' + __( 'Over here you can change the date range for the data being shown. Click on two different days or click twice on a single day to show the data for that period.', 'burst-statistics' ) + '</p>',
    classes: 'burst-shepherd',
    buttons: [
      {
        classes: 'burst-button burst-button--secondary',
        text: __( 'Previous', 'burst-statistics' ),
        action() {
          window.location.hash = 'statistics';
          return this.back();
        }
      },
      {
        classes: 'burst-button burst-button--primary',
        text: __( 'Next', 'burst-statistics' ),
        action() {
          window.location.hash = 'settings';
          return this.next();
        }
      }
    ],
    attachTo: { element: '.burst-date-range-container', on: 'auto' }
  },
  {
    title: __( 'Your configuration', 'burst-statistics' ),
    text: '<p>' + __( 'You can customize Burst to your liking. Change settings to meet your needs.', 'burst-statistics' ) + '</p>',
    classes: 'burst-shepherd',
    buttons: [
      {
        classes: 'burst-button burst-button--secondary',
        text: __( 'Previous', 'burst-statistics' ),
        action() {
          window.location.hash = 'statistics';
          return this.back();
        }
      },
      {
        classes: 'burst-button burst-button--primary',
        text: __( 'Next', 'burst-statistics' ),
        action() {
          window.location.hash = 'settings';
          return this.next();
        }
      }
    ],
    attachTo: { element: '.burst-general', on: 'auto' }
  },
  {
    title: __( 'Support & feedback', 'burst-statistics' ),
    text: '<p>' + __( 'Feel free to post your questions or feedback on the WordPress forums. We are happy to help!', 'burst-statistics' ) + '</p>',
    classes: 'burst-shepherd',
    buttons: [
      {
        classes: 'burst-button burst-button--secondary',
        text: __( 'Previous', 'burst-statistics' ),
        action() {
          window.location.hash = 'settings';
          return this.back();
        }
      },
      {
        type: 'cancel',
        classes: 'burst-button burst-button--primary',
        text: __( 'Exit tour', 'burst-statistics' )
      }
    ]
  }
];
let tourEndRunning = false;
const onTourEnd = () => {
  if ( ! tourEndRunning ) {
    tourEndRunning = true;
    let saveFields = [];
    saveFields.push({id: 'burst_tour_shown_once', value: '1', type: 'hidden'});
    burst_api.setFields( saveFields ).then( ( response ) => {
      tourEndRunning = false;
    });
  }
};

const tourOptions = {
  defaultStepOptions: {
    cancelIcon: {
      enabled: true
    },
    keyboardNavigation: false
  },
  useModalOverlay: false,
  margin: 15
};

function TourInstance() {
  const tour = useContext( ShepherdTourContext );
  tour.on( 'cancel', onTourEnd );
  useEffect( () => {
    if ( tour ) {
tour.start();
}
  }, [ tour ]);

  return <></>;
}

const Tour = () => {
  return (
      <ShepherdTour steps={newSteps} tourOptions={tourOptions} >
        <TourInstance />
      </ShepherdTour>
  );
};

export default Tour;
