import { createRoot } from '@wordpress/element';
import Onboarding from './components/Onboarding';
import './onboarding.css';

// Create QueryClient instance once
document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('teamupdraft-onboarding');
    if (container) {
        const root = createRoot(container);
        root.render(
            <Onboarding />
        );
    }
});
