type EssentialsSettings = { essentials_mode?: boolean; non_essential_features?: string[] };

/**
 * Whether essentials mode is on: the live setting when the user has settings
 * fields, otherwise the localized flag.
 *
 * @param {unknown} essentialsSetting - Value of the `essentials_mode` setting, or undefined.
 * @param {Object}  burstSettings     - The `burst_settings` localization object, if present.
 * @return {boolean} True when essentials mode is on.
 */
const isEssentialsMode = ( essentialsSetting: unknown, burstSettings?: EssentialsSettings ): boolean =>
	!! ( undefined === essentialsSetting ? burstSettings?.essentials_mode : essentialsSetting );

/**
 * Decide whether a feature is on under essentials mode, the React side of
 * PHP `Helper::is_feature_enabled()`.
 *
 * Managers get the settings fields, so for them the live `essentials_mode`
 * value is the truth: toggling it shows or hides blocks without a page reload.
 * Viewers and share links get no settings fields, so `getValue` returns
 * undefined for them and the flag localized by PHP decides instead. The list of
 * features essentials mode turns off always comes from PHP, where it is managed.
 *
 * @param {string}  slug              - Feature slug, as in `burst_non_essential_features`.
 * @param {unknown} essentialsSetting - Value of the `essentials_mode` setting, or undefined when the user has no settings fields.
 * @param {Object}  burstSettings     - The `burst_settings` localization object, if present.
 * @return {boolean} False when essentials mode is on and the feature is non-essential.
 */
export const isFeatureEnabled = (
	slug: string,
	essentialsSetting: unknown,
	burstSettings?: EssentialsSettings
): boolean =>
	! isEssentialsMode( essentialsSetting, burstSettings ) ||
	! ( burstSettings?.non_essential_features ?? []).includes( slug );
