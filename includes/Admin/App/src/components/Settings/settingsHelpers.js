import { useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';

const extractFormValuesPerMenuId = ( settings, menuId ) => {
	const formValues = {};
	settings.forEach( ( setting ) => {
		if ( setting.menu_id === menuId ) {
			const hasValue = setting.value !== undefined && '' !== setting.value;
			formValues[setting.id] = hasValue ? setting.value : setting.default;
		}
	});
	return { ...formValues };
};

// fallow-ignore-next-line complexity
const evaluateConditionValue = ( value, allowedValues ) => {
	if ( 'boolean' === typeof allowedValues ) {
		value = 1 === value || true === value || '1' === value;
	}

	if ( ! Array.isArray( allowedValues ) ) {
		return value === allowedValues;
	}

	if ( Array.isArray( value ) ) {
		return allowedValues.some(
			( allowedValue ) =>
				Array.isArray( allowedValue ) &&
				value.length === allowedValue.length &&
				value.every( ( val, index ) => val === allowedValue[index])
		);
	}

	return allowedValues.includes( value );
};

const evaluateConditions = ({ conditions, watchedValues, initialDefaultValues, skipKeys = [] }) => {
	return Object.entries( conditions )
		.filter( ([ field ]) => ! skipKeys.includes( field ) )
		.every( ([ field, allowedValues ]) => {
			const value = watchedValues?.[field] ?? initialDefaultValues[field];
			return evaluateConditionValue( value, allowedValues );
		});
};

const buildFilteredGroups = ({
	settings,
	settingsId,
	groups,
	watchedValues,
	initialDefaultValues,
	includeRecommendedConditions = false
}) => {
	const grouped = [];

	groups.forEach( ( group ) => {
		const groupFields = settings
			.filter(
				( setting ) => setting.menu_id === settingsId && setting.group_id === group.id
			)

			// fallow-ignore-next-line complexity
			.map( ( setting ) => {

				// Static, server-driven visibility (reflects the saved option,
				// not the live form value). The field stays registered in the
				// form so it never dirties; it is only rendered once visible.
				if ( false === setting.visible ) {
					return null;
				}

				let resolvedSetting = setting;

				if ( setting.react_conditions ) {
					const conditionsMet = evaluateConditions({
						conditions: setting.react_conditions,
						watchedValues,
						initialDefaultValues,
						skipKeys: [ 'action' ]
					});
					const action = setting.react_conditions.action || 'hide';

					if ( 'disable' === action ) {
						resolvedSetting = { ...resolvedSetting, disabled: ! conditionsMet };
					} else if ( ! conditionsMet ) {
						return null;
					}
				}

				if ( includeRecommendedConditions && setting.recommended_conditions ) {
					const isRecommended = evaluateConditions({
						conditions: setting.recommended_conditions,
						watchedValues,
						initialDefaultValues
					});
					resolvedSetting = { ...resolvedSetting, recommended: isRecommended };
				}

				return resolvedSetting;
			})
			.filter( Boolean );

		if ( 0 < groupFields.length ) {
			grouped.push({ ...group, fields: groupFields });
		}
	});

	return grouped;
};

export const useSettingsPageState = ({
	settings,
	settingsId,
	groups,
	includeRecommendedConditions = false
}) => {
	const initialDefaultValues = useMemo(
		() => extractFormValuesPerMenuId( settings, settingsId ),
		[ settings, settingsId ]
	);

	const {
		handleSubmit,
		control,
		formState: { dirtyFields },
		reset
	} = useForm({
		defaultValues: initialDefaultValues
	});

	// When settings are refetched (e.g. after save), sync the form's default values
	// so newly returned fields (like integration rows) are registered with the correct
	// server-side values. Only reset when the form is clean to avoid discarding
	// unsaved user edits.
	const prevDefaultsRef = useRef( initialDefaultValues );
	useEffect( () => {
		if ( prevDefaultsRef.current === initialDefaultValues ) {
			return;
		}
		prevDefaultsRef.current = initialDefaultValues;
		if ( 0 === Object.keys( dirtyFields ).length ) {
			reset( initialDefaultValues );
		}
	}, [ initialDefaultValues, dirtyFields, reset ]);

	const watchedValues = useWatch({ control });
	const filteredGroups = useMemo(
		() =>
			buildFilteredGroups({
				settings,
				settingsId,
				groups,
				watchedValues,
				initialDefaultValues,
				includeRecommendedConditions
			}),
		[ settings, settingsId, groups, watchedValues, initialDefaultValues, includeRecommendedConditions ]
	);

	return {
		handleSubmit,
		control,
		dirtyFields,
		reset,
		filteredGroups
	};
};
