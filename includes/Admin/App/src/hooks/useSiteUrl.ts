import { useMemo } from 'react';

const useSiteUrl = () => {
	return useMemo( () => {
		return ( window as unknown as { burst_settings?: { site_url?: string } })
			?.burst_settings?.site_url ?? window.location.origin;
	}, []);
};

export default useSiteUrl;
