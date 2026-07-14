import ErrorBoundary from '@/components/Common/ErrorBoundary';
import useSettingsData from '@/hooks/useSettingsData';
import SettingsFooter from '@/components/Settings/SettingsFooter';
import SettingsGroupBlock from '@/components/Settings/SettingsGroupBlock';
import { __ } from '@wordpress/i18n';
import {
	useSettingsPageState
} from '@/components/Settings/settingsHelpers';

/**
 * Renders the selected settings
 *
 * @param root0
 * @param root0.currentSettingPage
 */
const Reporting = ({ currentSettingPage }) => {
	const { settings, saveSettings } = useSettingsData();
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
		groups: currentSettingPage.groups
	});

	const shouldShowFooter = 'reports' !== settingsId && 'logs' !== settingsId;

	return (
		<form>
			<ErrorBoundary fallback={ __( 'Could not load Reporting Settings', 'burst-statistics' ) }>
				{filteredGroups.map( ( group, index ) => {
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

				{shouldShowFooter && (
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
				)}
			</ErrorBoundary>
		</form>
	);
};

export default Reporting;
