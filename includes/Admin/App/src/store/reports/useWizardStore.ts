import { create } from 'zustand';

import { format } from 'date-fns';
import {
	WizardState,
	DayOfWeekType,
	FrequencyType,
	WeekOfMonthType, ContentBlock, ContentBlockId
} from './types';
import { useReportConfigStore } from './useReportConfigStore';
import type { FilterSearchParams } from '@/config/filterConfig';
import { availableRanges } from '@/utils/formatting';
import {DateRangeValue} from '@/components/Inputs/DateRangePicker';

/**
 * Store shape: wizard state + actions/helpers
 */
interface WizardStore {
	wizard: WizardState;

	isOpen: boolean;
	setIsOpen: ( v: boolean ) => void;
	openWizard: () => void;
	closeWizard: () => void;

	isEditingMode: boolean;
	setIsEditingMode: ( v: boolean ) => void;

	selectedBlockIndex: number | null;
	setSelectedBlockIndex: ( index: number | null ) => void;

	setCurrentStep: ( step: number ) => void;
	nextStep: () => void;
	prevStep: () => void;

	setReportName: ( name: string ) => void;
	setFormat: ( format: string ) => void;
	setRecipients: ( recipients: string[]) => void;
	setScheduled: ( schedule: boolean ) => void;
	setFrequency: ( frequency: FrequencyType ) => void;
	setDayOfWeek: ( d?: DayOfWeekType ) => void;
	setWeekOfMonth: ( n?: WeekOfMonthType ) => void;
	setSendTime: ( t: string ) => void;
	setDateRange: ( range: string, index?:number ) => void;
	getFixedEndDate: ( index:number ) => string;
	addContent: ( blockId: ContentBlockId ) => void;
	removeContent: ( index: number ) => void;
	updateComment: ( index: number, text: string ) => void;
	updateCommentTitle: ( index: number, title: string ) => void;
	updateCommentText: ( index: number, text: string ) => void;
	getCommentTitle: ( index: number ) => string;
	getCommentText: ( index: number ) => string;
	toggleBlockDateRangeEnabled: ( index: number ) => void;
	blockDateRangeEnabled: ( index: number ) => boolean;
	updateFilters: ( index: number, filters: FilterSearchParams ) => void;
	getFilters: ( index: number ) => FilterSearchParams;
	getBlockDateRange: ( index: number ) => string;
	getComment: ( index: number ) => string;
	moveContentUp: ( index: number ) => void;
	moveContentDown: ( index: number ) => void;
	getDateRangeDate: ( index: number, type:'start' | 'end' ) => string;
	parseDateRange: ( dateRange: string, type:'start' | 'end' ) => string;
	getDateRange: ( index: number ) => string;
	getEndDate: ( index: number ) => string;
	getStartDate: ( index: number ) => string;
	reorderContent: ( newOrder: ContentBlock[]) => void;
	resetWizard: () => void;
	getParsedDateRangeValue: ( dateRange: string ) => DateRangeValue;
}

const DEFAULT_CLASSIC_IDS:ContentBlockId[] = [ 'compare', 'most_visited_pages', 'top_referrers' ];
const DEFAULT_STORY_IDS:ContentBlockId[] = [ 'logo', 'insights', 'pages' ];

const createDefaultBlocks = ( ids: ContentBlockId[]): ContentBlock[] => {
	return ids.map( id => ({
		fixed_end_date: '',
		date_range_enabled: false,
		id,
		filters: {},
		date_range: '',
		content: '',
		comment_title: '',
		comment_text: ''
	}) );
};

const DEFAULT_CLASSIC_BLOCKS = createDefaultBlocks( DEFAULT_CLASSIC_IDS );
const DEFAULT_STORY_BLOCKS = createDefaultBlocks( DEFAULT_STORY_IDS );

/**
 * Initial wizard state.
 * Use a shallow clone of defaultContent so we don't share references.
 */
const INITIAL_WIZARD_STATE: WizardState = {
	id: null,
	currentStep: 1,
	name: '',
	format: 'classic',
	content: DEFAULT_CLASSIC_BLOCKS,
	recipients: [],
	scheduled: true,
	frequency: 'weekly',
	dayOfWeek: 'monday',
	sendTime: '09:00',
	fixedEndDate: '',
	reportDateRange: 'last-7-days'
};


