import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLocalStorage, setLocalStorage } from '@/utils/api';
import { __ } from "@wordpress/i18n";

import Icon from '../../utils/Icon';
import {burst_get_website_url} from "@/utils/lib";
interface TrialPopupProps {
    type?: string;
}

const TrialPopup: React.FC<TrialPopupProps> = ({ type = "sources" }) => {
    const [isVisible, setIsVisible] = useState<boolean>(false);

    useEffect(() => {
        const isDismissed = getLocalStorage('trial_popup_'+type+'dismissed', false) as boolean;
        if (!isDismissed) {
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 1000);
            
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = (): void => {
        setIsVisible(false);
        setLocalStorage( 'trial_popup_'+type+'dismissed', true);
    };

    let title = '';
    let description = '';
    if ( type === 'sources' ) {
        title = __("You're exploring the Sources dashboard", "burst-statistics");
        description = __("A key feature of our all premium plans.", "burst-statistics");
    }  else if ( type === 'reporting' ) {
        title = __("You're exploring the Reporting dashboard", "burst-statistics");
        description = __("A key feature of our Agency plan.", "burst-statistics");
    } else {
        title = __("You're exploring the Sales dashboard", "burst-statistics");
        description = __("A key feature of our Business and Agency plans.", "burst-statistics");
    }

    const url =   burst_get_website_url( 'pricing/#pricing', {
        utm_source: 'trial-popup',
        utm_content: type,
    });

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, x: 400, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 0, y: 200, scale: 0.98 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30,
                            mass: 0.8
                        }}
                        className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-[400px]"
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className="inline-flex rounded-full bg-green-light border border-gray-100 transition-colors p-1">
                                <Icon color="green" name="sprout" size={14} strokeWidth={2}/>
                            </div>

                            <div className="flex-1">
                                <h5 className="font-semibold text-gray-900 mb-1">
                                    {title}
                                </h5>
                                <p className="text-sm text-gray-600 mb-2">
                                    {description+' '+__("Enjoy full access for the remainder of your trial.", "burst-statistics")}
                                </p>

                                <a href={url}
                                   target="_blank"
                                   className="text-sm text-blue-600 hover:text-blue-800 underline"
                                >
                                    {__("Compare all plans", "burst-statistics")}
                                </a>
                            </div>

                            <button
                                onClick={handleDismiss}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                                aria-label="Dismiss"
                            >
                                <div
                                    className="inline-flex">
                                    <Icon color='black' name="times" size={14} strokeWidth={2}/>
                                </div>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TrialPopup;