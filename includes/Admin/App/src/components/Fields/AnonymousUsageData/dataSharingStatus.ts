import { __, sprintf } from '@wordpress/i18n';
import { formatDate } from '@/utils/formatting';

/**
 * Sync state of the data sharing, from Data_Sharing::get_sync_status().
 * Timestamps are in seconds, 0 when unknown.
 */
export interface DataSharingSyncStatus {
	last_send: number;
	next_send: number;
	is_staging: boolean;
}

/**
 * Format a Unix timestamp in seconds as a date.
 *
 * @param timestamp Timestamp in seconds.
 * @return The localized date.
 */
function formatSyncDate( timestamp: number ): string {
	return formatDate( new Date( timestamp * 1000 ) );
}

/**
 * Get the status line below the data sharing toggle.
 *
 * @param isEnabled  Whether the toggle is on in the form.
 * @param isSaved    Whether the saved setting is on, so the sync status applies.
 * @param syncStatus The sync status from the server, if available.
 * @return The status text.
 */
// fallow-ignore-next-line complexity
export function getDataSharingStatus(
	isEnabled: boolean,
	isSaved: boolean,
	syncStatus: DataSharingSyncStatus | null | undefined
): string {
	if ( ! isEnabled ) {
		return __( 'Off', 'burst-statistics' );
	}

	if ( syncStatus?.is_staging ) {
		return __( 'On. Staging and local sites don’t share data, so there is no comparison here.', 'burst-statistics' );
	}

	if ( ! isSaved || ! syncStatus ) {
		return __( 'On. After you save, the first comparison arrives after a month of tracking.', 'burst-statistics' );
	}

	const lastSend = Number( syncStatus.last_send );
	const nextSend = Number( syncStatus.next_send );

	if ( 0 < lastSend && 0 < nextSend ) {
		return sprintf(

			/* translators: 1: date of the last sync, 2: date of the next sync. */
			__( 'On. Last synced on %1$s, next sync around %2$s.', 'burst-statistics' ),
			formatSyncDate( lastSend ),
			formatSyncDate( nextSend )
		);
	}

	if ( 0 < lastSend ) {
		return sprintf(

			/* translators: %s: date of the last sync. */
			__( 'On. Last synced on %s.', 'burst-statistics' ),
			formatSyncDate( lastSend )
		);
	}

	if ( 0 < nextSend ) {
		return sprintf(

			/* translators: %s: date of the first sync. */
			__( 'On. The first sync is planned for %s.', 'burst-statistics' ),
			formatSyncDate( nextSend )
		);
	}

	return __( 'On. The first comparison arrives after a month of tracking.', 'burst-statistics' );
}
