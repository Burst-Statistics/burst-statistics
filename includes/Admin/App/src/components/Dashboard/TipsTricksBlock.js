import { __ } from '@wordpress/i18n';
import { burst_get_website_url } from '@//utils/lib';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import ButtonInput from '@/components/Inputs/ButtonInput';
import {useQuery} from "@tanstack/react-query";
import {doAction} from "@/utils/api";
import he from "he";

const TipsTricksBlock = ( props ) => {

  const articlesQuery = useQuery({
    queryKey: [ 'articles' ],
    queryFn: () => doAction('get_article_data'),
    // Only fetch once when component mounts
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  const pickRandomArticles = (articles )=> {
    if (!Array.isArray(articles)) return [];

    // Replace link with burst_get_website_url()
    return articles.map(item => ({
      ...item,
      link: burst_get_website_url(item.link, {
        utm_source: 'tips-tricks'
      })
    }));
  }

  const items = pickRandomArticles(articlesQuery.data);
  return (
    <Block className="row-span-1 lg:col-span-6">
      <BlockHeading title={__( 'Tips & Tricks', 'burst-statistics' )} />
      <BlockContent className="px-6 py-0">
        <div className="flex flex-row flex-wrap mb-2.5 text-base leading-[1.7] gap-1.5 max-[992px]:overflow-hidden">
          {items.map( ( item, index ) => (
            <div key={index} className="w-[calc(50%-4px)] max-[576px]:w-full">
              <a
                href={item.link}
                target="_blank"
                title={he.decode(item.title.rendered)}
				className="group text-gray transition-colors duration-300 ease-in-out flex items-center gap-2.5 min-w-0 no-underline hover:text-primary hover:underline"
              >
                <div className="h-[13px] w-[13px] flex-none rounded-full transition-colors duration-300 ease-in-out group-[:visited]:bg-gray-300 bg-primary group-hover:!bg-primary medium" />
                <div className="whitespace-nowrap overflow-hidden text-ellipsis hover:underline">{he.decode(item.title.rendered)}</div>
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
