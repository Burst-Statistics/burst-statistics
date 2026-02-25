const { test, expect } = require( '@playwright/test' );
const { login } = require( '../helpers/auth' );
const { wpCli } = require( '../helpers/wpCli' );
const path = require( 'path' );
const { getTableData } = require( '../helpers/getTableData' );
const { setPermalinkStructure } = require( '../helpers/setPermalinkStructure' );
const fs = require( 'fs' );
const {debugHasError} = require("../helpers/debugHasError");

test.describe.configure( {
	mode: 'serial',
	retries: 0,
} );

/**
 * Set archive settings in Burst plugin.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {string} action - The archive action to set ('Automatically Delete' or 'Automatically Archive').
 * @param {number} months - The number of months after which to archive or delete data.
 * @return {Promise<void>}
 */
const setArchiveSettings = async ( page, action, months ) => {
	console.log( `[Settings] Setting ${ action }, months: ${ months }` );

	await page.goto( '/wp-admin/admin.php?page=burst#/settings/data', {
		waitUntil: 'domcontentloaded',
	} );

	await page.waitForTimeout( 2000 );
	await page.screenshot( { path: `screenshots/settings-page-${ Date.now() }.png`, fullPage: true } );

	await page.selectOption( 'select', { label: action } );
	await page.fill( '#archive_after_months', months.toString() );
	await page.screenshot( { path: `screenshots/settings-filled-${ Date.now() }.png`, fullPage: true } );

	if ( action === 'Automatically Delete' ) {
		const confirmDeleteSwitch = page.locator('#confirm_delete_data');

		if (await confirmDeleteSwitch.getAttribute('data-state') === 'unchecked') {
			await confirmDeleteSwitch.click();
		}
	}

	await page.click( 'button.burst-save' );
	await page.waitForTimeout( 2000 );
	console.log( '[Settings] Saved successfully' );
	await page.screenshot( { path: `screenshots/settings-saved-${ Date.now() }.png`, fullPage: true } );
};

/**
 * Execute the Burst daily cron using wp-cli.
 *
 * @return {Promise<void>}
 */
const executeBurstDailyCron = async () => {
	console.log( '[Cron] Executing burst_daily...' );
	await wpCli( 'cron event run burst_daily' );
	console.log( '[Cron] Completed burst_daily' );
};

/**
 * Restore sample backup data via SQL import (wp-env aware).
 *
 * This function will:
 *  - In CI: expect a local file at tests/e2e/specs-archive/burst-backup.sql (resolved from __dirname)
 *  - Locally: ask WP for WP_PLUGIN_DIR and build a container path to the SQL file
 *
 * Throws on missing file or import failure.
 */
const backUpTheDataToArchive = async () => {
	console.log( '\n===== 🔄 [Backup] Starting SQL data restore =====' );
	console.log( `[Backup] Environment: ${ process.env.CI ? 'CI' : 'Local wp-env' }` );

	let backUpPath;

	if ( process.env.CI ) {
		console.log( '[Backup] CI mode → using local SQL file' );
		backUpPath = path.resolve( __dirname, 'burst-backup.sql' );
		console.log( `[Backup] Local path: ${ backUpPath }` );

		if ( ! fs.existsSync( backUpPath ) ) {
			console.error( '❌ [Backup] SQL file missing in CI' );
			throw new Error( 'CI SQL file missing' );
		}

		console.log( '✅ [Backup] Local SQL file found' );
	} else {
		console.log( '[Backup] Local wp-env mode → detecting plugin path via WordPress' );

		const pluginDir = ( await wpCli( `eval "echo WP_PLUGIN_DIR;"` ) ).trim();
		const pluginSlug = 'burst-statistics';

		backUpPath = `${ pluginDir }/${ pluginSlug }/tests/e2e/specs-archive/burst-backup.sql`;

		console.log( `[Backup] WP_PLUGIN_DIR: ${ pluginDir }` );
		console.log( `[Backup] Plugin: ${ pluginSlug }` );
		console.log( `[Backup] Container SQL path: ${ backUpPath }` );

		const exists = await wpCli( `eval "echo file_exists('${ backUpPath }') ? 'yes' : 'no';"` );

		if ( ! String( exists ).includes( 'yes' ) ) {
			console.error( '❌ [Backup] SQL file NOT found inside wp-env container' );
			throw new Error( 'SQL file missing inside container' );
		}

		console.log( '✅ [Backup] SQL file found inside wp-env' );
	}

	console.log( '[Backup] Importing into DB...' );

	try {
		await wpCli( `db import '${ backUpPath }'` );
		console.log( '✅ [Backup] Database import complete' );
	} catch ( err ) {
		console.error( '❌ [Backup] Import failed' );
		console.error( err.stdout || err.stderr || err );
		throw err;
	}

	console.log( '===== 🎉 [Backup] Completed =====\n' );
};

/**
 * Check if a file exists inside the WP environment.
 *
 * @param {string} filePath - Absolute path to file.
 * @return {Promise<boolean>}
 */
