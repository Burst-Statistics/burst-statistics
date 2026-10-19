import { __ } from '@wordpress/i18n';
import { GreenHostingCheck, PRIVACY_STATEMENT_URL } from './GreenHostingMeta';

type GreenHostingActionsProps = {

	/** Whether a current check result exists. */
	hasResult: boolean;

	/** Whether a green hosting check is in flight. */
	isChecking: boolean;

	/** Starts a green hosting check. */
	onCheck: () => void;
};

/**
 * The manager-only check button, with the privacy note before the first check.
 *
 * @param {GreenHostingActionsProps} props - Component props.
 * @return {JSX.Element} The check action.
 */
const GreenHostingActions = ({ hasResult, isChecking, onCheck }: GreenHostingActionsProps ) => (
	<>
		<div className="mt-2">
			<GreenHostingCheck
				hasResult={hasResult}
				isChecking={isChecking}
				onCheck={onCheck}
			/>
		</div>

		{ /* Shown only until a check has run: that is when the reader is
			deciding whether to send anything, and the only moment the
			disclosure can change a decision. */ }
		{ ! hasResult && (
			<p className="mt-2 text-xs leading-relaxed text-text-gray">
				{ __( 'Checking sends only this site\'s domain to The Green Web Foundation.', 'burst-statistics' ) }
				{ ' ' }
				<a
					href={PRIVACY_STATEMENT_URL}
					target="_blank"
					rel="noopener noreferrer"
					className="underline hover:no-underline"
				>
					{ __( 'Privacy statement', 'burst-statistics' ) }
				</a>
			</p>
		) }
	</>
);

export default GreenHostingActions;
