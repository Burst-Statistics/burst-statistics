import {memo} from 'react';
import { Link } from '@tanstack/react-router';

const menuItemClassName = [
  'py-3 px-5',
  'rounded-sm',
  'border-l-4 border-transparent',
  'text-black',
  'text-md',
  'hover:border-gray-500 hover:bg-gray-100',
  '[&.active]:border-primary [&.active]:font-bold [&.active]:text-primary',
  'focus:outline-none'
].join( ' ' );

const SettingsNavigationItem = memo( ({ item }) => {
  return (
    <Link
      to={'$settingsId/'}
      from={'/settings/'}
      params={{ settingsId: item.id }}
      className={menuItemClassName}
    >
      {item.title}
    </Link>
  );
});

SettingsNavigationItem.displayName = 'SettingsNavigationItem';

export default SettingsNavigationItem;
