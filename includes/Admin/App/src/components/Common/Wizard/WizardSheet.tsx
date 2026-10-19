import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SHEET_OVERLAY_PROPS, SHEET_PANEL_PROPS } from '@/components/Common/sheetMotionProps';

interface WizardSheetProps {

	// DOM id of the overlay, e.g. 'goal-wizard-modal'.
	id: string;
	children: ReactNode;
}

/**
 * Full-screen bottom sheet a wizard is laid out in: header, body and controls stack inside it.
 *
 * @param {WizardSheetProps} props          Component props.
 * @param {string}           props.id       DOM id of the overlay.
 * @param {ReactNode}        props.children The wizard's header, body and controls.
 * @return {JSX.Element} The sheet.
 */
const WizardSheet = ({ id, children }: WizardSheetProps ): JSX.Element => (
	<motion.div {...SHEET_OVERLAY_PROPS} id={id}>
		<motion.div {...SHEET_PANEL_PROPS}>
			<div className="h-full bg-gray-100 rounded-t-2xl shadow-2xl overflow-hidden flex flex-col">
				{children}
			</div>
		</motion.div>
	</motion.div>
);

export default WizardSheet;
