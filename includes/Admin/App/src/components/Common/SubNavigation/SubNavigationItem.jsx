import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import clsx from 'clsx';

const menuItemClassName = clsx(
    [
        'py-3 px-5',
        'rounded-sm',
        'border-l-4 border-transparent',
        'text-black',
        'text-md',
        'hover:border-gray-500 hover:bg-gray-100',
        '[&.active]:border-primary [&.active]:font-bold [&.active]:text-primary',
        'focus:outline-none'
    ]
);

const SettingsNavigationItem = memo( ({ item, from, to, params }) => {
    return (
        <Link
            to={ to }
            from={ from }
            params={ params }
            className={menuItemClassName}
        >
			{item.title}
		</Link>
    );
});

SettingsNavigationItem.displayName = 'SettingsNavigationItem';

export default SettingsNavigationItem;
