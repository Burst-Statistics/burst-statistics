import tailwindcss from '@tailwindcss/postcss';
import postcssLightningcss from 'postcss-lightningcss';
import removeCascadeLayers from './postcss-remove-layers.mjs';

/*
 * Downlevel modern CSS (oklch(), color-mix(), range media queries, @property,
 * native nesting) to syntax that older CSS parsers understand. This is not
 * about real browser coverage — modern browsers handle the original output
 * fine — but about CSS-rewriting middleware on the client side: HTTPS-scanning
 * antivirus suites (Kaspersky, ESET, Bitdefender, ...) and corporate proxies
 * (ZScaler, BlueCoat, ...) ship outdated minifiers that can drop the rest of a
 * stylesheet on the first unrecognised at-rule, causing the dashboard to
 * render unstyled. Targets are deliberately a few years behind the actual
 * browser support matrix so lightningcss emits the legacy syntax.
 */
const downlevelTargets =
    'chrome >= 100, firefox >= 100, safari >= 15, edge >= 100';

export default {
    plugins: [
        tailwindcss(),
        removeCascadeLayers(),
        postcssLightningcss({
            browsers: downlevelTargets,
        }),
    ],
};
