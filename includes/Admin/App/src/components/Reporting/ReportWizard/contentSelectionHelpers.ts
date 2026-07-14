import { useEffect, useRef } from 'react';
import { __ } from '@wordpress/i18n';
import { useFormContext } from 'react-hook-form';
import { ContentBlock } from '@/store/reports/types';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';
import { useWizardStore } from '@/store/reports/useWizardStore';

export const useReportWizardSelectionData = () => {
	const availableContent = useReportConfigStore( ( state ) => state.availableContent );
	const content = useWizardStore( ( state ) => state.wizard.content );
	const addContent = useWizardStore( ( state ) => state.addContent );
	const removeContent = useWizardStore( ( state ) => state.removeContent );
	const shouldLoadEcommerce = window.burst_settings?.shouldLoadEcommerce || false;

	return {
		availableContent,
		content,
		addContent,
		removeContent,
		shouldLoadEcommerce
	};
};

export const useContentSelectionFormSync = ( content: ContentBlock[]) => {
	const isFirstRender = useRef( true );
	const {
		register,
		setValue,
		formState: { errors }
	} = useFormContext();

	useEffect( () => {
		register( 'content', {
			value: content,
			validate: ( value: string[]) =>
				0 < value.length ||
				__( 'Please select at least one content item', 'burst-statistics' )
		});
	}, [ register, content ]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect( () => {
		if ( isFirstRender.current ) {
			isFirstRender.current = false;
			return;
		}

		setValue( 'content', content, {
			shouldValidate: !! errors.content
		});
	}, [ content, setValue ]); // eslint-disable-line react-hooks/exhaustive-deps

	return { errors };
};

type SelectableContentBlock = {
	ecommerce?: boolean;
	component?: unknown;
};

export const getSelectableContentBlocks = <T extends SelectableContentBlock>(
	availableContent: T[],
	shouldLoadEcommerce: boolean,
	matchComponent: boolean
) => {
	return availableContent
		.filter( ( block ) => ! block.ecommerce || shouldLoadEcommerce )
		.filter( ( block ) => !! block.component === matchComponent );
};
