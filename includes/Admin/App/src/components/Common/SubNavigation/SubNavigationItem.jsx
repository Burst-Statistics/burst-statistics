import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import Icon from '@/utils/Icon';

const menuItemClassName = clsx(
    [
        'py-3 px-5',
        'rounded-sm',
        'border-l-4 border-transparent',
        'text-base font-medium tracking-wide text-text-gray',
        'hover:border-gray-500 hover:bg-gray-100',
        '[&.active]:border-primary [&.active]:font-bold [&.active]:text-primary [&.active]:bg-gray-100',
        'focus:outline-hidden'
    ]
);

/**
 * Sidebar link for a settings or reporting submenu entry.
 *
 * @param root0
 * @param root0.item       - Menu item from config; optional `icon` is an Icon registry name.
 * @param root0.from       - TanStack Router `from` path.
 * @param root0.to         - TanStack Router `to` path.
 * @param root0.params     - Route params including settings/reporting segment id.
 * @return {JSX.Element} Link row.
 */
const SettingsNavigationItem = memo( ({ item, from, to, params }) => {
    return (
        <Link
            to={ to }
            from={ from }
            params={ params }
            className={ clsx( menuItemClassName, 'flex items-center gap-2.5' ) }
        >
			{item.icon && '' !== item.icon && (
				<span aria-hidden="true" className="inline-flex shrink-0">
					<Icon name={ item.icon } size={ 14 } color="gray" strokeWidth={2.5}/>
				</span>
			)}
			<span className="min-w-0">{item.title}</span>
		</Link>
    );
});

SettingsNavigationItem.displayName = 'SettingsNavigationItem';

export default SettingsNavigationItem;
