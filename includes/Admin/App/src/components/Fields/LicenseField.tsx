import { forwardRef } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import { addQueryArgs } from '@wordpress/url';
import ButtonInput from '@/components/Inputs/ButtonInput';
import TextInput from '@/components/Inputs/TextInput';
import Icon from '@/utils/Icon';
import Hyperlink from '@/utils/Hyperlink';
import useLicenseData from '@/hooks/useLicenseData';
import type { LicenseUpgrade } from '@/hooks/useLicenseData';
import { clsx } from 'clsx';
import { burst_get_website_url } from '@/utils/lib';

/**
 * Props interface for the LicenseField component.
 */
interface LicenseFieldProps {

	/** Field object from react-hook-form's Controller. */
	field: {
		name: string;
		value: string;
		onChange: ( value: string ) => void;
		onBlur: () => void;
		ref: React.Ref<HTMLInputElement>;
	};

	/** Additional CSS class names. */
	className?: string;

	/** Unique identifier for the field. */
	id?: string;

	/** Additional props. */
	[key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Props interface for the LicenseActivationForm component.
 */
interface LicenseActivationFormProps {
	licenseKey: string;
	onLicenseKeyChange: ( value: string ) => void;
	onActivate: () => void;
	isLicenseMutationPending: boolean;
	fieldName: string;
	errorMessage?: string;
}

/**
 * Props interface for the LicenseStatusCard component.
 */
interface LicenseStatusCardProps {
	tier: string;
	activationLimit: number;
	activationsLeft: number;
	expiresDate: string;
	isLifetime: boolean;
	isLicenseMutationPending: boolean;
	onDeactivate: () => void;
	upgrades: LicenseUpgrade[];
	subscriptionStatus: string;
	hasSubscriptionInfo: boolean;
	isTrial: boolean;
	trialRemainingDays: number;
	licenseStatus: string;
	encryptedLicenseKey?: string;
}

/**
 * Interface for contextual action content.
 */
interface ContextualAction {
	headline: string;
	body: string;
	buttonText: string;
	buttonUrl: string;
	variant: 'default' | 'warning' | 'urgent';
	icon?: string;
}

/**
 * Constants.
 */
const TIER_DISPLAY_MAP: Record<string, string> = {
	creator: 'Creator',
	business: 'Business',
	agency: 'Agency'
};

const VARIANT_STYLES = {
	urgent: {
		container: 'bg-red-light',
		button: 'primary' as const
	},
	warning: {
		container: 'bg-yellow-50 border-t-2 border-yellow-500',
		button: 'primary' as const
	},
	default: {
		container: 'bg-gray-50 border-t border-gray-200',
		button: 'secondary' as const
	}
};

/**
 * LicenseActivationForm component displays the license key input and activation button.
 */
const LicenseActivationForm: React.FC<LicenseActivationFormProps> = ({
	licenseKey,
	onLicenseKeyChange,
	onActivate,
	isLicenseMutationPending,
	fieldName,
	errorMessage
}) => {
	return (
		<div className="w-full p-6 border-b border-gray-300">
			<h2 className="text-xl font-semibold text-black mb-4">
				{__( 'Activate Burst Pro', 'burst-statistics' )}
			</h2>

			<div className="flex flex-col gap-3">
				<TextInput
					id={fieldName}
					type="password"
					placeholder={__( 'Enter your license key here', 'burst-statistics' )}
					value={licenseKey}
					onChange={( e ) => onLicenseKeyChange( e.target.value )}
					disabled={isLicenseMutationPending}
					className="w-full"
				/>

				{/* Inline error display. */}
				{errorMessage && (
					<p className="text-sm text-red">{errorMessage}</p>
				)}

				<div className="flex items-center gap-2">
					<ButtonInput
						btnVariant="primary"
						onClick={onActivate}
						disabled={isLicenseMutationPending || ! licenseKey}
					>
						{__( 'Activate license', 'burst-statistics' )}
					</ButtonInput>
					{isLicenseMutationPending && <Icon name="loading" size={20} />}
				</div>

				<p className="text-sm text-gray">
					{__(
						'Activating your license gives you automatic updates and support.',
						'burst-statistics'
					)}{' '}
					<Hyperlink
						className="underline text-sm text-gray"
						url={burst_get_website_url( 'account', {
							utm_source: 'license-activation',
							utm_content: 'find-license-key'
						})}
						target="_blank"
						rel="noopener noreferrer"
						text={__(
							'Find your license key in %syour account%s.',
							'burst-statistics'
						)}
					/>{' '}
					<Hyperlink
						className="underline text-sm text-gray"
						url={burst_get_website_url( 'how-to-install-burst-pro', {
							utm_source: 'license-activation',
							utm_content: 'installation-guide'
						})}
						target="_blank"
						rel="noopener noreferrer"
						text={__(
							'Having trouble? %sCheck our installation guide%s.',
							'burst-statistics'
						)}
					/>{' '}
					<Hyperlink
						className="underline text-sm text-gray"
						url={burst_get_website_url( 'support', {
							utm_source: 'license-activation',
							utm_content: 'support-ticket'
						})}
						target="_blank"
						rel="noopener noreferrer"
						text={__(
							'If that does not help, please %sopen a support ticket%s so we can help you out!',
							'burst-statistics'
						)}
					/>
				</p>
			</div>
		</div>
	);
};

/**
 * LicenseStatusCard component displays the license details and status.
 */
const LicenseStatusCard: React.FC<LicenseStatusCardProps> = ({
	tier,
	activationLimit,
	activationsLeft,
	expiresDate,
	isLifetime,
	isLicenseMutationPending,
	onDeactivate,
	upgrades,
	subscriptionStatus,
	hasSubscriptionInfo,
	isTrial,
	trialRemainingDays,
	licenseStatus,
	encryptedLicenseKey
}) => {
	const isActive = 'valid' === licenseStatus;

	/**
	 * Format the tier name for display.
	 */
	const getTierDisplayName = ( tier: string ): string => {
		return TIER_DISPLAY_MAP[tier.toLowerCase()] || tier;
	};

	/**
	 * Check if an upgrade has more sites than a given limit.
	 */
	const hasMoreSites = ( upgrade: LicenseUpgrade, limit: number, orEqual = false ): boolean => {
		if ( 'unlimited' === upgrade.sites ) {
return true;
}
		return 'number' === typeof upgrade.sites && ( orEqual ? upgrade.sites >= limit : upgrade.sites > limit );
	};

	/**
	 * Find an upgrade by tier name.
	 */
	const findUpgradeByTier = ( upgrades: LicenseUpgrade[], tierName: string ): LicenseUpgrade | undefined => {
		return upgrades.find( ( upgrade ) => upgrade.tier.toLowerCase() === tierName.toLowerCase() );
	};

	/**
	 * Get the site activation display text.
	 */
	const getActivationDisplay = (): string => {
		if ( 0 === activationLimit ) {
			return __( 'Unlimited sites available', 'burst-statistics' );
		}

		let usedActivations = activationLimit - activationsLeft;
		if ( 0 > usedActivations ) {
			usedActivations = activationLimit;
		}
		return sprintf(

			/* translators: 1: number of sites used, 2: total number of sites allowed */
			__( '%1$d of %2$d sites used', 'burst-statistics' ),
			usedActivations,
			activationLimit
		);
	};

	/**
	 * Get the license status display text.
	 * This shows if the license is active on THIS website.
	 */
	const getLicenseStatusDisplay = (): string => {
		if ( 'valid' === licenseStatus ) {
			return __( 'Active on this site', 'burst-statistics' );
		}
		return __( 'Inactive on this site', 'burst-statistics' );
	};

	/**
	 * Get the subscription status display text.
	 * This shows if auto-renewal is enabled.
	 */
	const getSubscriptionStatusDisplay = (): { text: string; color: string } => {
		const isExpired = new Date( expiresDate ) < new Date();

		// Check for lifetime license first (highest priority).
		if ( isLifetime ) {
			return {
				text: __( 'Never', 'burst-statistics' ),
				color: 'text-black'
			};
		}

		// Check for trial period.
		// Only show trial if: has trial remaining days AND either no subscription info OR subscription is not active.
		// This prevents showing "Trial" for paid subscriptions that still have trial data in the system.
		const isActuallyInTrial = isTrial &&
			0 < trialRemainingDays &&
			( ! hasSubscriptionInfo || 'active' !== subscriptionStatus );

		if ( isActuallyInTrial ) {
			return {
				text: sprintf(

					/* translators: %d: number of days remaining */
					__( 'Trial - %d days remaining', 'burst-statistics' ),
					trialRemainingDays
				),
				color: 'text-green-dark'
			};
		}

		// No subscription info - show expiration.
		if ( ! hasSubscriptionInfo ) {
			return {
				text: sprintf(
					isExpired ?
						__( 'Expired on %s', 'burst-statistics' ) :
						__( 'Expires on %s', 'burst-statistics' ),
					expiresDate
				),
				color: 'text-black'
			};
		}

		// Handle subscription statuses.
		switch ( subscriptionStatus ) {
			case 'active':
				return {
					text: sprintf(

						/* translators: %s: renewal date */
						__( 'Auto-renews on %s', 'burst-statistics' ),
						expiresDate
					),
					color: 'text-black'
				};
			case 'cancelled':
				return {
					text: sprintf(
						isExpired ?
							__( 'Cancelled - Expired on %s', 'burst-statistics' ) :
							__( 'Cancelled - Expires on %s', 'burst-statistics' ),
						expiresDate
					),
					color: 'text-red font-semibold'
				};
			case 'failing':
				return {
					text: __( 'Payment failed - Axtion required', 'burst-statistics' ),
					color: 'text-red'
				};
			default:
				return {
					text: sprintf(
						isExpired ?
							__( 'Expired on %s', 'burst-statistics' ) :
							__( 'Expires on %s', 'burst-statistics' ),
						expiresDate
					),
					color: 'text-black'
				};
		}
	};

	/**
	 * Determine the contextual action to display based on user's specific context.
	 * Only show critical warnings (subscription/payment issues).
	 */
	const getContextualAction = (): ContextualAction | null => {

		// Priority 1: Subscription cancelled or payment issue.
		if (
			hasSubscriptionInfo &&
			( 'cancelled' === subscriptionStatus || 'failing' === subscriptionStatus )
		) {
			return {
				headline: __( 'Keep your Pro insights & lock in your price', 'burst-statistics' ),
				body: sprintf( __(
					'Your subscription is set to expire on %s.',
					'burst-statistics' ), expiresDate
				) + ' ' + __( 'Renew your plan now to lock in your current rate. As long as your subscription stays active, your price won\'t increase and you\'ll keep access to all Pro data and features.', 'burst-statistics' ),
				buttonText: __( 'Renew subscription', 'burst-statistics' ),
				buttonUrl: burst_get_website_url( 'checkout', {
					edd_license_key: encryptedLicenseKey,
					download_id: 889,
					utm_source: 'license-settings',
					utm_content: 'resume-subscription'
				}),
				variant: 'urgent',
				icon: 'warning-triangle'
			};
		}

		// No contextual action needed - let users choose upgrades themselves.
		return null;
	};

	const contextualAction = getContextualAction();

	/**
	 * Determine which upgrade to recommend based on user's current plan.
	 */
	const getRecommendedUpgradeUrl = (): string | null => {

		// Site limit reached - recommend any upgrade with more sites.
		if ( 0 === activationsLeft && 0 < activationLimit ) {
			const validUpgrade = upgrades.find( ( upgrade ) => hasMoreSites( upgrade, activationLimit ) );
			return validUpgrade?.url || null;
		}

		const currentTier = tier.toLowerCase();

		// Creator tier recommendations.
		if ( 'creator' === currentTier ) {

			// Creator 1 site: recommend Creator 5 sites first (more sites, same tier).
			if ( 1 === activationLimit ) {
				const creator5Upgrade = upgrades.find(
					( upgrade ) => 'creator' === upgrade.tier.toLowerCase() && 5 === upgrade.sites
				);
				if ( creator5Upgrade ) {
					return creator5Upgrade.url;
				}
			}

			// Otherwise recommend Business tier upgrade (prefer matching or more sites).
			const validUpgrades = upgrades.filter( ( upgrade ) => hasMoreSites( upgrade, activationLimit, true ) );
			const targetUpgrade = findUpgradeByTier( validUpgrades, 'business' ) || findUpgradeByTier( validUpgrades, 'agency' );
			return targetUpgrade?.url || null;
		}

		// Business tier: recommend Agency.
		if ( 'business' === currentTier ) {
			return findUpgradeByTier( upgrades, 'agency' )?.url || null;
		}

		return null;
	};

	const recommendedUpgradeUrl = getRecommendedUpgradeUrl();
	const subscriptionDisplay = getSubscriptionStatusDisplay();

	return (
		<div className="w-full">
			{/* Card Header - Plan Name & Status. */}
			<div className="w-full p-6 border-b border-gray-300">
				<div className="flex items-center gap-3 mb-6">
					<h2 className="text-xl font-semibold text-black">
						{tier ?
							`Burst Pro — ${getTierDisplayName( tier )}` :
							'Burst Pro'
						}
					</h2>
					<span
						className={clsx(
							'inline-flex items-center px-3 py-1 text-sm font-medium rounded-full',
							isActive ?
								'text-green-dark bg-green-light' :
								'text-red bg-red-light'
						)}
					>
						{isActive ?
							__( 'Active', 'burst-statistics' ) :
							__( 'Inactive', 'burst-statistics' )
						}
					</span>
				</div>

				{/* Status Details - Two-Column Layout. */}
				<div className="flex flex-col gap-3 text-sm mb-6">
					{/* License Status - Active on THIS website. */}
					<div className="flex items-center justify-between">
						<span className="font-medium text-gray">
							{__( 'License status', 'burst-statistics' )}
						</span>
						<span className="text-black">{getLicenseStatusDisplay()}</span>
					</div>

					{/* Site Activations. */}
					<div className="flex items-center justify-between">
						<span className="font-medium text-gray">
							{__( 'Site activations', 'burst-statistics' )}
						</span>
						<span className="text-black">{getActivationDisplay()}</span>
					</div>

					{/* Subscription Status - Auto-renewal status. */}
					<div className="flex items-center justify-between">
						<span className="font-medium text-gray">
							{__( 'Subscription status', 'burst-statistics' )}
						</span>
						<span className={subscriptionDisplay.color}>
							{subscriptionDisplay.text}
						</span>
					</div>
				</div>

				{/* Primary Actions - Only shown when active. */}
				{isActive && (
					<div className="flex items-center gap-3">
						<ButtonInput
							btnVariant="tertiary"
							onClick={() =>
								window.open(
									burst_get_website_url( 'account', {
										utm_source: 'license-settings',
										utm_content: 'manage-subscription'
									}),
									'_blank'
								)
							}
						>
							{__( 'Manage subscription', 'burst-statistics' )}
						</ButtonInput>
						<button
							type="button"
							onClick={onDeactivate}
							disabled={isLicenseMutationPending}
							className="text-sm text-gray hover:text-red underline focus:outline-none focus:ring-2 focus:ring-red focus:ring-offset-2 rounded transition-colors"
						>
							{__( 'Deactivate license on this site', 'burst-statistics' )}
						</button>
						{isLicenseMutationPending && <Icon name="loading" size={20} />}
					</div>
				)}
			</div>

			{/* Contextual Action Area - Smart, Priority-Based Messaging. Only shown when active. */}
			{isActive && contextualAction && (
				<div className={clsx( 'p-6 my-4 mx-6 rounded-lg', VARIANT_STYLES[contextualAction.variant].container )}>
					<div className="flex flex-col gap-3">
						<h3 className={'text-md font-semibold'}>
							{contextualAction.headline}
						</h3>
						<p className={'text-sm'}>
							{contextualAction.body}
						</p>
						<div className="mt-2">
							<ButtonInput
								btnVariant={VARIANT_STYLES[contextualAction.variant].button}
								onClick={() => window.open( contextualAction.buttonUrl, '_blank' )}
							>
								{contextualAction.buttonText}
							</ButtonInput>
						</div>
					</div>
				</div>
			)}

			{/* Available Upgrades Section - Hide if there's an urgent action required. Only shown when active. */}
			{isActive && 0 < upgrades.length && ! contextualAction && (
				<div className="w-full p-6 bg-gray-50 border-t border-gray-200">
					<h3 className="text-md font-semibold text-gray-900 mb-4">
						{__( 'Available upgrades', 'burst-statistics' )}
					</h3>
					<div className="flex flex-col gap-3">
						{upgrades.map( ( upgrade, index ) => {

							// Add UTM parameters to upgrade URL.
							const upgradeUrlWithUTM = upgrade.url.includes( 'burst-statistics.com' ) ?
								addQueryArgs( upgrade.url, {
										utm_source: 'license-settings',
										utm_content: `upgrade-to-${upgrade.tier.toLowerCase()}`
								}) :
								upgrade.url;

							// Check if this is the recommended upgrade.
							const isRecommended = upgrade.url === recommendedUpgradeUrl;

							return (
								<div
									key={index}
									className={clsx(
										'flex items-center justify-between p-4 bg-white border rounded-lg transition-colors',
										isRecommended ?
											'border-green-light hover:border-green' :
											'border-gray-200 hover:border-gray-300'
									)}
								>
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-1">
											<h4 className="font-medium text-black">
												{upgrade.tier}
											</h4>
											{isRecommended && (
												<span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium text-green-dark bg-green-light rounded-full">
													{__( 'Recommended for you', 'burst-statistics' )}
												</span>
											)}
										</div>
										<p className="text-sm text-gray">
											{'unlimited' === upgrade.sites ?
												__( 'Unlimited sites', 'burst-statistics' ) :
												sprintf(

														/* translators: %s: number of sites */
														_n(
															'%s site',
															'%s sites',
															upgrade.sites,
															'burst-statistics'
														),
														upgrade.sites
												)}
										</p>
									</div>
									<ButtonInput
										btnVariant={isRecommended ? 'primary' : 'secondary'}
										size="sm"
										onClick={() => window.open( upgradeUrlWithUTM, '_blank' )}
									>
										{__( 'Upgrade', 'burst-statistics' )}
									</ButtonInput>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
};

/**
 * LicenseField component for managing license activation and status.
 *
 * This component renders based on the license status:
 * - Empty: Only shows LicenseActivationForm.
 * - Active: Only shows LicenseStatusCard.
 * - Inactive (deactivated/expired): Shows LicenseActivationForm + LicenseStatusCard.
 */
const LicenseField = forwardRef<HTMLInputElement, LicenseFieldProps>(
	({ field, className, ...props }, ref ) => {

		// Use the custom license data hook.
		const {
			licenseNotices,
			licenseStatus,
			isFetching,
			isLicenseMutationPending,
			activateLicense,
			deactivateLicense,
			upgrades,
			tier,
			activationLimit,
			activationsLeft,
			licenseExpiresDate,
			licenseIsLifetime,
			subscriptionStatus,
			hasSubscriptionInfo,
			isTrial,
			trialRemainingDays,
			encryptedLicenseKey
		} = useLicenseData();

		const inputId = props.id || field.name;
		const isActive = 'valid' === licenseStatus;
		const isEmpty = '' === licenseStatus || 'empty' === licenseStatus;
		const isInactive = ! isActive && ! isEmpty;

		// Extract error message from notices for inline display.
		const errorMessage = licenseNotices.find(
			( notice ) => 'warning' === notice.icon
		)?.msg;

		/**
		 * Handle license activation.
		 */
		const handleActivate = () => {
			if ( field.value ) {
				activateLicense( field.name, field.value );
			}
		};

		/**
		 * Handle license deactivation.
		 */
		const handleDeactivate = () => {
			deactivateLicense();
		};

		return (
			<div className={clsx( 'w-full', className )} ref={ref}>
				{/* Show activation form when not active. */}
				{! isActive && (
					<LicenseActivationForm
						licenseKey={field.value}
						onLicenseKeyChange={field.onChange}
						onActivate={handleActivate}
						isLicenseMutationPending={isLicenseMutationPending}
						fieldName={inputId}
						errorMessage={! isFetching ? errorMessage : undefined}
					/>
				)}

				{/* Show status card when active OR when inactive (has license data but not active). */}
				{( isActive || isInactive ) && (
					<LicenseStatusCard
						tier={tier}
						activationLimit={activationLimit}
						activationsLeft={activationsLeft}
						expiresDate={licenseExpiresDate}
						isLifetime={licenseIsLifetime}
						isLicenseMutationPending={isLicenseMutationPending}
						onDeactivate={handleDeactivate}
						upgrades={upgrades}
						subscriptionStatus={subscriptionStatus}
						hasSubscriptionInfo={hasSubscriptionInfo}
						isTrial={isTrial}
						trialRemainingDays={trialRemainingDays}
						licenseStatus={licenseStatus}
						encryptedLicenseKey={encryptedLicenseKey}
					/>
				)}
			</div>
		);
	}
);

LicenseField.displayName = 'LicenseField';

export default LicenseField;

