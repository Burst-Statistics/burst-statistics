import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import Modal from '@/components/Common/Modal';
import { TOUR_SECTIONS, getSectionById } from './tourSections';

interface ResumeTourModalProps {
	isOpen: boolean;
	lastSectionId: string;
	onSelectResume: ( sectionId: string ) => void;
	onSelectRestart: () => void;
	onClose: () => void;
}

const ResumeTourModal: React.FC<ResumeTourModalProps> = ({
	isOpen,
	lastSectionId,
	onSelectResume,
	onSelectRestart,
	onClose
}) => {
	const section = getSectionById( lastSectionId ) || TOUR_SECTIONS[0];
	const sectionIndex = TOUR_SECTIONS.findIndex( ( s ) => s.id === section.id );
	const sectionNumber = -1 !== sectionIndex ? sectionIndex + 1 : 1;

	const customHeader = (
		<div className="flex items-center gap-3">
			<div className="flex h-11 w-11 items-center justify-center rounded-xl text-xl shadow-sm bg-primary/10 text-primary">
				{ section.icon || '🚀' }
			</div>
			<div>
				<h3 className="text-lg font-bold leading-snug text-slate-900 dark:text-slate-100">
					{ __( 'Welcome back to the tour!', 'burst-statistics' ) }
				</h3>
				<span className="text-xs font-semibold text-primary">
					{ sprintf(

						/* translators: 1: current section number, 2: total sections */
						__( 'Section %1$d of %2$d', 'burst-statistics' ),
						sectionNumber,
						TOUR_SECTIONS.length
					) }
				</span>
			</div>
		</div>
	);

	const content = (
		<div className="flex flex-col gap-4">
			<p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
				{ __( 'You have previous tour progress. Would you like to resume from where you left off or start fresh from the beginning?', 'burst-statistics' ) }
			</p>

			<div className="flex items-start gap-3 rounded-xl p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
				<span className="text-xl mt-0.5">{ section.icon }</span>
				<div className="flex-1 min-w-0">
					<div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
						{ __( 'Resume target', 'burst-statistics' ) }
					</div>
					<div className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">
						{ section.title }
					</div>
					<div className="text-xs truncate text-slate-600 dark:text-slate-400">
						{ section.description }
					</div>
				</div>
			</div>
		</div>
	);

	const footer = (
		<div className="flex flex-col gap-2.5 w-full">
			<button
				type="button"
				onClick={ () => onSelectResume( section.id ) }
				className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-md cursor-pointer"
			>
				<span>{ sprintf(

					/* translators: %s: section title */
					__( 'Resume %s →', 'burst-statistics' ),
					section.title
				) }</span>
			</button>

			<button
				type="button"
				onClick={ onSelectRestart }
				className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-semibold transition-all cursor-pointer border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
			>
				<span>{ __( 'Start over from beginning', 'burst-statistics' ) }</span>
			</button>
		</div>
	);

	return (
		<Modal
			isOpen={ isOpen }
			onClose={ onClose }
			customHeader={ customHeader }
			content={ content }
			footer={ footer }
		/>
	);
};

export default ResumeTourModal;