type FormatDefaults = {
	classic: ContentBlock[];
	story: ContentBlock[];
};

const DEFAULT_CONTENT: FormatDefaults = {
	classic: DEFAULT_CLASSIC_BLOCKS,
	story: DEFAULT_STORY_BLOCKS
};

// Helper functions
const findLastWeekdayOccurrence = ( dayOfWeek: DayOfWeekType, referenceDate: Date ): Date => {
	const dayMap: Record<DayOfWeekType, number> = {
		'sunday': 0,
		'monday': 1,
		'tuesday': 2,
		'wednesday': 3,
		'thursday': 4,
		'friday': 5,
		'saturday': 6
	};

	const targetDay = dayMap[dayOfWeek];
	const current = new Date( referenceDate );
	current.setHours( 0, 0, 0, 0 );

	// Go back to find the last occurrence (including today)
	while ( current.getDay() !== targetDay ) {
		current.setDate( current.getDate() - 1 );
	}

	return current;
};

const findLastMonthlyOccurrence = ( dayOfWeek: DayOfWeekType, ordinal: WeekOfMonthType, referenceDate: Date ): Date => {
	const dayMap: Record<DayOfWeekType, number> = {
		'sunday': 0,
		'monday': 1,
		'tuesday': 2,
		'wednesday': 3,
		'thursday': 4,
		'friday': 5,
		'saturday': 6
	};

	const targetDay = dayMap[dayOfWeek];
	const current = new Date( referenceDate );
	current.setHours( 0, 0, 0, 0 );

	// Try current month and previous months
	for ( let monthOffset = 0; 12 > monthOffset; monthOffset++ ) {
		const checkDate = new Date( current );
		checkDate.setMonth( checkDate.getMonth() - monthOffset );

		const year = checkDate.getFullYear();
		const month = checkDate.getMonth();

		// Find all occurrences of targetDay in this month
		const occurrences: Date[] = [];
		const daysInMonth = new Date( year, month + 1, 0 ).getDate();

		for ( let day = 1; day <= daysInMonth; day++ ) {
			const date = new Date( year, month, day );
			if ( date.getDay() === targetDay ) {
				occurrences.push( date );
			}
		}

		if ( 0 < occurrences.length ) {
			let targetOccurrence: Date | undefined;

			if ( -1 === ordinal ) {

				// Last occurrence
				targetOccurrence = occurrences[occurrences.length - 1];
			} else {

				// nth occurrence (1-indexed)
				const index = ordinal - 1;
				targetOccurrence = occurrences[index];
			}

			// Return the first valid occurrence we find
			if ( targetOccurrence && targetOccurrence <= referenceDate ) {
				return targetOccurrence;
			}
		}
	}

	// Fallback
	return referenceDate;
};

