import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { burst_get_website_url } from '@/utils/lib';

/**
 * Upgrade notice shown when a free site reached its active goal limit.
 *
 * @return {JSX.Element} The notice.
 */
const GoalLimitNotice = (): JSX.Element => {
	return (
		<div className="flex flex-col sm:flex-row gap-4 p-4 bg-brand-lightest dark:bg-green-dark rounded-md justify-between items-start sm:items-center border border-brand-light dark:border-green-dark">
			<div className="flex gap-4 items-center">
				<Icon name={'goals'} size={24} color="green" />
				<div className="text-left">
					<h4 className="text-base font-semibold m-0 leading-tight">
						{__( 'Want more active goals?', 'burst-statistics' )}
					</h4>
					<p className="text-sm text-text-gray mt-1 mb-0 leading-normal">
						{__( 'Upgrade to Pro to activate unlimited goals', 'burst-statistics' )}
					</p>
				</div>
			</div>
			<a
				href={burst_get_website_url( '/pricing/', {
					utm_source: 'goals-setting',
					utm_content: 'more-goals'
				})}
				target={'_blank'}
				rel="noopener noreferrer"
				className="w-full sm:w-auto text-center burst-button burst-button--pro shrink-0"
			>
				{__( 'Upgrade to Pro', 'burst-statistics' )}
			</a>
		</div>
	);
};

export default GoalLimitNotice;
