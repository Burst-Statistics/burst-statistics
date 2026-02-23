import React from 'react';
import {FilterSearchParams} from '@/config/filterConfig';

export type ReportFormatKey = 'classic' | 'story';
export type FrequencyType = 'daily' | 'weekly' | 'monthly';

export type WeekOfMonthType =
	| 1
	| 2
	| 3
	| -1;

export type DayOfWeekType =
	| 'monday'
	| 'tuesday'
	| 'wednesday'
	| 'thursday'
	| 'friday'
	| 'saturday'
	| 'sunday';

export type ContentBlockId =
	| 'logo'
	| 'insights'
	| 'compare'
	| 'compare_story'
	| 'most_visited_pages'
	| 'top_referrers'
	| 'top_campaigns'
	| 'countries'
	| 'devices'
	| 'pages'
	| 'parameters'
	| 'world'
	| 'locations'
	| 'campaigns'
	| 'sales'
	| 'funnel'
	| 'top_performers'
	| 'referrers';

export type ContentBlock = {
	fixed_end_date: string;
	date_range_enabled: boolean;
	id: ContentBlockId;
	filters: FilterSearchParams;
	content: string;
	date_range: string;
	comment_title?: string;
	comment_text?: string;
};

export type ReportLogStatus =
	| 'sending_successful'
	| 'sending_failed'
	| 'email_domain_error'
	| 'email_address_error'
	| 'cron_miss'
	| 'concept'
	| 'scheduled'
	| 'processing'
	| 'partly_sent'
	| 'ready_to_send';

export type ReportLogSeverity =
	| 'success'
	| 'warning'
	| 'error'
	| 'info';

export interface ReportLogBatch {
	batch_id: number;
	status: ReportLogStatus;
	message: string;
	time: number;
}

export interface ReportLogEntry {
	report_id: number;
	report_name: string;
	queue_id: string;
	status: ReportLogStatus;
	message: string;
	time: number;
	batches: ReportLogBatch[];
}

export type ReportLogsResponse = ReportLogEntry[];
export type ContentItem = {
	id: ContentBlockId;
	label: string;
	pro: boolean;
	icon?: string;
	component?: React.ComponentType<BlockComponentProps>;
	blockProps?: Partial<BlockComponentProps>;
	ecommerce?: boolean;
	isReport?: boolean;
};

export type ContentItems = ContentItem[];

export interface BlockComponentProps {
	isStory?: boolean;
	customFilters?: FilterSearchParams | never[];
	reportBlockIndex?: number;
	isReport?: boolean;

	// DataTableBlock specific props
	allowedConfigs?: string[];
	id?: string;
	isEcommerce?: boolean;
	startDate?:string;
	endDate?:string;
	range?:string;
	allowBlockFilters?: boolean;
}

export interface ReportFormat {
	key: ReportFormatKey;
	label: string;
	disabled?: boolean;
	pro: boolean;
}

export interface WizardStep {
	number: number;
	label: string;
	fields: string[];
}

export interface Report {
	id: number;
	name: string;
	format: ReportFormatKey;
	enabled: boolean;
	lastEdit: number;
	content: ContentBlock[];
	recipients: string[];
	scheduled: boolean;
	frequency: FrequencyType;
	dayOfWeek?: DayOfWeekType;
	weekOfMonth?: WeekOfMonthType;
	sendTime: string;
	lastSendStatus: ReportLogStatus;
	lastSendMessage: string;
	fixedEndDate?: string;
	reportDateRange?: string;
}

export interface WizardState
	extends Omit<
		Report,
		'id' | 'enabled' | 'lastEdit' | 'lastSendStatus' | 'lastSendMessage'
	> {
	id: number | null;
	currentStep: number;
	reportDateRange?: string;
}
