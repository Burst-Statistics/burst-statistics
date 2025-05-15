const { exec } = require('child_process');
const path = require('path');
const {test, expect} = require('@playwright/test');

function wpCli(command) {
    return new Promise((resolve, reject) => {
        const baseUrl = process.env.BASE_URL || 'http://localhost:8888';
        const isWpEnv = baseUrl.includes(':8888');
        let fullCommand;
        if (isWpEnv) {
            const wpContentPath = process.cwd(); // assumed to be plugin root
            fullCommand = `cd ${wpContentPath} && npx wp-env run cli wp ${command} --allow-root`;
        } else {
            const wpPath = '/var/www/html';
            fullCommand = `cd ${wpPath} && wp ${command} --allow-root`;
        }
        // console.log("executing: ", fullCommand);
        exec(fullCommand, {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024 // 10 MB
        }, (error, stdout, stderr) => {
            if ( error) {
                if (!error.message.includes('Does it exist?') ){
                    console.error('❌ WP-CLI command failed:', stderr || error.message);
                    //fail the test that is running
                    let failed= true;
                    expect(failed).toBe(false);
                }
                resolve('');
            } else {
                resolve(stdout);
            }
        });
    });
}

module.exports = { wpCli };
