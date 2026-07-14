import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useReportLogo } from './blockHooks';

const Logo = () => {
	const { isDarkTheme } = useTheme();
	const { logoUrl, isLoadingLogo } = useReportLogo( isDarkTheme );

	return (
		<div className="flex justify-center mb-10">
			{! isLoadingLogo && logoUrl && (
				<img alt="logo" src={ logoUrl } className="h-11 w-auto px-0 py-2" />
			)}
		</div>
	);
};

export default Logo;
