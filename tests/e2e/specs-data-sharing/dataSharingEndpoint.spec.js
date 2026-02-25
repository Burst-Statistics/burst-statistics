const { test, expect } = require('@playwright/test');
const {login} = require("../helpers/auth");
const {debugHasError} = require("../helpers/debugHasError");
const {wpCli} = require("../helpers/wpCli");

test('data sharing endpoint should accept and validate test data without storing it', async ({ page }) => {
    await login(page);

    // Execute the test telemetry send via WP-CLI command
    const result = await wpCli('burst send_test_telemetry --endpoint="https://api.burst-statistics.com/v1/telemetry"');

    // Parse the response
    let response;
    try {
        // The response includes both the JSON output and the success message
        // Extract just the JSON part
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            response = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error('No JSON found in response');
        }
    } catch (e) {
        console.error('Failed to parse response:', result);
        throw e;
    }

    // Log the response for debugging
    console.log('Test telemetry response:', response);

    // Verify the response is successful
    expect(response.success).toBe(true);

    // If there's a status code, it should be 2xx
    if (response.status_code) {
        expect(response.status_code).toBeGreaterThanOrEqual(200);
        expect(response.status_code).toBeLessThan(300);
    }

    // Verify the endpoint was called
    expect(response.endpoint).toBeDefined();

    // Verify no errors in the debug log
    await new Promise(resolve => setTimeout(resolve, 500));
    const hasErrors = await debugHasError();
    expect(hasErrors).toBe(false);
});
