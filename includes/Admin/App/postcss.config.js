module.exports = {
  plugins: {
    'postcss-import': {},
    tailwindcss: {},
    autoprefixer: {},
    'postcss-prefix-selector': {
      prefix: '#burst-statistics',
      transform: function (prefix, selector, prefixedSelector) {
        if (selector.includes('#burst-statistics') || selector === ':root' || selector === 'html') {
          return selector;
        }
        return prefixedSelector;
      }
    },
  },
}
