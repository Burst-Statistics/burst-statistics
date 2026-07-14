import Icon from '@/utils/Icon';

/**
 * RadioFieldOptionDetails component.
 *
 * Renders the icon, label, and optional returning/description text for a
 * single RadioField option.
 *
 * @param {Object}      props
 * @param {string}      props.label       - Option label.
 * @param {?string}     props.icon        - Optional icon name shown before the label.
 * @param {?string}     props.returning   - Optional "returning" descriptor text.
 * @param {?string}     props.description - Optional description text.
 * @return {JSX.Element}
 */
const RadioFieldOptionDetails = ({ label, icon, returning, description }) => {
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2">
				{icon && (
					<Icon name={icon} size={16} className="text-text-gray" />
				)}
				<span className="font-semibold text-text-black text-md">
					{label}
				</span>
			</div>
			{returning && (
				<div className="flex items-center gap-1.5 mt-1">
					<Icon name="repeat" size={14} className="text-text-gray shrink-0" />
					<span className="text-base font-medium text-text-gray">
						{returning}
					</span>
				</div>
			)}
			{description && (
				<span className="text-sm text-text-gray mt-1">
					{description}
				</span>
			)}
		</div>
	);
};

RadioFieldOptionDetails.displayName = 'RadioFieldOptionDetails';

export default RadioFieldOptionDetails;
