import { wpCli } from "./wpCli";

/**
 * Wait until the WordPress option `burst_run_activation` is falsy.
 *
 * While this option is truthy, Burst's activation routine is still running,
 * which can race with option updates, schema changes and tracking setup.
 *
 * WP-CLI returns "1" for boolean true and an empty string for boolean false
 * or a non-existing option, so we treat empty / "0" / "false" as done.
 *
 * @param page
 */
async function waitForActivation(page) {
    const start = Date.now();
    const timeoutMs = 30000;
    const intervalMs = 500;
    while (Date.now() - start < timeoutMs) {
        const raw = await wpCli("option get burst_run_activation");
        const value = (raw || "").trim().toLowerCase();

        // Empty output = option does not exist or is boolean false.
        if (value === "" || value === "0" || value === "false") {
            console.log("burst_run_activation is false, activation complete");
            return;
        }


        //activation not completed yet. Load a page to trigger activation.
        await page.goto('wp-admin', { waitUntil: 'domcontentloaded' });
        console.log(`burst_run_activation still truthy (value: "${value}"), waiting...`);
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(
        `Timed out after ${timeoutMs}ms waiting for burst_run_activation to become false`
    );
}

export { waitForActivation };