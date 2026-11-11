interface GoalsResponse {
	goals?: unknown[];
	success?: boolean;
	message?: string;
}

/**
 * Reject a goals response that reports a failure. The endpoint answers an expired
 * nonce or lost access with HTTP 200 and success: false, which must not read as
 * a site without goals.
 *
 * @param {T} response The goals/get response.
 * @return {T} The same response.
 * @throws {Error} When the response reports a failure.
 */
export const assertGoalsResponse = <T extends GoalsResponse>( response: T ): T => {
	if ( false === response.success ) {
		throw new Error( response.message );
	}

	return response;
};
