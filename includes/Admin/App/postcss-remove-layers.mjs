/**
 * PostCSS plugin that removes all CSS cascade @layer declarations.
 *
 * @layer blocks are unwrapped (their contents are kept, the wrapper is removed).
 * @layer statements (no block, e.g. `@layer foo, bar;`) are removed entirely.
 *
 * This is necessary for WordPress compatibility: Tailwind v4 generates @layer rules
 * nested inside the #burst-statistics selector scope (via CSS nesting), which the
 * standard @csstools/postcss-cascade-layers polyfill cannot handle. Those nested
 * @layer declarations still affect the global cascade layer order of the document,
 * causing conflicts with WordPress core and third-party plugins that also use @layer.
 *
 * The plugin runs multiple passes until no @layer rules remain, correctly handling
 * any depth of layer nesting.
 */
const postcssRemoveCascadeLayers = () => {
    return {
        postcssPlugin: 'postcss-remove-cascade-layers',
        OnceExit(root) {
            let hasLayers = true;
            while (hasLayers) {
                hasLayers = false;
                root.walkAtRules('layer', (atRule) => {
                    hasLayers = true;
                    if (atRule.nodes) {
                        atRule.replaceWith(atRule.nodes);
                    } else {
                        atRule.remove();
                    }
                });
            }
        },
    };
};
postcssRemoveCascadeLayers.postcss = true;

export default postcssRemoveCascadeLayers;
