import { createRoot } from '@wordpress/element';
import './otherplugins.css';
import OtherPluginsBlock from "@/components/OtherPluginsBlock.js";

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('teamupdraft-other-plugins');
    if (container) {
        const root = createRoot(container);
        root.render(
            <OtherPluginsBlock />
        );
    }
});