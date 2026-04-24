const { exec } = require('child_process');
const {expect} = require('@playwright/test');

function wpCli(command, options = {}) {
    return new Promise((resolve, reject) => {
        const normalizedOptions = options || {};
        const baseUrl = process.env.BASE_URL || 'http://localhost:8888';
        const isWpEnv = baseUrl.includes(':8888');
        let fullCommand;
        if (isWpEnv) {
            const wpContentPath = process.cwd(); // assumed to be plugin root
            fullCommand = `cd "${wpContentPath}" && npx wp-env run cli wp ${command} --allow-root`;
        } else {
            const wpPath = '/var/www/html';
            fullCommand = `cd "${wpPath}" && wp ${command} --allow-root`;
        }
        // console.log("executing: ", fullCommand);
        exec(
            fullCommand, {
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024 // 10 MB
            },
            (error, stdout, stderr) => {
                if (error) {
                    if (!error.message.includes("Does it exist?")) {
                        if (!normalizedOptions.allowFailure) {
                            console.error("❌ WP-CLI command failed:", stderr || error.message);
                            // Fail the test that is running.
                            let failed = true;
                            expect(failed).toBe(false);
                        }
                    }

                    if (normalizedOptions.allowFailure) {
                        reject(error);
                    } else {
                        resolve("");
                    }
                } else {
                    resolve(stdout);
                }
            },
        );
    });
}

module.exports = { wpCli };
