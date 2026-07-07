import { useState, useMemo } from 'react';
import useGoalsData from '@/hooks/useGoalsData';
import { __ } from '@wordpress/i18n';
import Icon from '../../utils/Icon';
import GoalSetup from './GoalSetup';
import { burst_get_website_url } from '../../utils/lib';
import * as Popover from '@radix-ui/react-popover';
import useLicenseData from '@/hooks/useLicenseData';
import ButtonInput from '../Inputs/ButtonInput';
import IconButton from '../Inputs/IconButton';

const GoalsSettings = () => {
	const {
		goals,
		goalFields,
		predefinedGoals,
		addGoal,
		deleteGoal,
		updateGoal,
		addPredefinedGoal,
		setGoalValue,
		saveGoalTitle
	} = useGoalsData();
	const { isLicenseValid } = useLicenseData();
	const [ searchQuery, setSearchQuery ] = useState( '' );

	const filteredGoals = useMemo( () => {
		if ( ! searchQuery.trim() ) {
			return goals;
		}
		const query = searchQuery.toLowerCase();
		return goals.filter( ( goal ) =>
			goal && 'string' === typeof goal.title && goal.title.toLowerCase().includes( query )
		);
	}, [ goals, searchQuery ]);
	const popoverContainer =
		'undefined' !== typeof document ?
			document.querySelector( '.burst' ) :
			null;

	const handleAddPredefinedGoal = async( goal ) => {
		await addPredefinedGoal( goal.id );
	};

	const getGoalTypeNice = ( type ) => {
		switch ( type ) {
			case 'hook':
				return 'Hook';
			case 'clicks':
				return __( 'Click', 'burst-statistics' );
			case 'views':
				return __( 'View', 'burst-statistics' );
			default:
				return type;
		}
	};

	const predefinedGoalsButtonClass =
		! predefinedGoals || 0 === predefinedGoals.length ?
			'burst-inactive' :
			'';
	return (
		<div className="box-border w-full p-3 md:p-6">
			<p className="text-base text-text-gray mb-4">
				{__(
					'Goals are a great way to track your progress and keep you motivated.',
					'burst-statistics'
				)}
				{! isLicenseValid &&
					' ' +
						__(
							'While free users can create one goal, Burst Pro lets you set unlimited goals to plan, measure, and achieve more.',
							'burst-statistics'
						)}
			</p>
			{0 < goals.length && (
				<div className="relative w-full mb-4">
					<input
						type="text"
						value={searchQuery}
						onChange={( e ) => setSearchQuery( e.target.value )}
						placeholder={__( 'Search goals...', 'burst-statistics' )}
						className="w-full bg-gray-100 border border-gray-200 rounded-md pl-12 pr-10 py-2.5 text-md text-text-black placeholder:text-text-gray-light focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200"
					/>
					<div className="absolute left-4 top-0 bottom-0 text-text-gray pointer-events-none flex items-center justify-center">
						<Icon name="search" size={18} />
					</div>
					{searchQuery && (
						<button
							type="button"
							onClick={() => setSearchQuery( '' )}
							className="absolute right-3.5 top-0 bottom-0 text-text-gray hover:text-text-black transition-colors flex items-center justify-center cursor-pointer"
							style={{ border: 'none', background: 'none' }}
						>
							<Icon name="times" size={18} />
						</button>
					)}
				</div>
			)}
			<div className="flex flex-wrap flex-col gap-4 mt-4">
				{0 < filteredGoals.length ? (
					filteredGoals.map( ( goal, index ) => {
						return (
							<GoalSetup
								key={goal.id || index}
								goal={goal}
								goalFields={goalFields}
								setGoalValue={setGoalValue}
								deleteGoal={deleteGoal}
								onUpdate={updateGoal}
								saveGoalTitle={saveGoalTitle}
							/>
						);
					})
				) : (
					0 < goals.length && (
						<div className="p-8 text-center text-text-gray bg-gray-100 rounded-lg">
							{__( 'No goals match your search.', 'burst-statistics' )}
						</div>
					)
				)}

				{( isLicenseValid || 0 === goals.length ) && (
					<div className="flex items-center gap-2">
						<ButtonInput btnVariant={'tertiary'} onClick={addGoal}>
							{__( 'Add goal', 'burst-statistics' )}
						</ButtonInput>

						{predefinedGoals && (
							<Popover.Root>
								<Popover.Trigger asChild>
									<IconButton
										label={__(
											'Add predefined goal',
											'burst-statistics'
										)}
										icon={'chevron-down'}
										className={
											predefinedGoalsButtonClass +
											' burst-button burst-button--secondary burst-add-predefined-goal'
										}
									/>
								</Popover.Trigger>

								<Popover.Portal container={popoverContainer}>
									<Popover.Content
										sideOffset={5}
										align={'end'}
										className="burst-predefined-goals-list z-50 flex flex-col gap-2 rounded-lg border border-gray-400 bg-white p-2"
									>
										{predefinedGoals.map( ( goal, index ) => {
											return (
												<Popover.Close asChild key={index}>
													<div
														className={
															'relative z-50 flex cursor-pointer flex-row gap-1 rounded-lg border border-gray-400 bg-gray-100 hover:bg-gray-200 p-2'
														}
														onClick={() =>
															handleAddPredefinedGoal(
																goal
															)
														}
													>
														<Icon
															name={'plus'}
															size={18}
															color="gray"
														/>
														{goal.title +
															' (' +
															getGoalTypeNice( goal.type ) +
															')'}
													</div>
												</Popover.Close>
											);
										})}
										{__(
											'Plug-in you\'re looking for not listed?',
											'burst-statistics'
										) + ' '}
										<a
											className="underline"
											href={burst_get_website_url(
												'/request-goal-integration/',
												{
													utm_source:
														'goals-integration-request'
												}
											)}
										>
											{__(
												'Request it here!',
												'burst-statistics'
											)}
										</a>
									</Popover.Content>
								</Popover.Portal>
							</Popover.Root>
						)}
						<div className="ml-auto text-right">
							<p className="rounded-lg bg-gray-300 p-1 px-3 text-sm text-text-gray">
								{isLicenseValid ? (
									<> {goals.length} / &#8734; </>
								) : (
									<>{goals.length} / 1</>
								)}
							</p>
						</div>
					</div>
				)}
				{! isLicenseValid && (
					<div className="flex gap-4 p-4 bg-gray-200 rounded-md mt-4 justify-start items-center border-2 border-gray-300">
						<Icon name={'goals'} size={24} color="gray" />
						<h4>{__( 'Want more goals?', 'burst-statistics' )}</h4>
						<div className="burst-divider" />
						<p className="text-sm text-text-gray">
							{__( 'Upgrade to Burst Pro', 'burst-statistics' )}
						</p>
						<a
							href={burst_get_website_url( '/pricing/', {
								utm_source: 'goals-setting',
								utm_content: 'more-goals'
							})}
							target={'_blank'}
							className="ml-auto burst-button burst-button--pro"
						>
							{__( 'Upgrade to Pro', 'burst-statistics' )}
						</a>
					</div>
				)}
			</div>
		</div>
	);
};

export default GoalsSettings;
