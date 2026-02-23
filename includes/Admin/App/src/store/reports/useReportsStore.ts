import { create } from 'zustand';
import type { Report } from './types';
import { useWizardStore } from './useWizardStore';
import { doAction } from '@/utils/api';
import { __ } from '@wordpress/i18n';
import {toast} from 'react-toastify';
const DEFAULT_PERMISSIONS = {
	can_change_date: false,
	can_filter: false
};
interface ReportsStore {
	expiration: string,
	permissions: Record<string, boolean>,
	reports: Report[];
	setReports: ( reports: Report[]) => void;
	isGenerating: boolean;
	setIsGenerating: ( isGenerating: boolean ) => void;

	saveReportFromWizard: () => Promise<Report | false>;
	loadReportIntoWizard: ( id: number, openWizard: boolean ) => boolean;

	createReport: ( data: Partial<Report> ) => Promise<Report | false>;
	generateStoryUrl: ( reportId:number ) => Promise<string>;

	updateReport: ( id: number, data: Partial<Report> ) => Promise<Report | false>;
	deleteReport: ( id: number ) => Promise<boolean>;

	duplicateReport: ( id: number ) => Promise<Report | false>;
	duplicateAndLoadReportIntoWizard: ( id: number ) => Promise<Report | false>;

	toggleReportActive: ( id: number ) => Promise<void>;
	openPreview: ( reportId: number, startPdfDownload:boolean ) => Promise<void>;

	sendTestEmail: ( id: number ) => Promise<boolean>;
	sendEmailNow: ( id: number ) => Promise<boolean>;
}

