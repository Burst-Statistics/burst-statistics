// @ts-check
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config.js';

/**
 * Marketing screenshots for burst-statistics.com. Every shot is defined in
 * automation/screenshots/manifest.json and the approved images live in
 * automation/screenshots/baselines/. See automation/README.md ("Website screenshots").
 *
 *   npm run screenshots          compare against the baselines, open the report on a diff
 *   npm run screenshots:update   write new baselines
 *
 * Baselines are only generated in CI (screenshots:generate): Chromium renders slightly
 * differently per OS, so a local run is for checking, never for committing baselines.
 */
export default defineConfig({
	...base,
	testDir: './tests/e2e/specs-screenshots',
	snapshotPathTemplate: 'automation/screenshots/baselines/{arg}{ext}',
	fullyParallel: false,
	workers: 1,
	// A shot is deterministic, so a retry only absorbs a slow or stalled test server.
	retries: 1,
	timeout: 120_000,
	reporter: [ [ 'html', { outputFolder: 'playwright-report-screenshots', open: 'never' } ], [ 'list' ] ],
	expect: {
		toHaveScreenshot: {
			animations: 'disabled',
			caret: 'hide',
			scale: 'device',
			maxDiffPixelRatio: 0.001,
		},
	},
	use: {
		...base.use,
		...devices[ 'Desktop Chrome' ],
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 2,
		locale: 'en-US',
		timezoneId: 'Europe/Amsterdam',
		trace: 'retain-on-failure',
	},
	projects: [ { name: 'screenshots' } ],
});
