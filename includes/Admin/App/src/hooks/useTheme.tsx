import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState
} from 'react';
import { getLocalStorage, removeLocalStorage, setLocalStorage } from '@/utils/api';

type ThemeMode = 'light' | 'dark';
type ThemePreference = ThemeMode | 'system';

interface ThemeContextValue {
	theme: ThemeMode;
	themePreference: ThemePreference;
	isDarkTheme: boolean;
	isHostManagedContext: boolean;
	setTheme: ( theme: ThemeMode ) => void;
	setThemePreference: ( preference: ThemePreference ) => void;
	toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'theme_preference';
const HOST_DARK_THEME_CLASSES = [
	'mainwp-default-dark-theme',
	'updraft-central-default-dark-theme'
];
const HOST_LIGHT_THEME_CLASSES = [
	'mainwp-default-theme',
	'updraft-central-default-theme'
];
const HOST_UI_CLASSES = [ 'mainwp-ui', 'updraft-central-ui' ];
const DASHBOARD_DARK_THEME_CLASS = 'dashboard-default-dark-theme';
const DASHBOARD_LIGHT_THEME_CLASS = 'dashboard-default-theme';
const ALL_DARK_THEME_CLASSES = [
	...HOST_DARK_THEME_CLASSES,
	DASHBOARD_DARK_THEME_CLASS
];

const ThemeContext = createContext<ThemeContextValue | undefined>( undefined );

const getBodyTheme = (): ThemeMode => {
	if ( 'undefined' === typeof document ) {
		return 'light';
	}

	return ALL_DARK_THEME_CLASSES.some( ( className ) =>
		document.body.classList.contains( className )
	) ?
		'dark' :
		'light';
};

const getIsHostManagedContext = () => {
	if ( 'undefined' === typeof document ) {
		return false;
	}

	return HOST_UI_CLASSES.some( ( className ) =>
		document.body.classList.contains( className )
	);
};

const getStoredTheme = (): ThemeMode | null => {
	const storedTheme = getLocalStorage( THEME_STORAGE_KEY, null );
	return 'dark' === storedTheme || 'light' === storedTheme ? storedTheme : null;
};

const getSystemThemePreference = (): ThemeMode => {
	if ( 'undefined' === typeof window || ! window.matchMedia ) {
		return 'light';
	}

	return window.matchMedia( '(prefers-color-scheme: dark)' ).matches ?
		'dark' :
		'light';
};

const getAppWrapperElement = () => {
	if ( 'undefined' === typeof document ) {
		return null;
	}

	const explicitWrapper = document.getElementById( 'burst-statistics-wrapper' );
	if ( explicitWrapper ) {
		return explicitWrapper;
	}

	const legacyWrapper = document.getElementById( 'mainwp-burst-statistics' );
	if ( legacyWrapper ) {
		return legacyWrapper;
	}

	const container = document.getElementById( 'burst-statistics' );
	return container?.parentElement || null;
};

const applyThemeToContainer = ( theme: ThemeMode ) => {
	if ( 'undefined' === typeof document ) {
		return;
	}

	const wrapper = getAppWrapperElement();
	if ( wrapper ) {
		wrapper.classList.add( 'burst-statistics-wrapper' );
	}

	const container = document.getElementById( 'burst-statistics' );
	if ( container ) {
		container.classList.toggle( 'dark', 'dark' === theme );
	}
};

const syncDashboardThemeClass = ( theme: ThemeMode ) => {
	if ( 'undefined' === typeof document ) {
		return;
	}

	document.body.classList.remove(
		DASHBOARD_DARK_THEME_CLASS,
		DASHBOARD_LIGHT_THEME_CLASS
	);
	document.body.classList.add(
		'dark' === theme ? DASHBOARD_DARK_THEME_CLASS : DASHBOARD_LIGHT_THEME_CLASS
	);
};

const applyThemeToDom = ( theme: ThemeMode ) => {
	if ( 'undefined' === typeof document ) {
		return;
	}

	HOST_DARK_THEME_CLASSES.forEach( ( className ) => {
		document.body.classList.remove( className );
	});
	HOST_LIGHT_THEME_CLASSES.forEach( ( className ) => {
		document.body.classList.remove( className );
	});
	syncDashboardThemeClass( theme );
	applyThemeToContainer( theme );
};

const getInitialTheme = (): {
	theme: ThemeMode;
	themePreference: ThemePreference;
	hasStoredPreference: boolean;
	isHostManagedContext: boolean;
} => {
	const isHostManagedContext = getIsHostManagedContext();
	const storedTheme = getStoredTheme();

	if ( ! isHostManagedContext && storedTheme ) {
		return {
			theme: storedTheme,
			themePreference: storedTheme,
			hasStoredPreference: true,
			isHostManagedContext
		};
	}

	if ( ! isHostManagedContext ) {
		const systemTheme = getSystemThemePreference();
		return {
			theme: systemTheme,
			themePreference: 'system',
			hasStoredPreference: false,
			isHostManagedContext
		};
	}

	return {
		theme: getBodyTheme(),
		themePreference: 'system',
		hasStoredPreference: false,
		isHostManagedContext
	};
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
	const [ { theme, themePreference, hasStoredPreference, isHostManagedContext }, setThemeState ] =
		useState( getInitialTheme );

	useEffect( () => {
		if ( isHostManagedContext ) {
			applyThemeToContainer( theme );
			syncDashboardThemeClass( theme );
			return;
		}

		applyThemeToDom( theme );
	}, [ isHostManagedContext, theme ]);

	useEffect( () => {
		const observer = new MutationObserver( () => {
			const isHostContext = getIsHostManagedContext();
			const bodyTheme = getBodyTheme();

			if ( isHostContext ) {
				setThemeState( ( current ) => {
					if (
						current.isHostManagedContext &&
						! current.hasStoredPreference &&
						current.theme === bodyTheme
					) {
						return current;
					}

					return {
						theme: bodyTheme,
						themePreference: 'system',
						hasStoredPreference: false,
						isHostManagedContext: true
					};
				});
				return;
			}

			if ( hasStoredPreference ) {
				if ( bodyTheme !== theme ) {
					applyThemeToDom( theme );
				}
				return;
			}

			setThemeState( ( current ) => {
				if ( current.isHostManagedContext ) {
					const storedTheme = getStoredTheme();

					if ( storedTheme ) {
						return {
							theme: storedTheme,
							themePreference: storedTheme,
							hasStoredPreference: true,
							isHostManagedContext: false
						};
					}

					if ( current.theme === bodyTheme ) {
						return {
							...current,
							themePreference: 'system',
							hasStoredPreference: false,
							isHostManagedContext: false
						};
					}

					return {
						theme: getSystemThemePreference(),
						themePreference: 'system',
						hasStoredPreference: false,
						isHostManagedContext: false
					};
				}

				if ( current.theme === bodyTheme ) {
					return current;
				}

				return {
					...current,
					themePreference: current.hasStoredPreference ? current.theme : 'system',
					theme: bodyTheme
				};
			});
		});

		observer.observe( document.body, {
			attributes: true,
			attributeFilter: [ 'class' ]
		});

		return () => observer.disconnect();
	}, [ hasStoredPreference, theme ]);

	useEffect( () => {
		if (
			isHostManagedContext ||
			hasStoredPreference ||
			'undefined' === typeof window ||
			! window.matchMedia
		) {
			return;
		}

		const mediaQuery = window.matchMedia( '(prefers-color-scheme: dark)' );

		const syncThemeWithSystemPreference = () => {
			setThemeState( ( current ) => {
				if ( current.hasStoredPreference || current.isHostManagedContext ) {
					return current;
				}

				const preferredTheme = mediaQuery.matches ? 'dark' : 'light';
				if ( current.theme === preferredTheme ) {
					return current;
				}

				return {
					...current,
					themePreference: 'system',
					theme: preferredTheme
				};
			});
		};

		syncThemeWithSystemPreference();

		if ( mediaQuery.addEventListener ) {
			mediaQuery.addEventListener( 'change', syncThemeWithSystemPreference );
			return () => {
				mediaQuery.removeEventListener( 'change', syncThemeWithSystemPreference );
			};
		}

		mediaQuery.addListener( syncThemeWithSystemPreference );
		return () => {
			mediaQuery.removeListener( syncThemeWithSystemPreference );
		};
	}, [ hasStoredPreference, isHostManagedContext ]);

	const setThemePreference = useCallback( ( preference: ThemePreference ) => {
		if ( getIsHostManagedContext() ) {
			setThemeState({
				theme: getBodyTheme(),
				themePreference: 'system',
				hasStoredPreference: false,
				isHostManagedContext: true
			});
			return;
		}

		if ( 'system' === preference ) {
			removeLocalStorage( THEME_STORAGE_KEY );
			setThemeState({
				theme: getSystemThemePreference(),
				themePreference: 'system',
				hasStoredPreference: false,
				isHostManagedContext: false
			});
			return;
		}

		setLocalStorage( THEME_STORAGE_KEY, preference );
		setThemeState({
			theme: preference,
			themePreference: preference,
			hasStoredPreference: true,
			isHostManagedContext: false
		});
	}, []);

	const setTheme = useCallback(
		( nextTheme: ThemeMode ) => setThemePreference( nextTheme ),
		[ setThemePreference ]
	);

	const toggleTheme = useCallback( () => {
		setTheme( 'dark' === theme ? 'light' : 'dark' );
	}, [ setTheme, theme ]);

	const value = useMemo(
		() => ({
			theme,
			themePreference,
			isDarkTheme: 'dark' === theme,
			isHostManagedContext,
			setTheme,
			setThemePreference,
			toggleTheme
		}),
		[
			isHostManagedContext,
			setTheme,
			setThemePreference,
			theme,
			themePreference,
			toggleTheme
		]
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
};

export const useTheme = () => {
	const context = useContext( ThemeContext );

	if ( ! context ) {
		throw new Error( 'useTheme must be used within a ThemeProvider' );
	}

	return context;
};
