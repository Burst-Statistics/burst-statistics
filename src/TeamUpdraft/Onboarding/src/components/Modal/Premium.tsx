import type { FC } from '@wordpress/element';
import { useEffect, memo, useMemo } from "@wordpress/element";
import useOnboardingStore from "../../store/useOnboardingStore";
// @ts-ignore
import Icon from '@/utils/Icon';
import {__} from "@wordpress/i18n";
const Premium: FC<{ bullets: string[], stepId: string }> = memo(({ bullets, stepId }: { bullets: string[], stepId: string }) => {
    const {
        onboardingData,
        isLastStep
    } = useOnboardingStore();
    if (!bullets || !isLastStep() ) return null;

    return (
        <>
            <p className="text-gray-600 text-lg leading-relaxed font-light text-center">
                { !!onboardingData.is_pro && __("The below features have automatically been enabled for you as a Pro user!", "burst-statistics")}
                { !onboardingData.is_pro && __("Get the most out of Burst Statistics with our Premium features:", "burst-statistics")}
            </p>
            <div className="space-y-2 mx-auto flex flex-col ">
                {bullets.map((bullet: string, index: number) => (
                    <div key={`${stepId}-bullet-${index}`} className="flex items-center  gap-2 ml-2">
                    <span className="flex-shrink-0 ">
                        <Icon name="check" color="green" size="25"/>
                    </span>
                        <p className="text-gray-700 text-md font-normal leading-relaxed">{bullet}</p>
                    </div>
                ))}
            </div>
        </>
        );
    });
export default Premium;