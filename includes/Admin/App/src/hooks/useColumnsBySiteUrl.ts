import { useMemo } from 'react';
import useSiteUrl from '@/hooks/useSiteUrl';

const useColumnsBySiteUrl = <T>( getColumns: ( args: { siteUrl: string }) => T ): T => {
	const siteUrl = useSiteUrl();

	return useMemo( () => getColumns({ siteUrl }), [ getColumns, siteUrl ]);
};

export default useColumnsBySiteUrl;