const fileExists = async ( filePath ) => {
	const res = await wpCli( `eval "echo file_exists('${ filePath }') ? 'yes' : 'no';"` );
	return String( res ).trim() === 'yes';
};

/**
 * Parse raw CSV content into a 2D row array.
 *
 * @param {string} csvContent
 * @return {Array<Array<string>>}
 */
function parseCsv( csvContent ) {
	return csvContent
	  .trim()
	  .split( '\n' )
	  .map( row => row.split( ',' ) );
}

test.describe( 'Data archive functionality', () => {

	test( 'Verify delete archive settings are stored and displayed correctly', async ( { page } ) => {
		test.setTimeout( 180000 );
		console.log( '\n===== 🧪 [Test] Delete Archive Settings =====' );

		await login( page );
		
		await page.screenshot( { path: `screenshots/logged-in-${ Date.now() }.png`, fullPage: true } );
		await setPermalinkStructure( 'pretty', page );

		await page.goto( '/wp-admin/admin.php?page=burst#/settings/data', {
			waitUntil: 'domcontentloaded',
		} );

		await page.waitForTimeout( 1000 );

		//check if delete option is enabled.
		const deleteOption = page.locator( 'select option[value="delete"]' );
		await expect( deleteOption ).not.toBeDisabled();

		await setArchiveSettings( page, 'Automatically Delete', 12 );

		console.log( '[Test] Reloading page to verify...' );
		await page.reload( { waitUntil: 'domcontentloaded' } );
		await page.waitForTimeout( 2000 );
		await page.screenshot( { path: `screenshots/delete-settings-reloaded-${ Date.now() }.png`, fullPage: true } );

		await page.waitForSelector( 'select', { state: 'attached' } );
		const storedValue = await page.$eval( 'select', el => el.value );
		const value = await page.inputValue( '#archive_after_months' );

		console.log( `[Test] Values - months: ${ value }, action: ${ storedValue }` );
		expect( value ).toBe( '12' );
		expect( storedValue ).toBe( 'delete' );

		const hasErrors = await debugHasError();
		expect(hasErrors).toBe(false);

		console.log( '[Test] ✓ PASSED\n' );
	} );

	test( 'Verify restore archive settings are disabled', async ( { page } ) => {
		test.setTimeout( 180000 );
		console.log( '\n===== 🧪 [Test] Restore Archive Settings =====' );

		await setPermalinkStructure( 'pretty', page );
		await login( page );

		await page.goto( '/wp-admin/admin.php?page=burst#/settings/data', {
			waitUntil: 'domcontentloaded',
		} );

		await page.waitForTimeout( 1000 );

		//check if archive option is disabled.
		const archiveOption = page.locator( 'select option[value="archive"]' );
		await expect( archiveOption ).toBeDisabled();
		console.log( '[Test] ✓ PASSED\n' );
	} );


	test( 'Verify data deletion', async ( { page } ) => {
		test.setTimeout( 420000 );

		await setPermalinkStructure( 'pretty', page );
		await login( page );

		await page.goto( '/wp-admin/admin.php?page=burst#/settings/data', {
			waitUntil: 'domcontentloaded',
		} );

		const jan2022Epoch = Math.floor( new Date( '2022-01-01T00:00:00Z' ).getTime() / 1000 );
		const dec2021Epoch = Math.floor( new Date( '2021-12-01T00:00:00Z' ).getTime() / 1000 );

		console.log( '\n--- Testing Delete Functionality ---' );
		await setArchiveSettings( page, 'Automatically Delete', 12 );

		console.log( '[Delete] Verifying data exists before deletion...' );
		const dataBeforeDelete = await getTableData(
			'wp_burst_statistics',
			{ where: `time >= ${ dec2021Epoch } AND time < ${ jan2022Epoch }` }
		);
		console.log( `[Delete] DB rows before delete: ${ dataBeforeDelete.length }` );
		expect( dataBeforeDelete.length ).toBeGreaterThan( 0 );

		console.log( '[Delete] Executing burst_daily cron to trigger deletion...' );
		await executeBurstDailyCron();

		await page.reload( { waitUntil: 'domcontentloaded' } );
		await page.waitForTimeout( 2000 );
		await page.screenshot( { path: `screenshots/after-delete-${ Date.now() }.png`, fullPage: true } );

		console.log( '[Delete] Verifying data has been deleted...' );
		const dataAfterDelete = await getTableData(
			'wp_burst_statistics',
			{ where: `time >= ${ dec2021Epoch } AND time < ${ jan2022Epoch }` }
		);
		console.log( `[Delete] DB rows after delete: ${ dataAfterDelete.length }` );

		expect( dataAfterDelete.length ).toBe( 0 );
		console.log( '[Delete] ✓ Data successfully deleted' );

		const hasErrors = await debugHasError();
		expect(hasErrors).toBe(false);

		console.log( '\n[Test] ✓ PASSED\n' );
	} );
} );

