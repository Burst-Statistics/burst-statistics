/**
 * PostCSS plugin that removes all CSS cascade @layer declarations.
 *
 * @layer blocks are unwrapped (their contents are kept, the wrapper is removed).
 * @layer statements (no block) are removed entirely.
 *
 * This avoids WordPress cascade-layer ordering conflicts when Tailwind v4
 * generates nested layer rules inside app-scoped selectors.
 */
const postcssRemoveCascadeLayers = () => ({
    postcssPlugin: 'postcss-remove-cascade-layers',
    OnceExit(root) {
        let hasLayers = true;
        while (hasLayers) {
            hasLayers = false;
            root.walkAtRules('layer', (atRule) => {
                hasLayers = true;
                if (atRule.nodes) {
                    atRule.replaceWith(atRule.nodes);
                    return;
                }
                atRule.remove();
            });
        }
    },
});

postcssRemoveCascadeLayers.postcss = true;

module.exports = postcssRemoveCascadeLayers;
