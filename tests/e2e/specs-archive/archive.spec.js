const { test, expect } = require( '@playwright/test' );
const { activateLicense } = require( '../helpers/activateLicense' );
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

		await activateLicense( page );
		await setPermalinkStructure( 'pretty', page );
		await login( page );
		await page.screenshot( { path: `screenshots/logged-in-${ Date.now() }.png`, fullPage: true } );

		await page.goto( '/wp-admin/admin.php?page=burst#/settings/data', {
			waitUntil: 'domcontentloaded',
		} );

		await page.waitForTimeout( 2000 );

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

	test( 'Verify restore archive settings are stored and displayed correctly', async ( { page } ) => {
		test.setTimeout( 180000 );
		console.log( '\n===== 🧪 [Test] Restore Archive Settings =====' );

		await activateLicense( page );
		await setPermalinkStructure( 'pretty', page );
		await login( page );

		await page.goto( '/wp-admin/admin.php?page=burst#/settings/data', {
			waitUntil: 'domcontentloaded',
		} );

		await page.waitForTimeout( 2000 );

		await setArchiveSettings( page, 'Automatically Archive', 12 );

		console.log( '[Test] Reloading page to verify...' );
		await page.reload( { waitUntil: 'domcontentloaded' } );
		await page.waitForTimeout( 2000 );
		await page.screenshot( { path: `screenshots/restore-settings-reloaded-${ Date.now() }.png`, fullPage: true } );

		await page.waitForSelector( 'select', { state: 'attached' } );
		const storedValue = await page.$eval( 'select', el => el.value );
		const value = await page.inputValue( '#archive_after_months' );

		console.log( `[Test] Values - months: ${ value }, action: ${ storedValue }` );
		expect( value ).toBe( '12' );
		expect( storedValue ).toBe( 'archive' );
		const hasErrors = await debugHasError();
		expect(hasErrors).toBe(false);
		console.log( '[Test] ✓ PASSED\n' );
	} );

	test( 'Verify archive generation', async ( { page } ) => {
		test.setTimeout( 180000 );
		console.log( '\n===== 🧪 [Test] Archive Generation =====' );

		await activateLicense( page );
		await setPermalinkStructure( 'pretty', page );
		await login( page );
		await backUpTheDataToArchive();

		await page.goto( '/wp-admin/admin.php?page=burst#/settings/data', {
			waitUntil: 'domcontentloaded',
		} );

		await page.waitForTimeout( 2000 );

		await setArchiveSettings( page, 'Automatically Archive', 12 );

		/**
		 * DEC 2021 DATA (21-12.csv)
		 */
		console.log( '\n--- Archive 1: Dec 2021 (21-12) ---' );
		const dec2021Epoch = Math.floor( new Date( '2021-12-01T00:00:00Z' ).getTime() / 1000 );
		const jan2022Epoch = Math.floor( new Date( '2022-01-01T00:00:00Z' ).getTime() / 1000 );

		const dbDataBeforeArchive = await getTableData(
		  'wp_burst_statistics',
		  { where: `time >= ${ dec2021Epoch } AND time < ${ jan2022Epoch }` }
		);
		console.log( `[Archive] DB rows: ${ dbDataBeforeArchive.length }` );

		await executeBurstDailyCron();

		const uploadsPath = await wpCli( 'eval "echo wp_upload_dir()[\'basedir\'];"' );
		const archiveDirectory = await wpCli( 'option get burst_archive_dir' );
		const fullArchiveUploadsPath = path.join( uploadsPath.trim(), 'burst', archiveDirectory.trim() );
		console.log( '[Archive] Path:', fullArchiveUploadsPath );

		await page.reload( { waitUntil: 'domcontentloaded' } );
		await page.waitForTimeout( 2000 );
		await page.screenshot( { path: `screenshots/archive-21-12-${ Date.now() }.png`, fullPage: true } );

		await expect( page.locator( '#row-21-12\\.zip' ) ).toBeVisible();
		await expect( page.locator( '#cell-1-21-12\\.zip' ) ).toBeVisible();

		const firstZipPath = `${ fullArchiveUploadsPath }/21-12.zip`;
		expect( await fileExists( firstZipPath ) ).toBe( true );

		await wpCli( `burst unzip --zip_path='${ firstZipPath }' --extract_to='${ fullArchiveUploadsPath }'` );

		const csvPath2112 = `${ fullArchiveUploadsPath }/21-12.csv`;
		expect( await fileExists( csvPath2112 ) ).toBe( true );

		const csvContent2112 = await wpCli( `eval "echo file_get_contents('${ csvPath2112 }');"` );
		const csvRows2112 = parseCsv( csvContent2112 );
		const headers2112 = csvRows2112[ 0 ];

		const csvObjects2112 = csvRows2112.slice( 1 ).map( row => {
			const obj = {};
			headers2112.forEach( ( key, i ) => obj[ key ] = row[ i ] ?? null );
			return obj;
		} );
		console.log( `[Archive] CSV rows: ${ csvObjects2112.length }` );

		compareDbAndCsv( dbDataBeforeArchive, csvObjects2112, 'ID' );

		console.log( '[Archive] ✓ Data verified' );

		/**
		 * JAN 2022 DATA (22-01.csv)
		 */
		console.log( '\n--- Archive 2: Jan 2022 (22-01) ---' );
		const feb2022Epoch = Math.floor( new Date( '2022-02-01T00:00:00Z' ).getTime() / 1000 );

		const jan2022DBRows = await getTableData(
		  'wp_burst_statistics',
		  { where: `time >= ${ jan2022Epoch } AND time < ${ feb2022Epoch }` }
		);
		console.log( `[Archive] DB rows: ${ jan2022DBRows.length }` );

		await executeBurstDailyCron();

		await page.reload( { waitUntil: 'domcontentloaded' } );
		await page.waitForTimeout( 2000 );
		await page.screenshot( { path: `screenshots/archive-22-01-${ Date.now() }.png`, fullPage: true } );

		await expect( page.locator( '#row-22-01\\.zip' ) ).toBeVisible();

		const secondZipPath = `${ fullArchiveUploadsPath }/22-01.zip`;
		expect( await fileExists( secondZipPath ) ).toBe( true );

		await wpCli( `burst unzip --zip_path='${ secondZipPath }' --extract_to='${ fullArchiveUploadsPath }'` );

		const csvPath2201 = `${ fullArchiveUploadsPath }/22-01.csv`;
		expect( await fileExists( csvPath2201 ) ).toBe( true );

		const csvContent2201 = await wpCli( `eval "echo file_get_contents('${ csvPath2201 }');"` );
		const csvRows2201 = parseCsv( csvContent2201 );
		const headers2201 = csvRows2201[ 0 ];

		const csvObjects2201 = csvRows2201.slice( 1 ).map( row => {
			const obj = {};
			headers2201.forEach( ( key, i ) => obj[ key ] = row[ i ] ?? null );
			return obj;
		} );
		console.log( `[Archive] CSV rows: ${ csvObjects2201.length }` );

		compareDbAndCsv( jan2022DBRows, csvObjects2201, 'ID' );
		console.log( '[Archive] ✓ Data verified' );

		/**
		 * FEB 2022 DATA (22-02.csv)
		 */
		console.log( '\n--- Archive 3: Feb 2022 (22-02) ---' );
		const march2022Epoch = Math.floor( new Date( '2022-03-01T00:00:00Z' ).getTime() / 1000 );

		const feb2022DBRows = await getTableData(
		  'wp_burst_statistics',
		  { where: `time >= ${ feb2022Epoch } AND time < ${ march2022Epoch }` }
		);
		console.log( `[Archive] DB rows: ${ feb2022DBRows.length }` );

		await executeBurstDailyCron();

		await page.reload( { waitUntil: 'domcontentloaded' } );
		await page.waitForTimeout( 2000 );
		await page.screenshot( { path: `screenshots/archive-22-02-${ Date.now() }.png`, fullPage: true } );

		await expect( page.locator( '#row-22-02\\.zip' ) ).toBeVisible();

		const thirdZipPath = `${ fullArchiveUploadsPath }/22-02.zip`;
		expect( await fileExists( thirdZipPath ) ).toBe( true );

		await wpCli( `burst unzip --zip_path='${ thirdZipPath }' --extract_to='${ fullArchiveUploadsPath }'` );

		const csvPath2202 = `${ fullArchiveUploadsPath }/22-02.csv`;
		expect( await fileExists( csvPath2202 ) ).toBe( true );

		const csvContent2202 = await wpCli( `eval "echo file_get_contents('${ csvPath2202 }');"` );
		const csvRows2202 = parseCsv( csvContent2202 );
		const headers2202 = csvRows2202[ 0 ];

		const csvObjects2202 = csvRows2202.slice( 1 ).map( row => {
			const obj = {};
			headers2202.forEach( ( key, i ) => obj[ key ] = row[ i ] ?? null );
			return obj;
		} );
		console.log( `[Archive] CSV rows: ${ csvObjects2202.length }` );

		compareDbAndCsv( feb2022DBRows, csvObjects2202, 'ID' );
		console.log( '[Archive] ✓ Data verified' );
		const hasErrors = await debugHasError();
		expect(hasErrors).toBe(false);
		console.log( '\n[Test] ✓ PASSED\n' );
	} );

	test( 'Verify archive restoration', async ( { page } ) => {
		test.setTimeout( 420000 );
		console.log( `\n===== 🧪 [Test] Archive Restoration =====` );

		await activateLicense( page );
		await setPermalinkStructure( 'pretty', page );
		await login( page );

		await page.goto( '/wp-admin/admin.php?page=burst#/settings/data', {
			waitUntil: 'domcontentloaded',
		} );
		await page.waitForTimeout( 2000 );
		await page.screenshot( { path: `screenshots/restoration-page-${ Date.now() }.png`, fullPage: true } );

		const uploadsPath = await wpCli( `eval "echo wp_upload_dir()['basedir'];"` );
		const archiveDirectory = await wpCli( `option get burst_archive_dir` );
		const fullArchiveUploadsPath = path.join( uploadsPath.trim(), 'burst', archiveDirectory.trim() );
		console.log( '[Setup] Archive path:', fullArchiveUploadsPath );

		/**
		 * Helper function to restore one archive
		 */
		const restoreArchive = async ( monthKey, csvPath, startEpoch, endEpoch ) => {
			console.log( `\n--- Restoring: ${ monthKey } ---` );

			expect( await fileExists( csvPath ) ).toBe( true );

			const csvContent = await wpCli( `eval "echo file_get_contents('${ csvPath }');"` );
			const csvRows = parseCsv( csvContent );
			const headers = csvRows[ 0 ];

			const csvObjects = csvRows.slice( 1 ).map( row => {
				const obj = {};
				headers.forEach( ( key, i ) => obj[ key ] = row[ i ] ?? null );
				return obj;
			} );
			console.log( `[Restore] CSV rows: ${ csvObjects.length }` );

			await page.screenshot( { path: `screenshots/before-restore-${ monthKey }-${ Date.now() }.png`, fullPage: true } );

			const checkboxSelector = `#cell-1-${ monthKey }\\.zip input[type="checkbox"]`;
			await page.waitForSelector( checkboxSelector, { state: 'visible', timeout: 10000 } );
			await page.click( checkboxSelector );
			console.log( '[Restore] Checkbox clicked' );

			await page.screenshot( { path: `screenshots/checkbox-${ monthKey }-${ Date.now() }.png`, fullPage: true } );
			await page.waitForTimeout( 500 );

			const restoreButtonSelector = 'button.burst-button.burst-button--primary';
			await page.waitForSelector( restoreButtonSelector, { state: 'visible', timeout: 10000 } );
			await page.click( restoreButtonSelector );
			console.log( '[Restore] Button clicked' );

			await page.screenshot( { path: `screenshots/restore-clicked-${ monthKey }-${ Date.now() }.png`, fullPage: true } );

			const loader = page.locator( '.restore-processing' );
			try {
				await expect( loader ).toBeVisible( { timeout: 60000 } );
				console.log( '[Restore] Processing started' );
				await page.screenshot( { path: `screenshots/loader-${ monthKey }-${ Date.now() }.png`, fullPage: true } );
			} catch ( error ) {
				console.error( '[Restore] ERROR: Loader did not appear' );
				await page.screenshot( { path: `screenshots/error-loader-${ monthKey }-${ Date.now() }.png`, fullPage: true } );
				throw error;
			}

			console.log( '[Restore] Waiting for completion...' );
			try {
				await expect( loader ).not.toBeVisible( { timeout: 180000 } );
				console.log( '[Restore] Processing completed' );
				await page.screenshot( { path: `screenshots/complete-${ monthKey }-${ Date.now() }.png`, fullPage: true } );
			} catch ( error ) {
				console.error( '[Restore] ERROR: Timeout' );
				await page.screenshot( { path: `screenshots/timeout-${ monthKey }-${ Date.now() }.png`, fullPage: true } );
				throw error;
			}

			await page.waitForTimeout( 2000 );

			const dbRows = await getTableData(
			  'wp_burst_statistics',
			  { where: `time >= ${ startEpoch } AND time < ${ endEpoch }` }
			);
			console.log( `[Restore] DB rows after restore: ${ dbRows.length }` );

			expect( csvObjects.length ).toBe( dbRows.length );
			compareDbAndCsv( dbRows, csvObjects, 'ID' );
			console.log( `[Restore] ✓ ${ monthKey } verified` );
			const hasErrors = await debugHasError();
			expect(hasErrors).toBe(false);
		};

		const feb2022Epoch = Math.floor( new Date( '2022-02-01T00:00:00Z' ).getTime() / 1000 );
		const march2022Epoch = Math.floor( new Date( '2022-03-01T00:00:00Z' ).getTime() / 1000 );
		const jan2022Epoch = Math.floor( new Date( '2022-01-01T00:00:00Z' ).getTime() / 1000 );
		const dec2021Epoch = Math.floor( new Date( '2021-12-01T00:00:00Z' ).getTime() / 1000 );

		// Restore 22-02
		await restoreArchive(
		  '22-02',
		  `${ fullArchiveUploadsPath }/22-02.csv`,
		  feb2022Epoch,
		  march2022Epoch
		);

		await page.reload( { waitUntil: 'domcontentloaded' } );
		await page.waitForTimeout( 2000 );
		await page.screenshot( { path: `screenshots/after-22-02-${ Date.now() }.png`, fullPage: true } );

		// Restore 22-01
		await restoreArchive(
		  '22-01',
		  `${ fullArchiveUploadsPath }/22-01.csv`,
		  jan2022Epoch,
		  feb2022Epoch
		);

		await page.reload( { waitUntil: 'domcontentloaded' } );
		await page.waitForTimeout( 2000 );
		await page.screenshot( { path: `screenshots/after-22-01-${ Date.now() }.png`, fullPage: true } );

		// Restore 21-12
		await restoreArchive(
		  '21-12',
		  `${ fullArchiveUploadsPath }/21-12.csv`,
		  dec2021Epoch,
		  jan2022Epoch
		);

		await page.reload( { waitUntil: 'domcontentloaded' } );
		await page.waitForTimeout( 2000 );
		await page.screenshot( { path: `screenshots/after-21-12-${ Date.now() }.png`, fullPage: true } );

		console.log( '\n[Test] ✓ PASSED\n' );
	} );
	test( 'Verify data deletion', async ( { page } ) => {
		test.setTimeout( 420000 );

		await activateLicense( page );
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

/**
 * Compare DB rows with CSV rows, normalizing and sorting.
 */
function compareDbAndCsv( dbRows, csvRows, key = 'ID' ) {
	const normalize = ( obj ) => {
		const o = {};
		for ( const k in obj ) {
			if ( obj[ k ] === 'NULL' ) {
				o[ k ] = '';
			} else {
				o[ k ] = obj[ k ] !== null ? String( obj[ k ] ).trim() : null;
			}
		}
		return o;
	};

	const dbNormalized = dbRows.map( normalize );
	const csvNormalized = csvRows.map( normalize );

	dbNormalized.sort( ( a, b ) => String( a[ key ] ).localeCompare( String( b[ key ] ) ) );
	csvNormalized.sort( ( a, b ) => String( a[ key ] ).localeCompare( String( b[ key ] ) ) );

	const report = {
		countMismatch: dbNormalized.length !== csvNormalized.length,
		dbCount: dbNormalized.length,
		csvCount: csvNormalized.length,
		missingInCsv: [],
		extraInCsv: [],
		rowMismatches: []
	};

	const dbMap = new Map( dbNormalized.map( r => [ String( r[ key ] ), r ] ) );
	const csvMap = new Map( csvNormalized.map( r => [ String( r[ key ] ), r ] ) );

	const allIds = new Set( [ ...dbMap.keys(), ...csvMap.keys() ] );

	for ( const id of allIds ) {
		const dbRow = dbMap.get( id );
		const csvRow = csvMap.get( id );

		if ( dbRow && ! csvRow ) {
			report.missingInCsv.push( { id, row: dbRow } );
			continue;
		}
		if ( csvRow && ! dbRow ) {
			report.extraInCsv.push( { id, row: csvRow } );
			continue;
		}

		const diff = {};
		const keys = new Set( [ ...Object.keys( dbRow ), ...Object.keys( csvRow ) ] );

		for ( const k of keys ) {
			if ( dbRow[ k ] !== csvRow[ k ] ) {
				diff[ k ] = { db: dbRow[ k ], csv: csvRow[ k ] };
			}
		}

		if ( Object.keys( diff ).length > 0 ) {
			report.rowMismatches.push( {
				id,
				differences: diff,
				dbRow,
				csvRow
			} );
		}
	}

	const hasErrors =
	  report.countMismatch ||
	  report.missingInCsv.length > 0 ||
	  report.extraInCsv.length > 0 ||
	  report.rowMismatches.length > 0;

	if ( hasErrors ) {
		console.error( '\n=== FULL INTEGRITY REPORT ===' );
		console.error( JSON.stringify( report, null, 2 ) );

		throw new Error(
			`Integrity check failed: DB=${report.dbCount}, CSV=${report.csvCount}, MissingInCsv=${report.missingInCsv.length}, ExtraInCsv=${report.extraInCsv.length}, MismatchedRows=${report.rowMismatches.length}. See printed report.`
		);
	}

	console.log( '✔ DB and CSV match perfectly.' );
}

