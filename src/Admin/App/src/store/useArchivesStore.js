import {create} from 'zustand';
import {doAction} from '../utils/api';
import {toast} from 'react-toastify';
import {__} from '@wordpress/i18n';
const useArchiveStore = create( ( set, get ) => ({
    archivesLoaded: false,
    fetching: false,
    restoring: false,
    progress: false,
    archives: [],
    downloadUrl: '',
    fields: [],
    noData: false,
    deleteArchives: async( ids ) => {

        // get array of archives to delete
        let deleteArchives = get().archives.filter( record => ids.includes( record.id ) );

        //remove the ids from the archives array
        set( ( state ) => ({
            archives: state.archives.filter( record => ! ids.includes( record.id ) )
        }) );
        let data = {};
        data.archives = deleteArchives;
        await toast.promise( doAction( 'delete_archives', data ), {
            pending: __( 'Deleting...', 'burst-statistics' ),
            success: __( 'Archives deleted successfully!', 'burst-statistics' ),
            error: __( 'Failed to delete archive', 'burst-statistics' )
        });
    },
    fetchData: async( ) => {
        if ( get().fetching ) {
return;
}
        set({fetching: true});
        let data = {};
        const { archives, downloadUrl} = await doAction( 'get_archives', data ).then( ( response ) => {
            return response;
        }).catch( ( error ) => {
            console.error( error );
        });
        set( () => ({
            archivesLoaded: true,
            archives: archives,
            downloadUrl: downloadUrl,
            fetching: false
        }) );
    },
    startRestoreArchives: async( selectedArchives ) => {
        set({
            restoring: true,
            progress: 0
        });

        //set 'selectedArchives' to 'restoring' status
        set( ( state ) => ({
            archives: state.archives.map( ( archive ) => {
                if ( selectedArchives.includes( archive.id ) ) {
                    archive.restoring = true;
                }
                return archive;
            })
        }) );

        await toast.promise( doAction( 'start_restore_archives', {archives: selectedArchives}), {
            pending: __( 'Starting restore...', 'burst-statistics' ),
            success: __( 'Restore successfully started!', 'burst-statistics' ),
            error: __( 'Failed to start restore process.', 'burst-statistics' )
        });
    },

    fetchRestoreArchivesProgress: async() => {
        set({ restoring: true });
        const {progress, noData} = await doAction( 'get_restore_progress', {}).then( ( response ) => {
            return response;
        }).catch( ( error ) => {
            console.error( error );
        });
        let restoring = false;
        if ( 100 > progress ) {
            restoring = true;
        }
        set({progress: progress, restoring: restoring, noData: noData});
        if ( 100 === progress ) {

            //exclude all archives where restoring = true
            let archives = get().archives.filter( ( archive ) => {
                return ! archive.restoring;
            });
            set({archives: archives});
        }
    }
}) );

export default useArchiveStore;
