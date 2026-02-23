import { useWizardStore } from '@/store/reports/useWizardStore';
import { LivePreviewClassic } from '@/components/Reporting/ReportWizard/Preview/LivePreviewClassic';
import { LivePreviewBlocks } from '@/components/Reporting/ReportWizard/Preview/LivePreviewBlocks';
import { __ } from '@wordpress/i18n';

export const LivePreview = () => {
	const format = useWizardStore( ( state ) => state.wizard.format );
	const isEditingMode = useWizardStore( ( state ) => state.isEditingMode );
	return (
		<div className="relative max-xl:hidden flex flex-col items-stretch justify-stretch bg-wp-gray rounded-t-2xl flex-auto border border-b-0 border-gray-500 mr-8 overflow-hidden group/root shadow-layered-low-b">
			{/*Setting z-index to 100 here breaks datepicker layout.*/}
			<div className="py-4 px-6 z-[1] w-full flex items-center justify-between shadow-layered-low-b bg-gray-50">
				<p className='text-gray-600 text-sm font-semibold uppercase tracking-[0.05em]'>
					{isEditingMode ? __( 'Editor', 'burst-statistics' ) : __( 'Live preview', 'burst-statistics' )}
				</p>
			</div>

			{'classic' === format ? <LivePreviewClassic className='relative flex-1 min-h-0 py-4 px-6 h-full overflow-y-auto burst-scroll' /> : <LivePreviewBlocks className='relative flex-1 min-h-0 h-full' />}

		</div>
	);

};
