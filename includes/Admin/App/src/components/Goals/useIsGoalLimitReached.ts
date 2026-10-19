import useGoalsData from '@/hooks/useGoalsData';
import useLicenseData from '@/hooks/useLicenseData';

/**
 * Whether no more goals can be activated on this site.
 *
 * The limit only applies without a valid license; the active count comes
 * from the server, which enforces the same limit on save.
 *
 * @return {boolean} True when the free active goal limit is reached.
 */
const useIsGoalLimitReached = (): boolean => {
	const { activeGoalsCount, goalLimit } = useGoalsData();
	const { isLicenseValid } = useLicenseData();

	return ! isLicenseValid && 0 < goalLimit && goalLimit <= activeGoalsCount;
};

export default useIsGoalLimitReached;
