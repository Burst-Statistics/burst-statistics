import tailwindcss from '@tailwindcss/postcss';
import removeCascadeLayers from './postcss-remove-layers.mjs';

export default {
    plugins: [
        tailwindcss(),
        removeCascadeLayers(),
    ],
};
