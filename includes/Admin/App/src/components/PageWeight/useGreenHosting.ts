import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkGreenHosting } from '@/utils/api';

type UseGreenHostingReturn = {

	/** Runs a green hosting check for this site's own domain. */
	check: () => void;

	/** Whether a request is in flight. */
	isPending: boolean;

	/** Message to show when the last request failed, empty otherwise. */
	error: string;
};

/**
 * Runs the green hosting check behind the Page weight block.
 *
 * The check changes the server-side estimate, so a success invalidates the
 * block's query rather than patching the cached payload.
 *
 * @return {UseGreenHostingReturn} The action and its request state.
 */
export function useGreenHosting(): UseGreenHostingReturn {
	const [ error, setError ] = useState( '' );
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: () => checkGreenHosting(),
		onSuccess: () => {
			setError( '' );
			queryClient.invalidateQueries({ queryKey: [ 'page_weight' ] });
		},
		onError: ( error: Error ) => {
			setError( error.message || __( 'Could not reach the Green Web Foundation. Try again later.', 'burst-statistics' ) );
		}
	});

	return {
		check: () => mutation.mutate(),
		isPending: mutation.isPending,
		error
	};
}
