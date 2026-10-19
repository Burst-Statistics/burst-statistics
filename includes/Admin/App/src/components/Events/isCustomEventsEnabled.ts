/**
 * Decide whether custom event tracking is on for the current user.
 *
 * Managers get the settings fields, so for them the live setting value is the
 * truth. Viewers and share links get no settings fields at all, so `getValue`
 * returns nothing for them and the flag localized by PHP decides instead.
 * Either source being truthy means the site records events.
 *
 * @param {unknown} settingValue  - Value of the `enable_custom_events` setting, or undefined when the user has no settings fields.
 * @param {Object}  burstSettings - The `burst_settings` localization object, if present.
 * @return {boolean} True when custom event tracking is on.
 */
export const isCustomEventsEnabled = (
	settingValue: unknown,
	burstSettings?: { custom_events_enabled?: boolean }
): boolean => !! settingValue || !! burstSettings?.custom_events_enabled;
