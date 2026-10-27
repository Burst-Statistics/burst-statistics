import { getDataSharingStatus, type DataSharingSyncStatus } from './dataSharingStatus';

interface DataSharingStatusTextProps {
	isEnabled: boolean;

	/** The field config: the saved value and the sync status from Data_Sharing::get_sync_status(). */
	setting?: { value?: unknown; sync_status?: DataSharingSyncStatus | null };
}

/**
 * The status line below the data sharing toggle: off, or when data was last synced and is synced next.
 *
 * @param props           Component props.
 * @param props.isEnabled Whether the toggle is on in the form.
 * @param props.setting   The field config.
 * @return The status text.
 */
const DataSharingStatusText = ({ isEnabled, setting }: DataSharingStatusTextProps ) => (
	<span className={ `text-sm ${ isEnabled ? 'text-primary' : 'text-text-gray' }` } data-testid="data-sharing-status">
		{ getDataSharingStatus( isEnabled, Boolean( setting?.value ), setting?.sync_status ) }
	</span>
);

export default DataSharingStatusText;
