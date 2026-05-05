import SubNavigationItem from './SubNavigationItem';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';

/**
 * Menu block, rendering the entire menu
 *
 * @param root0 - The component props.
 * @param root0.subMenu - The submenu data.
 * @param root0.from - The 'from' date parameter.
 * @param root0.to - The 'to' date parameter.
 *
 * @return {JSX.Element} The rendered SubNavigation component.
 */
const SubNavigation = ({ subMenu, from, to, paramKey }) => {
    const subMenuItems = subMenu.menu_items;

    // Filter out hidden menu items.
    const visibleMenuItems = subMenuItems.filter( ( item ) => ! item.hidden );

    return (
        <Block>
			<BlockHeading title={ subMenu.title } controls={ undefined } />

			<BlockContent className="px-0 py-0 pb-4">
				<div className="flex flex-col justify-start">
					{
						visibleMenuItems.map( ( item ) => {
							return (
								<SubNavigationItem key={ item.id } item={ item } from={ from } to={ to } params={ { [ paramKey ]: item.id } } />
							);
						})
					}
				</div>
			</BlockContent>
		</Block>
    );
};

export default SubNavigation;
