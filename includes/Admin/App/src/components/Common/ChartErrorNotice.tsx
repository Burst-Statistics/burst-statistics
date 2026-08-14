/**
 * Inline error notice shown in a chart block when its query failed.
 *
 * @param props - Localized error message.
 * @return The notice element.
 */
export function ChartErrorNotice({ message }: { message: string }): JSX.Element {
	return <p className="px-6 py-4 text-sm text-red-600">{ message }</p>;
}