export const useWizardStore = create<WizardStore>( ( set, get ) => ({
	wizard: { ...INITIAL_WIZARD_STATE },
	isOpen: false,
	setIsOpen: ( v: boolean ) => set( ( state ) => ({ ...state, isOpen: v }) ),
	openWizard: () => set( ( state ) => ({ ...state, isOpen: true }) ),
	closeWizard: () => set( ( state ) => ({ ...state, isOpen: false, selectedBlockIndex: null }) ),
	isEditingMode: false,
	selectedBlockIndex: null,
	setSelectedBlockIndex: ( index: number | null ) => set({ selectedBlockIndex: index }),
	blockDateRangeEnabled: ( index: number ) => {
		const block = get().wizard.content[index];
		return !! block?.date_range_enabled;
	},
	getFixedEndDate: ( index:number )=> {

		//for each block, check if date_range_enabled is true and if so, return the fixed_end_date for that block.
		const block = get().wizard.content[index];
		if ( -1 < index && block?.date_range_enabled ) {
			return block.fixed_end_date;
		}

		if ( '' === get().wizard.fixedEndDate ) {
			return get().parseDateRange( get().wizard.reportDateRange as string, 'end' );
		}

		//date_range_enabled is false, so return the fixedEndDate from the report.
		return get().wizard.fixedEndDate as string;
	},
	setDateRange: ( range: string, index: number = -1 ) =>
		set( ( state ) => {
			const fixedEndDate = get().parseDateRange( range, 'end' );
			if ( -1 === index ) {

				// Update report date range
				return {
					wizard: {
						...state.wizard,
						reportDateRange: range,
						fixedEndDate: fixedEndDate
					}
				};
			}

			// Update block date range if index>=0
			const newContent = [ ...state.wizard.content ];
			if ( newContent[index]) {
				newContent[index] = {
					...newContent[index],
					date_range: range,
					fixed_end_date: fixedEndDate
				};
			}

			return {
				wizard: {
					...state.wizard,
					content: newContent
				}
			};
		}),
	toggleBlockDateRangeEnabled: ( index: number ) => {
		set( ( state ) => {
			const newContent = [ ...state.wizard.content ];
			if ( newContent[index]) {
				const currentValue = newContent[index].date_range_enabled ?? false;
				newContent[index] = {
					...newContent[index],
					date_range_enabled: ! currentValue
				};
			}

			return {
				wizard: {
					...state.wizard,
					content: newContent
				}
			};
		});
	},
	setIsEditingMode: ( v: boolean ) => set( ( state ) => ({ ...state, isEditingMode: v }) ),

	// Step logic.
	setCurrentStep: ( step: number ) =>
		set( ( state ) => {
			const isEditContentStep = 2 === step;
			return {
				wizard: { ...state.wizard, currentStep: step },
				isEditingMode: isEditContentStep,
				selectedBlockIndex: isEditContentStep ? state.selectedBlockIndex : null
			};
		}),

	nextStep: () =>
		set( ( state ) => {
			const max = useReportConfigStore.getState().stepCount;
			if ( state.wizard.currentStep < max ) {
				const nextStep = state.wizard.currentStep + 1;
				const isEditContentStep = 2 === nextStep;
				return {
					wizard: { ...state.wizard, currentStep: nextStep },
					isEditingMode: isEditContentStep,
					selectedBlockIndex: isEditContentStep ? state.selectedBlockIndex : null
				};
			}
			return {};
		}),

	prevStep: () =>
		set( ( state ) => {
			if ( 1 < state.wizard.currentStep ) {
				const prevStep = state.wizard.currentStep - 1;
				const isEditContentStep = 2 === prevStep;
				return {
					wizard: { ...state.wizard, currentStep: prevStep },
					isEditingMode: isEditContentStep,
					selectedBlockIndex: isEditContentStep ? state.selectedBlockIndex : null
				};
			}
			return {};
		}),

	setReportName: ( name: string ) =>
		set( ( state ) => ({ wizard: { ...state.wizard, name: name } }) ),
	setFormat: ( format: string ) =>
		set( ( state ) => {
			const newFormat = format as WizardState['format'];

			if ( state.wizard.format !== newFormat ) {
				return {
					wizard: {
						...state.wizard,
						format: newFormat,
						content: [ ...DEFAULT_CONTENT[ newFormat ] ] as ContentBlock[]
					}
				};
			}

			return { wizard: { ...state.wizard, format: newFormat } };
		}),

	setRecipients: ( recipients: string[]) =>
		set( ( state ) => ({ wizard: { ...state.wizard, recipients } }) ),

	setScheduled: ( scheduled: boolean ) =>
		set( ( state ) => ({ wizard: { ...state.wizard, scheduled } }) ),

	setFrequency: ( frequency: FrequencyType ) =>
		set( ( state ) => ({ wizard: { ...state.wizard, frequency } }) ),

	setDayOfWeek: ( d ) =>
		set( ( state ) => ({ wizard: { ...state.wizard, dayOfWeek: d } }) ),

	setWeekOfMonth: ( rule ) =>
		set( ( state ) => ({
			wizard: { ...state.wizard, weekOfMonth: rule }
		}) ),

	setSendTime: ( t: string ) =>
		set( ( state ) => ({ wizard: { ...state.wizard, sendTime: t } }) ),

	addContent: ( blockId: ContentBlockId ) =>
		set( ( state ) => {
			const newContent: ContentBlock = {
				fixed_end_date: '',
				date_range_enabled: false,
				id: blockId,
				filters: {},
				date_range: '',
				content: '',
				comment_title: '',
				comment_text: ''
			};

			return {
				wizard: {
					...state.wizard,
					content: [ ...state.wizard.content, newContent ]
				}
			};
		}),
	updateComment: ( index: number, text: string ) =>
		set( ( state ) => {
			const newContent = [ ...state.wizard.content ];
			if ( newContent[index]) {
				newContent[index] = {
					...newContent[index],
					content: text
				};
			}

			return {
				wizard: {
					...state.wizard,
					content: newContent
				}
			};
		}),
	getFilters: ( index: number ) => {
		return get().wizard.content[index]?.filters ?? {};
	},
	updateFilters: ( index, filters ) => {
		set( ( state ) => {
			const newContent = [ ...state.wizard.content ];
			if ( newContent[index]) {
				newContent[index] = {
					...newContent[index],
					filters: filters
				};
			}

			return {
				wizard: {
					...state.wizard,
					content: newContent
				}
			};
		});
	},
	getBlockDateRange: ( index: number ) => {
		return get().wizard.content[index]?.date_range ?? '';
	},
	updateCommentTitle: ( index: number, title: string ) =>
		set( ( state ) => {
			const newContent = [ ...state.wizard.content ];
			if ( newContent[index]) {
				newContent[index] = {
					...newContent[index],
					comment_title: title
				};
			}

			return {
				wizard: {
					...state.wizard,
					content: newContent
				}
			};
		}),
	updateCommentText: ( index: number, text: string ) =>
		set( ( state ) => {
			const newContent = [ ...state.wizard.content ];
			if ( newContent[index]) {
				newContent[index] = {
					...newContent[index],
					comment_text: text
				};
			}

			return {
				wizard: {
					...state.wizard,
					content: newContent
				}
			};
		}),
	getCommentTitle: ( index: number ) => {
		return get().wizard.content[index]?.comment_title ?? '';
	},
	getCommentText: ( index: number ) => {
		return get().wizard.content[index]?.comment_text ?? '';
	},

	/**
	 * When scheduled, calculate the end date based on the frequency. If the report is set to send on mondays, weekly, get previous sunday as endDate.
	 * When not scheduled, use the fixedEndDate, which is based on the day before the report was created. This ensures consistent data for viewers.
	 * @param index
	 */
	getEndDate: ( index: number ) => {
		const scheduled = get().wizard.scheduled;

		// If not scheduled, use fixed end date
		if ( ! scheduled ) {
			return get().getFixedEndDate( index );
		}

		// If scheduled, calculate based on frequency
		const frequency = get().wizard.frequency;
		const now = new Date();
		now.setHours( 0, 0, 0, 0 );

		if ( 'weekly' === frequency ) {
			const dayOfWeek = get().wizard.dayOfWeek;
			if ( ! dayOfWeek ) {
				return format( now, 'yyyy-MM-dd' );
			}

			// Find the most recent occurrence of dayOfWeek (including today)
			const lastOccurrence = findLastWeekdayOccurrence( dayOfWeek, now );

			// Return the day before that
			const dayBefore = new Date( lastOccurrence );
			dayBefore.setDate( dayBefore.getDate() - 1 );
			return format( dayBefore, 'yyyy-MM-dd' );
		}

		if ( 'monthly' === frequency ) {
			const dayOfWeek = get().wizard.dayOfWeek;
			const weekOfMonth = get().wizard.weekOfMonth;
			if ( ! dayOfWeek || null === weekOfMonth ) {
				return format( now, 'yyyy-MM-dd' );
			}

			// Find the most recent occurrence of the nth dayOfWeek (including today)
			const lastOccurrence = findLastMonthlyOccurrence( dayOfWeek, weekOfMonth as WeekOfMonthType, now );

			// Return the day before that
			const dayBefore = new Date( lastOccurrence );
			dayBefore.setDate( dayBefore.getDate() - 1 );
			return format( dayBefore, 'yyyy-MM-dd' );
		}

		// When daily, or no match, return yesterday
		const yesterday = new Date( now );
		yesterday.setDate( yesterday.getDate() - 1 );
		return format( yesterday, 'yyyy-MM-dd' );

	},

	/**
	 * StartDate is always based on the endDate, and range subtracted.
	 * @param index
	 */
	getStartDate: ( index:number ) => {
		const fixedEndDate = get().getFixedEndDate( index );
		const dateRange = get().getDateRange( index );

		// Validate fixedEndDate first
		if ( ! fixedEndDate || '' === fixedEndDate ) {

			// Fallback to yesterday if no fixed end date is set
			const yesterday = new Date();
			yesterday.setDate( yesterday.getDate() - 1 );
			return format( yesterday, 'yyyy-MM-dd' );
		}

		// If it's a custom range, extract the startDate directly
		// Use getDateRangeDate for custom ranges (returns the extracted startDate)
		if ( dateRange.startsWith( 'custom:' ) ) {
			return get().getDateRangeDate( index, 'start' );
		}

		// For predefined ranges, calculate the offset from availableRanges
		if ( dateRange in availableRanges ) {
			const { startDate, endDate } = availableRanges[dateRange as keyof typeof availableRanges].range();
			const daysDiff = Math.floor( ( endDate.getTime() - startDate.getTime() ) / ( 1000 * 60 * 60 * 24 ) );
			const fixedEndDateObj = new Date( fixedEndDate );
			fixedEndDateObj.setDate( fixedEndDateObj.getDate() - daysDiff );
			return format( fixedEndDateObj, 'yyyy-MM-dd' );
		}

		// Fallback: return fixedEndDate
		return fixedEndDate;
	},
	getParsedDateRangeValue: ( dateRange:string ) => {

		// Parse reportDateRange for DateRangePicker value.
		const currentRange = dateRange || 'last-7-days';

		// Check if it's a custom range encoded as 'custom:startDate:endDate'.
		if ( currentRange.startsWith( 'custom:' ) ) {
			const parts = currentRange.split( ':' );
			if ( 3 === parts.length ) {
				return {
					range: 'custom',
					startDate: parts[1],
					endDate: parts[2]
				};
			}
		}

		// For predefined ranges, calculate the dates.
		if ( currentRange in availableRanges ) {
			const {startDate, endDate} = availableRanges[currentRange as keyof typeof availableRanges].range();
			return {
				range: currentRange,
				startDate: format( startDate, 'yyyy-MM-dd' ),
				endDate: format( endDate, 'yyyy-MM-dd' )
			};
		}

		// Fallback to last-7-days.
		const {startDate, endDate} = availableRanges['last-7-days'].range();
		return {
			range: 'last-7-days',
			startDate: format( startDate, 'yyyy-MM-dd' ),
			endDate: format( endDate, 'yyyy-MM-dd' )
		};
	},
	getDateRange: ( index: number ) => {
		const { wizard } = get();
		const { scheduled, frequency, reportDateRange, content } = wizard;
		let effectiveReportDateRange = reportDateRange || 'last-7-days';
		if ( scheduled ) {
			const dateRangeMap = {
				'daily': 'yesterday',
				'weekly': 'last-7-days',
				'monthly': 'last-month'
			};
			effectiveReportDateRange = dateRangeMap[frequency] || 'last-7-days';
		}

		const block = content[index];
		const blockDateRangeEnabled = block?.date_range_enabled ?? false;
		const blockDateRange = block?.date_range || '';

		// Use blockDateRange only if enabled AND index >= 0, otherwise use reportDateRange
		return ( blockDateRangeEnabled && 0 <= index ) ? blockDateRange : effectiveReportDateRange;
	},
	getDateRangeDate: ( index: number, type: 'start' | 'end' ) => {
		const dateRange = get().getDateRange( index );
		return get().parseDateRange( dateRange, type );
	},
	parseDateRange: ( dateRange: string, type: 'start' | 'end' ) => {

		// Use availableRanges if the range exists
		if ( dateRange in availableRanges ) {
			const { startDate, endDate } = availableRanges[dateRange as keyof typeof availableRanges].range();
			const selectedDate = 'start' === type ? startDate : endDate;
			return format( selectedDate, 'yyyy-MM-dd' );
		}

		// Check for custom range 'custom:startDate:endDate'
		if ( dateRange.startsWith( 'custom:' ) ) {
			const parts = dateRange.split( ':' );
			if ( 3 === parts.length ) {
				return 'start' === type ? parts[1] : parts[2];
			}
		}

		// Fallback to yesterday
		const yesterday = new Date();
		yesterday.setDate( yesterday.getDate() - 1 );
		return format( yesterday, 'yyyy-MM-dd' );
	},
	getComment: ( index: number ) => {
		return get().wizard.content[index]?.content ?? '';
	},
	removeContent: ( index: number ) =>
		set( ( state ) => {
			const newContent = state.wizard.content.filter( ( _, i ) => i !== index );
			let newSelectedIndex = state.selectedBlockIndex;

			// Update selection when a block is removed.
			if ( null !== state.selectedBlockIndex ) {
				if ( index === state.selectedBlockIndex ) {

					// Removed the selected block - select previous or clear if empty.
					if ( 0 === newContent.length ) {
						newSelectedIndex = null;
					} else if ( state.selectedBlockIndex >= newContent.length ) {
						newSelectedIndex = newContent.length - 1;
					}
				} else if ( index < state.selectedBlockIndex ) {

					// Removed a block before the selected one - adjust index.
					newSelectedIndex = state.selectedBlockIndex - 1;
				}
			}

			return {
				wizard: {
					...state.wizard,
					content: newContent
				},
				selectedBlockIndex: newSelectedIndex
			};
		}),
	moveContentUp: ( index: number ) =>
		set( ( state ) => {
			const content = state.wizard.content;
			const length = content.length;

			if ( 1 >= length ) {
				return state;
			}

			const newContent = [ ...content ];
			let newSelectedIndex = state.selectedBlockIndex;

			if ( 0 === index ) {

				// Move first item to the end.
				const [ first ] = newContent.splice( 0, 1 );
				newContent.push( first );

				// Update selection to follow the moved block.
				if ( 0 === state.selectedBlockIndex ) {
					newSelectedIndex = length - 1;
				} else if ( null !== state.selectedBlockIndex ) {
					newSelectedIndex = state.selectedBlockIndex - 1;
				}
			} else {

				// Swap with previous.
				[ newContent[index - 1], newContent[index] ] =
					[ newContent[index], newContent[index - 1] ];

				// Update selection to follow the moved block.
				if ( index === state.selectedBlockIndex ) {
					newSelectedIndex = index - 1;
				} else if ( index - 1 === state.selectedBlockIndex ) {
					newSelectedIndex = index;
				}
			}

			return {
				wizard: {
					...state.wizard,
					content: newContent
				},
				selectedBlockIndex: newSelectedIndex
			};
		}),

	moveContentDown: ( index: number ) =>
		set( ( state ) => {
			const content = state.wizard.content;
			const length = content.length;

			if ( 1 >= length ) {
				return state;
			}

			const newContent = [ ...content ];
			let newSelectedIndex = state.selectedBlockIndex;

			if ( index === length - 1 ) {

				// Move last item to the start.
				const [ last ] = newContent.splice( length - 1, 1 );
				newContent.unshift( last );

				// Update selection to follow the moved block.
				if ( length - 1 === state.selectedBlockIndex ) {
					newSelectedIndex = 0;
				} else if ( null !== state.selectedBlockIndex ) {
					newSelectedIndex = state.selectedBlockIndex + 1;
				}
			} else {

				// Swap with next.
				[ newContent[index + 1], newContent[index] ] =
					[ newContent[index], newContent[index + 1] ];

				// Update selection to follow the moved block.
				if ( index === state.selectedBlockIndex ) {
					newSelectedIndex = index + 1;
				} else if ( index + 1 === state.selectedBlockIndex ) {
					newSelectedIndex = index;
				}
			}

			return {
				wizard: {
					...state.wizard,
					content: newContent
				},
				selectedBlockIndex: newSelectedIndex
			};
		}),

	reorderContent: ( newOrder: ContentBlock[]) =>
		set( ( state ) => {

			// Find the new index of the selected block after reordering.
			let newSelectedIndex = state.selectedBlockIndex;
			if ( null !== state.selectedBlockIndex ) {
				const selectedBlock = state.wizard.content[state.selectedBlockIndex];
				if ( selectedBlock ) {
					const newIndex = newOrder.findIndex( ( block ) => block === selectedBlock );
					newSelectedIndex = -1 !== newIndex ? newIndex : null;
				}
			}

			return {
				wizard: {
					...state.wizard,
					content: newOrder
				},
				selectedBlockIndex: newSelectedIndex
			};
		}),

	resetWizard: () =>
		set({
			wizard: {
				...INITIAL_WIZARD_STATE
			},
			selectedBlockIndex: null
		})
}) );
