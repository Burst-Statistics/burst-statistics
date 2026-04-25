/**
 * EDD Subscriptions Tab E2E Tests
 *
 * Verifies that the free version of Burst Statistics handles eCommerce plugins correctly:
 * - Default: no Sales tab, no Subscriptions tab
 * - EDD: Sales tab with pro upsell, no Subscriptions tab
 * - Subscriptions: Sales tab with pro upsell, no Subscriptions tab
 */
const fs = require('fs');
const path = require('path');
const { wpCli } = require('../helpers/wpCli');
const { login } = require( '../helpers/auth' );
const { test, expect } = require('@playwright/test');
const { debugHasError } = require('../helpers/debugHasError');
const { clearDebugLog } = require('../helpers/getDebugLog');
const { dismissOnboarding } = require('../helpers/dismissOnboarding');

test.describe.configure({
	mode: 'serial',
	retries: 0,
});

const FIXTURES = {
	'edd-recurring': 'edd-recurring.zip',
};

async function getFixturePath(zipName) {
	return path.resolve(__dirname, '../fixtures/plugins', zipName);
}

async function installFixturePlugin(key) {
	const zipPath = await getFixturePath(FIXTURES[key]);
	await wpCli(`plugin install "${zipPath}" --activate --force`);
	console.log(`🛠 ${key} installed and activated from fixture.`);
}

async function removeFixturePlugin(key) {
	await deactivatePlugin(key);
	try {
		await wpCli(`plugin delete ${key}`, { allowFailure: true });
		console.log(`🗑 ${key} removed.`);
	} catch (error) {
		console.log(`🗑 ${key} remove skipped (not found).`);
	}
}

async function deactivatePlugin(plugin) {
	try {
		await wpCli(`plugin is-active ${plugin}`, { allowFailure: true });
		await wpCli(`plugin deactivate ${plugin}`);
		console.log(`🔌 ${plugin} deactivated.`);
	} catch (error) {
		console.log(`🔌 ${plugin} is not active or does not exist. (Skipped)`);
	}
}

async function activatePlugin(plugin) {
	try {
		await wpCli(`plugin is-active ${plugin}`, { allowFailure: true });
		console.log(`🔌 ${plugin} already active.`);
	} catch (error) {
		await wpCli(`plugin activate ${plugin}`);
		console.log(`🔌 ${plugin} activated.`);
	}
}

async function loadDashboard(page) {
	await login(page);
	await page.goto('/wp-admin/admin.php?page=burst', { waitUntil: 'domcontentloaded' });
	await dismissOnboarding(page);
	await page.waitForSelector('a[href$="page=burst#/"]', { state: 'visible', timeout: 15000 });
}

test.beforeAll(async () => {
	test.setTimeout(120000);
	await deactivatePlugin('woocommerce');
	await deactivatePlugin('easy-digital-downloads');
	await removeFixturePlugin('edd-recurring');
	await clearDebugLog();
});

test.afterEach(async () => {
	await clearDebugLog();
});

test.afterAll(async () => {
	await deactivatePlugin('easy-digital-downloads');
	await removeFixturePlugin('edd-recurring');
});

test.describe('📦 EDD eCommerce Tabs', () => {
	test('Default: no Sales tab, no Subscriptions tab', async ({ page }) => {
		test.setTimeout(120000);

		await loadDashboard(page);

		const salesLink = page.locator('a[href*="#/sales"]');
		await expect(salesLink).toHaveCount(0);

		const subscriptionsLink = page.locator('a[href*="subscriptions"]');
		await expect(subscriptionsLink).toHaveCount(0);

		console.log('✅ No Sales tab and no Subscriptions tab without any ecommerce plugin.');
		await page.screenshot({ path: 'screenshots/edd-default-no-tabs.png' });

		const hasErrors = await debugHasError();
		expect(hasErrors).toBe(false);
		console.log('✅ No errors detected.');
	});

	test('EDD installed: Sales tab visible with pro upsell, no Subscriptions tab', async ({ page }) => {
		test.setTimeout(120000);

		try {
			console.log('⏳ Installing Easy Digital Downloads...');
			const out = await wpCli('plugin install easy-digital-downloads');
			console.log('✅ EDD install output:', out);
		} catch (error) {
			console.error('❌ Failed to install Easy Digital Downloads:', error);
		}
		await activatePlugin('easy-digital-downloads');

		await loadDashboard(page);

		const salesLink = page.locator('a[href*="#/sales"]').first();
		await expect(salesLink).toBeVisible({ timeout: 10000 });

		const subscriptionsLink = page.locator('a[href*="subscriptions"]');
		await expect(subscriptionsLink).toHaveCount(0);

		await salesLink.click();
		
		// Pro upsell should be visible on the sales tab
		const proUpsell = page.locator('.burst-upsell-overlay').locator('text=Upgrade to Pro');
		await expect(proUpsell.first()).toBeVisible({ timeout: 10000 });
		
		console.log('✅ Sales tab visible with pro upsell, no Subscriptions tab.');
		await page.screenshot({ path: 'screenshots/edd-sales-upsell.png' });

		const hasErrors = await debugHasError();
		expect(hasErrors).toBe(false);
		console.log('✅ No errors detected.');
	});

	test('Subscriptions installed: Sales tab visible with pro upsell, no Subscriptions tab', async ({ page }) => {
		test.setTimeout(120000);

		// EDD is already active from the previous test
		await installFixturePlugin('edd-recurring');

		await loadDashboard(page);

		const salesLink = page.locator('a[href*="#/sales"]').first();
		await expect(salesLink).toBeVisible({ timeout: 10000 });

		const subscriptionsLink = page.locator('a[href*="subscriptions"]');
		await page.screenshot({ path: 'screenshots/edd-subs-debug-failed.png', fullPage: true });
		await expect(subscriptionsLink).toHaveCount(0);

		await salesLink.click();
		
		// Pro upsell should be visible on the sales tab
		const proUpsell = page.locator('.burst-upsell-overlay').locator('text=Upgrade to Pro');
		await expect(proUpsell.first()).toBeVisible({ timeout: 10000 });
		
		console.log('✅ Sales tab visible with pro upsell, no Subscriptions tab even with subscriptions installed.');
		await page.screenshot({ path: 'screenshots/edd-subs-sales-upsell.png' });

		const hasErrors = await debugHasError();
		expect(hasErrors).toBe(false);
		console.log('✅ No errors detected.');
	});
});
