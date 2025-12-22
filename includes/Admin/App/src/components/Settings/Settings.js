import { useMemo } from 'react';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import useGoalsData from '@/hooks/useGoalsData';
import SettingsGroupBlock from './SettingsGroupBlock';
import SettingsFooter from './SettingsFooter';
import useSettingsData from '@/hooks/useSettingsData';
import { useForm } from 'react-hook-form';
import { useWatch } from 'react-hook-form';

/**
 * Renders the selected settings
 *
 * @param root0
 * @param root0.currentSettingPage
 */
const Settings = ({ currentSettingPage }) => {
	const { settings, saveSettings } = useSettingsData();
	const { saveGoals } = useGoalsData();
	const settingsId = currentSettingPage.id;

	const initialDefaultValues = useMemo(
		() => extractFormValuesPerMenuId( settings, settingsId ),
		[ settings, settingsId ]
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
				.map( ( setting ) => {
					if ( ! setting.react_conditions ) {
						return setting;
					}

					const conditionsMet = Object.entries( setting.react_conditions )
						.filter( ([ field ]) => 'action' !== field )
						.every(
							([ field, allowedValues ]) => {
								let value = watchedValues?.[field] ?? initialDefaultValues[field];

								//check if allowedValues is a boolean.
								if ( 'boolean' === typeof allowedValues ) {
									value = 1 === value || true ===  value || '1' === value;
								}
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

					const action = setting.react_conditions.action || 'hide';

					if ( 'disable' === action ) {
						return {
							...setting,
							disabled: ! conditionsMet
						};
					}

					// Default action is 'hide'
					return conditionsMet ? setting : null;
				})
				.filter( Boolean );

			if ( 0 < groupFields.length ) {
				grouped.push({ ...group, fields: groupFields });
			}
		});

		return grouped;
	}, [ settings, settingsId, currentSettingPage.groups, watchedValues ]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<form>
			<ErrorBoundary fallback={'Could not load Settings'}>
				{filteredGroups.map( ( group, index ) => {
					const isLastGroup = index === filteredGroups.length - 1;

					return (
						<SettingsGroupBlock
							key={group.id}
							group={group}
							fields={group.fields}
							control={control}
							isLastGroup={isLastGroup}
						/>
					);
				})}

				{'license' !== settingsId && (
					<SettingsFooter
						onSubmit={handleSubmit( ( formData ) => {
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
							saveGoals();
						})}
						control={control}
					/>
				)}
			</ErrorBoundary>
		</form>
	);
};
export default Settings;

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
