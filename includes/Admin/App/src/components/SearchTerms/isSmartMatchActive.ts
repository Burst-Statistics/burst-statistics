/**
 * Whether the SmartMatch Search plugin is active, as localized by PHP
 * (`burst_settings.smartmatch_active`). The AI match column only exists then.
 *
 * @return {boolean} True when SmartMatch is active.
 */
export const isSmartMatchActive = (): boolean =>
	!! ( window as unknown as { burst_settings?: { smartmatch_active?: boolean } }).burst_settings?.smartmatch_active;
