const tailwindcss = require('@tailwindcss/postcss');
const removeCascadeLayers = require('./postcss-remove-layers.js');

module.exports = {
    plugins: [
        tailwindcss(),
        removeCascadeLayers(),
    ],
};