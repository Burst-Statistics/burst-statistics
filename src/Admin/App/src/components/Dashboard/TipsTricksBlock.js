import { __ } from '@wordpress/i18n';
import { burst_get_website_url } from '@//utils/lib';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import ButtonInput from '@/components/Inputs/ButtonInput';

const TipsTricksBlock = ( props ) => {
  const items = [
    {
      content: 'Getting the most out of the advanced filters',
      link: burst_get_website_url( 'how-to-use-filters-to-get-more-insights-from-your-website-visitors/', {
        utm_source: 'tips-tricks'
      })
    },
    {
      content: 'What is Cookieless tracking?',
      link: burst_get_website_url( 'definition/what-is-cookieless-tracking/', {
        utm_source: 'tips-tricks'
      })
    },
    {
      content: 'Easily create campaign URLS',
      link: burst_get_website_url( 'campaign-url-builder/', {
        utm_source: 'tips-tricks'
      })
    },
    {
      content: 'How can I compare metrics?',
      link: burst_get_website_url( 'how-can-i-compare-metrics/', {
        utm_source: 'tips-tricks'
      })
    },
    {
      content: 'What is Bounce Rate?',
      link: burst_get_website_url( 'definition/what-is-bounce-rate/', {
        utm_source: 'tips-tricks'
      })
    },
    {
      content: 'How to set goals?',
      link: burst_get_website_url( 'how-to-set-goals/', {
        utm_source: 'tips-tricks'
      })
    }
  ];

  return (
    <Block className="row-span-1 lg:col-span-6">
      <BlockHeading title={__( 'Tips & Tricks', 'burst-statistics' )} />
      <BlockContent className={'px-6 py-0'}>
        <div className="burst-tips-tricks-container">
          {items.map( ( item, index ) => (
            <div key={index} className="burst-tips-tricks-element">
              <a
                href={item.link}
                target="_blank"
                title={item.content}
              >
                <div className="burst-bullet medium" />
                <div className="burst-tips-tricks-content">{item.content}</div>
              </a>
            </div>
          ) )}
        </div>
      </BlockContent>
      <BlockFooter>
        <ButtonInput
          link={{
            to: burst_get_website_url( 'docs', {
              utm_source: 'tips-tricks',
              utm_content: 'view-all'
            })
          }}
          btnVariant="tertiary"
        >
          {__( 'View all', 'burst-statistics' )}
        </ButtonInput>
      </BlockFooter>
    </Block>
  );
};
export default TipsTricksBlock;
