import ErrorBoundary from '@/components/Common/ErrorBoundary';
import useGoalsData from '@/hooks/useGoalsData';
import SettingsGroupBlock from './SettingsGroupBlock';
import SettingsFooter from './SettingsFooter';
import useSettingsData from '@/hooks/useSettingsData';
import {
	useSettingsPageState
} from '@/components/Settings/settingsHelpers';

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
	const {
		handleSubmit,
		control,
		dirtyFields,
		reset,
		filteredGroups
	} = useSettingsPageState({
		settings,
		settingsId,
		groups: currentSettingPage.groups,
		includeRecommendedConditions: true
	});

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

				{! currentSettingPage.no_save_footer && (
					<SettingsFooter
						onSubmit={ handleSubmit( async( formData ) => {
							const changedData = Object.keys( dirtyFields ).reduce(
								( acc, key ) => {
									acc[key] = formData[key];
									return acc;
								},
								{}
							);
							await Promise.all([
								saveSettings( changedData ).then( () => {
									reset( formData, {
										keepValues: true,
										keepDefaultValues: false
									});
								}),
								saveGoals()
							]);
						})}
						control={control}
					/>
				)}
			</ErrorBoundary>
		</form>
	);
};
export default Settings;
