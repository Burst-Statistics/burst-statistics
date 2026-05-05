import { useMemo } from 'react';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import useSettingsData from '@/hooks/useSettingsData';
import { useForm } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import SettingsFooter from '@/components/Settings/SettingsFooter';
import SettingsGroupBlock from '@/components/Settings/SettingsGroupBlock';
import { __ } from '@wordpress/i18n';

/**
 * Renders the selected settings
 *
 * @param root0
 * @param root0.currentSettingPage
 */
const Reporting = ({ currentSettingPage }) => {
	const { settings, saveSettings } = useSettingsData();
	const settingsId = currentSettingPage.id;

	const initialDefaultValues = useMemo(
		() => extractFormValuesPerMenuId( settings, settingsId ),
		[] // eslint-disable-line react-hooks/exhaustive-deps
	);

	// Initialize useForm with default values from the fetched settings data
	const {
		handleSubmit,
		control,
		formState: { dirtyFields },
		reset
	} = useForm({
		defaultValues: initialDefaultValues
	});

	const watchedValues = useWatch({ control });

	const filteredGroups = useMemo( () => {
		const grouped = [];
		currentSettingPage.groups.forEach( ( group ) => {
			const groupFields = settings
				.filter(
					( setting ) =>
						setting.menu_id === settingsId &&
						setting.group_id === group.id
				)
				.filter( ( setting ) => {
					if ( ! setting.react_conditions ) {
						return true;
					}
					return Object.entries( setting.react_conditions ).every(
						([ field, allowedValues ]) => {
							const value = watchedValues?.[field];
							if ( ! Array.isArray( allowedValues ) ) {
								return value === allowedValues;
							}

							if ( Array.isArray( value ) ) {
								return allowedValues.some(
									( allowedValue ) =>
										Array.isArray( allowedValue ) &&
										value.length === allowedValue.length &&
										value.every(
											( val, index ) =>
												val === allowedValue[index]
										)
								);
							}
							return allowedValues.includes( value );
						}
					);
				});

			if ( 0 < groupFields.length ) {
				grouped.push({ ...group, fields: groupFields });
			}
		});

		return grouped;
	}, [ settings, settingsId, currentSettingPage.groups, watchedValues ]);

	const shouldShowFooter = 'reports' !== settingsId && 'logs' !== settingsId;

	return (
		<form>
			<ErrorBoundary fallback={ __( 'Could not load Reporting Settings', 'burst-statistics' ) }>
				{
					filteredGroups.map( ( group, index ) => {
						const isLastGroup = index === filteredGroups.length - 1;

						return (
							<SettingsGroupBlock
								key={group.id}
								group={group}
								fields={group.fields}
								control={control}
								isLastGroup={isLastGroup}
								isShowingFooter={ shouldShowFooter }
							/>
						);
					})}

				{
					shouldShowFooter && (
						<SettingsFooter
							onSubmit={ handleSubmit( ( formData ) => {
								const changedData = Object.keys( dirtyFields ).reduce(
									( acc, key ) => {
										acc[key] = formData[key];
										return acc;
										},
									{}
								);
								saveSettings( changedData ).then( () => {
									reset( formData, {
										keepValues: true,
										keepDefaultValues: false
									});
								});
							})}
							control={control}
						/>
					)
				}
			</ErrorBoundary>
		</form>
	);
};
export default Reporting;

const extractFormValuesPerMenuId = ( settings, menuId ) => {
	const formValues = {};
	settings.forEach( ( setting ) => {
		if ( setting.menu_id === menuId ) {
			const hasValue =
				setting.value !== undefined && '' !== setting.value;
			formValues[setting.id] = hasValue ? setting.value : setting.default;
		}
	});
	return { ...formValues };
};
