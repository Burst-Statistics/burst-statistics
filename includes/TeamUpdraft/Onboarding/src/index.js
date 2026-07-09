import { createRoot } from '@wordpress/element';
import Onboarding from './components/Onboarding';

const HOST_DARK_THEME_CLASSES = [
    'mainwp-default-dark-theme',
    'updraft-central-default-dark-theme',
    'dashboard-default-dark-theme',
];

const applyThemeToContainer = (container, isDarkTheme) => {
    container.classList.toggle('dark', isDarkTheme);
};

const getBodyTheme = () => {
    if (typeof document === 'undefined') {
        return 'light';
    }

    return HOST_DARK_THEME_CLASSES.some((className) => document.body.classList.contains(className))
        ? 'dark'
        : 'light';
};

const getSystemTheme = () => {
    if (typeof window === 'undefined' || !window.matchMedia) {
        return 'light';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Mirror the main app's stored choice (burst_ + 'theme_preference', JSON-encoded
// by setLocalStorage). Only 'light'/'dark' are persisted; 'system' removes the key.
const getStoredTheme = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }

    let raw;
    try {
        raw = localStorage.getItem('burst_theme_preference');
    } catch (e) {
        return null;
    }

    if (!raw) {
        return null;
    }

    let pref;
    try {
        pref = JSON.parse(raw);
    } catch (e) {
        pref = raw;
    }

    return pref === 'dark' || pref === 'light' ? pref : null;
};

const resolveTheme = () => {
    const bodyTheme = getBodyTheme();
    if (bodyTheme === 'dark') {
        return 'dark';
    }

    // Respect an explicit user light/dark choice over the OS setting, so forcing
    // light on a dark OS doesn't leave the onboarding stuck in dark.
    const storedTheme = getStoredTheme();
    if (storedTheme) {
        return storedTheme;
    }

    return getSystemTheme();
};

const syncOnboardingTheme = (container) => {
    applyThemeToContainer(container, resolveTheme() === 'dark');
};

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('teamupdraft-onboarding');
    if (!container) {
        return;
    }

    syncOnboardingTheme(container);

    const root = createRoot(container);
    root.render(<Onboarding />);

    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => {
            syncOnboardingTheme(container);
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class'],
        });
    }

    if (typeof window !== 'undefined' && window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = () => syncOnboardingTheme(container);

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleSystemThemeChange);
            return;
        }

        mediaQuery.addListener(handleSystemThemeChange);
    }
});