export const useReportsStore = create<ReportsStore>( ( set, get ) => ({
	reports: [],
	expiration: '7d',
	permissions: DEFAULT_PERMISSIONS,
	isGenerating: false,
	setIsGenerating: ( isGenerating ) => set({isGenerating}),
	setReports: ( reports ) => set({ reports }),
	openPreview: async( reportId, startPdfDownload ) => {

		// Open a blank window first, so safari doesn't block opening it.
		const newWindow = window.open( 'about:blank', '_blank' );
		let reportUrl = await get().generateStoryUrl( reportId );
		if ( ! reportUrl ) {
			newWindow?.close();
			console.error( 'Failed to create story URL' );
			toast.error( 'Failed to create story URL' );
			return;
		}

		const autoprintParam = startPdfDownload ? '&autoprint=1' : '';
		reportUrl = reportUrl.replace(
			/\?burst_share_token=/,
			`?pdf=1${autoprintParam}&burst_share_token=`
		);

		if ( newWindow ) {
			newWindow.location.href = reportUrl;
		}
	},
	generateStoryUrl: async( reportId ) => {
		get().setIsGenerating( true );
		let shareUrl = '';
		try {

			// Capture the full current URL including hash fragment.
			// This preserves the route and all query parameters in the hash.
			// Example: http://localhost:8888/wp-admin/admin.php?page=burst#/statistics?range=custom&startDate=2025-11-10
			const fullUrl = window.location.href;

			// Convert admin URL to burst-dashboard format while preserving hash.
			// Replace wp-admin/admin.php?page=burst with burst-dashboard.
			// The hash fragment (#...) is automatically preserved.
			const viewUrl = fullUrl.replace( /wp-admin\/admin\.php\?page=burst.*/, 'burst-dashboard#/story' );

			//check if the report is loaded in the wizard.
			//if it is loaded in the wizard, ensure report is saved.
			// If not, this link is clicked from the reports overview, and we need to make sure the data is loaded.
			const w = useWizardStore.getState().wizard;
			if ( w.id === reportId ) {
				await get().saveReportFromWizard();
			} else {
				get().loadReportIntoWizard( reportId, false );
			}

			const permissions = get().permissions;
			const expiration = get().expiration;

			// Generate or update share token for this report.
			const response = await doAction( 'get_share_token', {
				expiration,
				view_url: viewUrl,
				permissions,
				shared_tabs: '',
				report_id: reportId,
				initial_state: {} // Build filters and date range for a story url are stored in the report, so we don't need to include them in the url.
			});

			if ( ! response.share_token || ! response.share_url ) {
				toast.error(
					__( 'Failed to generate share link', 'burst-statistics' )
				);
				return '';
			}
			shareUrl = response.share_url;
		} catch ( error ) {
			console.error( 'Failed to generate share link:', error );
			toast.error( __( 'Failed to generate share link', 'burst-statistics' ) );
		} finally {
			get().setIsGenerating( false );
		}

		return shareUrl;
	},
	saveReportFromWizard: async() => {
		const w = useWizardStore.getState().wizard;

		if ( w.id ) {
			const oldData = get().reports.find( ( r ) => r.id === w.id );

			if ( ! oldData ) {
				return false;
			}

			const changes: Partial<Report> = {};

			if ( oldData.name !== w.name ) {
				changes.name = w.name;
			}

			if ( oldData.format !== w.format ) {
				changes.format = w.format;
			}

			if ( oldData.scheduled !== w.scheduled ) {
				changes.scheduled = w.scheduled;
			}

			if ( oldData.frequency !== w.frequency ) {
				changes.frequency = w.frequency;
			}

			if ( oldData.dayOfWeek !== w.dayOfWeek ) {
				changes.dayOfWeek = w.dayOfWeek;
			}

			if ( oldData.weekOfMonth !== w.weekOfMonth ) {
				changes.weekOfMonth = w.weekOfMonth;
			}

			if ( oldData.sendTime !== w.sendTime ) {
				changes.sendTime = w.sendTime;
			}

			if ( oldData.fixedEndDate !== w.fixedEndDate ) {
				changes.fixedEndDate = w.fixedEndDate;
			}

			if ( oldData.reportDateRange !== w.reportDateRange ) {
				changes.reportDateRange = w.reportDateRange;
			}

			if (
				oldData.content.length !== w.content.length ||
				! oldData.content.every( ( v, i ) => v === w.content[ i ])
			) {
				changes.content = [ ...w.content ];
			}

			if (
				oldData.recipients.length !== w.recipients.length ||
				! oldData.recipients.every( ( v, i ) => v === w.recipients[ i ])
			) {
				changes.recipients = [ ...w.recipients ];
			}

			if ( 0 === Object.keys( changes ).length ) {
				return oldData;
			}

			return await get().updateReport( w.id, changes );
		}

		return await get().createReport({
			name: w.name,
			format: w.format,
			enabled: false,
			content: [ ...w.content ],
			recipients: [ ...w.recipients ],
			scheduled: w.scheduled,
			frequency: w.frequency,
			dayOfWeek: w.dayOfWeek,
			weekOfMonth: w.weekOfMonth,
			sendTime: w.sendTime,
			fixedEndDate: w.fixedEndDate,
			reportDateRange: w.reportDateRange
		});
	},

	loadReportIntoWizard: ( id, openWizard ) => {
		const currentStep = useWizardStore.getState().wizard.currentStep;
		const report = get().reports.find( ( r ) => r.id === id );
		if ( ! report ) {
			return false;
		}
		useWizardStore.setState({
			wizard: {
				id: report.id,
				currentStep: currentStep,
				name: report.name,
				reportDateRange: report.reportDateRange,
				format: report.format,
				content: report.content,
				recipients: [ ...report.recipients ],
				scheduled: report.scheduled,
				frequency: report.frequency,
				dayOfWeek: report.dayOfWeek,
				weekOfMonth: report.weekOfMonth,
				sendTime: report.sendTime,
				fixedEndDate: report.fixedEndDate || ''
			},
			isOpen: openWizard
		});

		return true;
	},

	updateReport: async( id, data ) => {
		data.id = id;
		const response = await doAction( 'report/update', data );

		if ( ! response.success || ! response.report ) {
			return false;
		}

		set( ( state ) => ({
			reports: state.reports.map( ( r ) =>
				r.id === id ? { ...response.report } : r
			)
		}) );

		return response.report;
	},

	deleteReport: async( id ) => {
		const response = await doAction( 'report/delete', { id });

		if ( ! response.success ) {
			return false;
		}

		set( ( state ) => ({
			reports: state.reports.filter( ( r ) => r.id !== id )
		}) );

		return true;
	},

	duplicateReport: async( id ) => {
		const reportToDuplicate = get().reports.find( ( r ) => r.id === id );

		if ( ! reportToDuplicate ) {
			return false;
		}

		// Generate duplicate name with incremental numbering (Copy, Copy 2, Copy 3, etc.).
		const copyText = __( 'Copy', 'burst-statistics' );
		const copySuffix = `(${copyText})`;

		// Check if the name already ends with (Copy).
		const newName = reportToDuplicate.name.trimEnd().endsWith( copySuffix ) ?
			reportToDuplicate.name :
			`${ reportToDuplicate.name } ${copySuffix}`;

		return await get().createReport({
			...reportToDuplicate,
			id: undefined,
			name: newName
		});
	},


	duplicateAndLoadReportIntoWizard: async( id ) => {
		const newReport = await get().duplicateReport( id );

		if ( ! newReport ) {
			return false;
		}

		if ( ! get().loadReportIntoWizard( newReport.id, true ) ) {
			return false;
		}
		useWizardStore.getState().setCurrentStep( 4 );

		return newReport;
	},

	toggleReportActive: async( id ) => {
		const currentReport = get().reports.find( ( r ) => r.id === id );

		if ( ! currentReport ) {
			return;
		}

		const updatedData: Partial< Report > = {
			enabled: ! currentReport.enabled
		};

		await get().updateReport( id, updatedData );
	},

	createReport: async( data ) => {
		const response = await doAction( 'report/create', data );
		if ( ! response?.success || ! response?.report ) {
			return false;
		}
		const reportId = response.report.id;
		set( ( state ) => ({
			reports: [ response.report, ...state.reports ]
		}) );
		get().loadReportIntoWizard( reportId, true );

		return response.report as Report;
	},

	sendTestEmail: async( id ) => {
		const response = await doAction( 'report/send-test-report', { id });
		return response.success;
	},

	sendEmailNow: async( id ) => {
		const response = await doAction( 'report/send-report-now', { id });
		return response.success;
	}
}) );
