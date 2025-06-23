import SettingsNavigationItem from './SettingsNavigationItem';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';

/**
 * Menu block, rendering the entire menu
 */
const SettingsNavigation = ({ subMenu }) => {
  const subMenuItems = subMenu.menu_items;

  return (
    <Block>
      <BlockHeading title={subMenu.title} controls={undefined} />
      <BlockContent className={'px-0 py-0 pb-4'}>
        <div className="flex flex-col justify-start">
          {subMenuItems.map( ( item ) => (
            <SettingsNavigationItem key={item.id} item={item} />
          ) )}
        </div>
      </BlockContent>
    </Block>
  );
};

export default SettingsNavigation;
