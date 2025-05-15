import GridItem from '../common/GridItem';
import {__} from '@wordpress/i18n';
import {burst_get_website_url} from '../../utils/lib';

const TipsTricksBlock = ( props ) => {
  const items = [
    {
      content: 'Hidden Features of the Insights Graph',
      link: burst_get_website_url( 'hidden-features-of-the-insights-graph/', {
        burst_source: 'tips-tricks'
      })
    },
    {
      content: 'What is Cookieless tracking?',
      link: burst_get_website_url( 'definition/what-is-cookieless-tracking/', {
        burst_source: 'tips-tricks'
      })
    },
    {
      content: 'Why is Burst Privacy-Friendly?',
      link: burst_get_website_url( 'why-is-burst-privacy-friendly/', {
        burst_source: 'tips-tricks'
      })
    },
    {
      content: 'How can I compare metrics?',
      link: burst_get_website_url( 'how-can-i-compare-metrics/', {
        burst_source: 'tips-tricks'
      })
    },
    {
      content: 'What is Bounce Rate?',
      link: burst_get_website_url( 'definition/what-is-bounce-rate/', {
        burst_source: 'tips-tricks'
      })
    },
    {
      content: 'How to set goals?',
      link: burst_get_website_url( 'how-to-set-goals/', {
        burst_source: 'tips-tricks'
      })
    }
  ];

  return (
      <GridItem
          className={'burst-column-2'}
          title={__( 'Tips & Tricks', 'burst-statistics' )}
          footer={
            <a href={burst_get_website_url( 'docs', {
              burst_source: 'tips-tricks',
              burst_content: 'view-all'
            })} target="_blank"
               className="burst-button burst-button--secondary" rel="noreferrer">
              {__( 'View all', 'burst-statistics' )}
            </a>
          }
      >
        <div className="burst-tips-tricks-container">
          {items.map( ( item, index ) => (
              <div key={index} className="burst-tips-tricks-element">
                <a href={item.link} target="_blank" rel="noopener noreferrer" title={item.content}>
                  <div className="burst-bullet medium" />
                  <div className="burst-tips-tricks-content">{item.content}</div>
                </a>
              </div>
          ) )}
        </div>
      </GridItem>
  );
};
export default TipsTricksBlock;
