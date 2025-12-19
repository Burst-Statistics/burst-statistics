import { create } from 'zustand';
import { doAction } from '../utils/api';
import { toast } from 'react-toastify';
import { __ } from '@wordpress/i18n';
const useArchiveStore = create( ( set, get ) => ({
	fetching: false,
	restoring: false,
	progress: false,
	archives: [],
	downloadUrl: '',
	fields: [],
	noData: false,
	deleteArchives: async( ids ) => {

		// get array of archives to delete
		const deleteArchives = get().archives.filter( ( record ) =>
			ids.includes( record.id )
		);

		//remove the ids from the archives array
		set( ( state ) => ({
			archives: state.archives.filter(
				( record ) => ! ids.includes( record.id )
			)
		}) );
		const data = {};
		data.archives = deleteArchives;
		await toast.promise( doAction( 'delete_archives', data ), {
			pending: __( 'Deleting…', 'burst-statistics' ),
			success: __( 'Archives deleted successfully!', 'burst-statistics' ),
			error: __( 'Failed to delete archive', 'burst-statistics' )
		});
	},
	fetchData: async( isPro ) => {
		if ( ! isPro ) {
			return;
		}

		if ( get().fetching ) {
			return;
		}

		set({ fetching: true });

		const data = {};

		const { archives, downloadUrl } = await doAction( 'get_archives', data )
			.then( ( response ) => {
				return response;
			})
			.catch( ( error ) => {
				console.error( error );
			});

		set( () => ({
			archives,
			downloadUrl,
			fetching: false,
			restoring: archives.some( ( archive ) => true === archive.restoring )
		}) );
	},
	startRestoreArchives: async( selectedArchives ) => {
		set({
			restoring: true,
			progress: 0
		});

		// set 'selectedArchives' to 'restoring' status.
		set( ( state ) => ({
			archives: state.archives.map( ( archive ) => {
				if ( selectedArchives.includes( archive.id ) ) {
					archive.restoring = true;
				}
				return archive;
			})
		}) );

		await toast.promise(
			doAction( 'start_restore_archives', { archives: selectedArchives }),
			{
				pending: __( 'Starting restore…', 'burst-statistics' ),
				success: __(
					'Restore successfully started!',
					'burst-statistics'
				),
				error: __(
					'Failed to start restore process.',
					'burst-statistics'
				)
			}
		);
	},
	fetchRestoreArchivesProgress: async() => {
		set({ restoring: true });
		const { progress, noData } = await doAction( 'get_restore_progress', {})
			.then( ( response ) => {
				return response;
			})
			.catch( ( error ) => {
				console.error( error );
			});

		let restoring = false;

		if ( 100 > progress ) {
			restoring = true;
		}

		set({ progress, restoring, noData });

		if ( 100 === progress ) {

			// exclude all archives where restoring = true.
			const archives = get().archives.filter( ( archive ) => {
				return ! archive.restoring;
			});
			set({ archives });
		}

		return { progress, noData, restoring };
	}
}) );

export default useArchiveStore;
