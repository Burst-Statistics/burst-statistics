import React from 'react';
import { useNonPersistedTabsStore, TabValue } from '@/store/useTabsStore';
import { clsx } from 'clsx';

/**
 * Props for the TabsContent component.
 *
 * @interface TabsContentProps
 */
export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
    group: string;
    id: TabValue;
}

/**
 * Tab content component.
 */
export function TabsContent({
    className = '',
    group,
    id,
    children,
    ...rest
}: TabsContentProps ) {

    // React Compiler–safe: hooks are always called statically in component body.
    const { getActiveTab } = useNonPersistedTabsStore();

    const selected = getActiveTab( group ) === id;

    if ( ! selected ) {
        return null;
    }

    return (
        <div
            className={ clsx( 'burst-scroll px-2.5 md:px-6 py-8 h-[305px] overflow-y-auto rounded-none', className ) }
            {...rest}
        >
			{children}
		</div>
    );
}
