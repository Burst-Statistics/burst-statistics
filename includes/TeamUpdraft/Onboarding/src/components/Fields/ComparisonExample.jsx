/**
 * A static example card, configured by the plugin in the field's `example` key.
 *
 * Shows a metric with its value and a short label, and the explanation that the
 * plugin shows in a tooltip, so users see what they get before they opt in.
 *
 * @param {Object} props         - Component props.
 * @param {Object} props.example - Example config: caption, metric, value, label and text.
 * @return {JSX.Element|null}
 */
const ComparisonExample = ( { example } ) => {
	if ( ! example ) {
		return null;
	}

	return (
		<div
			className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4"
			data-testid="onboarding-comparison-example"
		>
			{ example.caption && (
				<span className="text-xs font-medium uppercase tracking-wide text-text-gray">
					{ example.caption }
				</span>
			) }
			<div className="flex items-center justify-between gap-3">
				<span className="text-base font-semibold text-text-black">
					{ example.metric }
				</span>
				<span className="flex items-center gap-1.5 text-xl font-bold text-text-black">
					{ example.label && (
						<span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
							{ example.label }
						</span>
					) }
					{ example.value }
				</span>
			</div>
			{ example.text && (
				<p className="text-sm text-text-gray">{ example.text }</p>
			) }
		</div>
	);
};

export default ComparisonExample;
