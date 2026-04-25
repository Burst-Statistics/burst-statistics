/**
 * WooCommerce Subscriptions Tab E2E Tests
 *
 * Verifies that the free version of Burst Statistics handles eCommerce plugins correctly:
 * - Default: no Sales tab, no Subscriptions tab
 * - WooCommerce: Sales tab with pro upsell, no Subscriptions tab
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
	'woocommerce-subscriptions': 'woocommerce-subscriptions.zip',
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
	await deactivatePlugin('easy-digital-downloads');
	await deactivatePlugin('woocommerce');
	await removeFixturePlugin('woocommerce-subscriptions');
	await clearDebugLog();
});

test.afterEach(async () => {
	await clearDebugLog();
});

test.afterAll(async () => {
	await deactivatePlugin('woocommerce');
	await removeFixturePlugin('woocommerce-subscriptions');
});

test.describe('📦 WooCommerce eCommerce Tabs', () => {
	test('Default: no Sales tab, no Subscriptions tab', async ({ page }) => {
		test.setTimeout(120000);

		await loadDashboard(page);

		const salesLink = page.locator('a[href*="#/sales"]');
		await expect(salesLink).toHaveCount(0);

		const subscriptionsLink = page.locator('a[href*="subscriptions"]');
		await expect(subscriptionsLink).toHaveCount(0);

		console.log('✅ No Sales tab and no Subscriptions tab without any ecommerce plugin.');
		await page.screenshot({ path: 'screenshots/woocommerce-default-no-tabs.png' });

		const hasErrors = await debugHasError();
		expect(hasErrors).toBe(false);
		console.log('✅ No errors detected.');
	});

	test('WooCommerce installed: Sales tab visible with pro upsell, no Subscriptions tab', async ({ page }) => {
		test.setTimeout(120000);

		try {
			console.log('⏳ Installing WooCommerce...');
			const out = await wpCli('plugin install woocommerce');
			console.log('✅ WooCommerce install output:', out);
		} catch (error) {
			console.error('❌ Failed to install WooCommerce:', error);
		}
		await activatePlugin('woocommerce');

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
		await page.screenshot({ path: 'screenshots/woocommerce-sales-upsell.png' });

		const hasErrors = await debugHasError();
		expect(hasErrors).toBe(false);
		console.log('✅ No errors detected.');
	});

	test('Subscriptions installed: Sales tab visible with pro upsell, no Subscriptions tab', async ({ page }) => {
		test.setTimeout(120000);

		// WooCommerce is already active from the previous test
		await installFixturePlugin('woocommerce-subscriptions');

		await loadDashboard(page);

		const salesLink = page.locator('a[href*="#/sales"]').first();
		await expect(salesLink).toBeVisible({ timeout: 10000 });

		const subscriptionsLink = page.locator('a[href*="subscriptions"]');
		await page.screenshot({ path: 'screenshots/woo-subs-debug-failed.png', fullPage: true });
		await expect(subscriptionsLink).toHaveCount(0);

		await salesLink.click();
		
		// Pro upsell should be visible on the sales tab
		const proUpsell = page.locator('.burst-upsell-overlay').locator('text=Upgrade to Pro');
		await expect(proUpsell.first()).toBeVisible({ timeout: 10000 });
		
		console.log('✅ Sales tab visible with pro upsell, no Subscriptions tab even with subscriptions installed.');
		await page.screenshot({ path: 'screenshots/woocommerce-subs-sales-upsell.png' });

		const hasErrors = await debugHasError();
		expect(hasErrors).toBe(false);
		console.log('✅ No errors detected.');
	});
});
