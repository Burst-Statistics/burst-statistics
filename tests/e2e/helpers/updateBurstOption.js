const { wpCli } = require('../helpers/wpCli');

/**
 * Update burst_options_settings safely using patch add/update
 * @param {Object} options
 */
async function updateBurstOption(options) {
    const flags = Object.entries(options)
        .map(([key, value]) => `--${key}=${value}`)
        .join(' ');

    await wpCli(`burst save ${flags}`);

}
export { updateBurstOption };
