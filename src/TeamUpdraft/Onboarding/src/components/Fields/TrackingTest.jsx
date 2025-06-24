import { __ } from '@wordpress/i18n';
import {handleRequest} from '@/utils/api.js';
import {glue} from '@/utils/glue';
import {useEffect} from "@wordpress/element";
import useOnboardingStore from "@/store/useOnboardingStore";
import {useState, useRef} from "react";
import Icon from "@/utils/Icon";
import {getNonce} from "@/utils/getNonce";
import Support from "@/components/Support.js";

const getLiveVisitors = async(nonce) => {
    const url = 'burst/v1/data/live-visitors';
    const path = url + glue(url) + getNonce(nonce);
    const method = 'GET';

    let args = {
        path,
        method,
        data: {
            isOnboarding: true, // Indicate this is an onboarding request
        },
    };
    let response = await handleRequest( args );
    return response.data;
};

const ConnectionAnimation = ({ isRunning, isSuccess, testCompleted, isFailed, retryCount, isPro, handleManualRetry }) => {
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
    const [showCheckmark, setShowCheckmark] = useState(false);
    const [showFailureAnimation, setShowFailureAnimation] = useState(false);
    const [showXMark, setShowXMark] = useState(false);

    useEffect(() => {
        if (isRunning) {
            // Reset all animation states when test starts running
            setShowSuccessAnimation(false);
            setShowCheckmark(false);
            setShowFailureAnimation(false);
            setShowXMark(false);
        } else if (testCompleted && isSuccess && !showSuccessAnimation) {
            // Start success animation after a brief delay
            setTimeout(() => {
                setShowSuccessAnimation(true);
                // Show checkmark after icons reach center
                setTimeout(() => {
                    setShowCheckmark(true);
                }, 500);
            }, 500);
        } else if (testCompleted && isFailed && !showFailureAnimation) {
            // Start failure animation after a brief delay
            setTimeout(() => {
                setShowFailureAnimation(true);
                // Show X mark after icons reach center
                setTimeout(() => {
                    setShowXMark(true);
                }, 500);
            }, 500);
        }
    }, [isRunning, testCompleted, isSuccess, isFailed, showSuccessAnimation, showFailureAnimation]);

    const getIconClasses = (baseClasses, position) => {
        let classes = baseClasses;
        
        if (showSuccessAnimation || showFailureAnimation) {
            classes += position === 'left' ? ' transform translate-x-24' : ' transform -translate-x-24';
            classes += ' opacity-0 transition-all duration-500 ease-in-out';
        } else {
            classes += ' transition-all duration-500 ease-in-out';
        }
        
        if (testCompleted && isSuccess && !showSuccessAnimation) return `${classes} bg-green-light border-green`;
        if (testCompleted && isFailed) return `${classes} bg-red-light border-red`;
        if (isRunning) {
            if (position === 'left') return `${classes} bg-blue-light border-blue`;
            if (position === 'right') {
                if (retryCount === 0) return `${classes} bg-blue-light border-blue`;
                if (retryCount === 1) return `${classes} bg-yellow-light border-yellow`;
                if (retryCount === 2) return `${classes} bg-orange-light border-orange`;
            }
        }
        return `${classes} bg-gray-100 border-gray-300`;
    };

    const getIconColor = (position) => {
        if (testCompleted && isSuccess) return '#2B8133';
        if (testCompleted && isFailed) return '#c6273b';
        if (isRunning) {
            if (position === 'left') return '#1D3C8F'; // Left icon always blue
            if (position === 'right') {
                if (retryCount === 0) return '#1D3C8F'; // blue
                if (retryCount === 1) return '#D97706'; // yellow
                if (retryCount === 2) return '#EA580C'; // orange
            }
        }
        return '#6c757d';
    };

    const getDotColor = () => {
        if (testCompleted && isSuccess) return 'bg-green';
        if (testCompleted && isFailed) return 'bg-red';
        if (isRunning) {
            if (retryCount === 0) return 'bg-blue';
            if (retryCount === 1) return 'bg-yellow';
            if (retryCount === 2) return 'bg-orange';
        }
        return 'bg-blue';
    };

    return (
        <>
            <style>{`
                @keyframes flowDots {
                    0% {
                        left: -6px;
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                    }
                    90% {
                        opacity: 1;
                    }
                    100% {
                        left: calc(100% + 6px);
                        opacity: 0;
                    }
                }
                
                @keyframes checkmarkAppear {
                    0% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0);
                    }
                    50% {
                        transform: translate(-50%, -50%) scale(1.2);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }
                
                @keyframes xMarkAppear {
                    0% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0) rotate(0deg);
                    }
                    50% {
                        transform: translate(-50%, -50%) scale(1.2) rotate(90deg);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1) rotate(0deg);
                    }
                }
                
                .burst-connection-dot {
                    animation: ${isRunning && !showSuccessAnimation && !showFailureAnimation ? 'flowDots 2s infinite ease-in-out' : 'none'};
                }
                
                .burst-connection-dot:nth-child(1) { animation-delay: 0s; }
                .burst-connection-dot:nth-child(2) { animation-delay: 0.4s; }
                .burst-connection-dot:nth-child(3) { animation-delay: 0.8s; }
                .burst-connection-dot:nth-child(4) { animation-delay: 1.2s; }
                .burst-connection-dot:nth-child(5) { animation-delay: 1.6s; }
                
                .burst-checkmark {
                    animation: checkmarkAppear 0.6s ease-out forwards;
                }
                
                .burst-xmark {
                    animation: xMarkAppear 0.6s ease-out forwards;
                }
            `}</style>
            
            <div className="flex items-center justify-center py-5 gap-5 relative">
                {/* Left Icon */}
                <div className={getIconClasses("flex items-center justify-center w-10 h-10 rounded-full border-2", "left")}>
                    <Icon name="visitors" size="20" color={getIconColor('left')} />
                </div>
                
                {/* Connection Flow */}
                <div className={`relative w-48 h-1 bg-gray-200 rounded-sm overflow-hidden transition-opacity duration-500 ${showSuccessAnimation || showFailureAnimation ? 'opacity-0' : 'opacity-100'}`}>
                    {/* Background line */}
                    <div 
                        className={`absolute inset-0 bg-gradient-to-r from-transparent to-transparent transition-all duration-500 ease-in-out ${isRunning && !showSuccessAnimation && !showFailureAnimation ? 'opacity-100' : 'opacity-30'} ${
                            isRunning ? (
                                retryCount === 0 ? 'via-blue' :
                                retryCount === 1 ? 'via-yellow' :
                                retryCount === 2 ? 'via-orange' : 'via-blue'
                            ) : 'via-blue'
                        }`}
                    />
                    
                    {/* Animated dots */}
                    <div className="absolute inset-0">
                        {[...Array(5)].map((_, index) => (
                            <div
                                key={index}
                                className={`burst-connection-dot absolute w-1.5 h-1.5 rounded-full top-1/2 transform -translate-y-1/2 opacity-0 ${getDotColor()}`}
                            />
                        ))}
                    </div>
                </div>
                
                {/* Right Icon */}
                <div className={getIconClasses("flex items-center justify-center w-10 h-10 rounded-full border-2", "right")}>
                    <Icon name="website" size="20" color={getIconColor('right')} />
                </div>
                
                {/* Success Checkmark */}
                {showCheckmark && (
                    <div className="absolute top-1/2 left-1/2 transform">
                        <div className="burst-checkmark flex items-center justify-center w-12 h-12 rounded-full bg-green border-2 border-green">
                            <Icon name="check" size="24" color="white" strokeWidth={3} />
                        </div>
                    </div>
                )}
                
                {/* Failure X Mark */}
                {showXMark && (
                    <div className="absolute top-1/2 left-1/2 transform">
                        <div className="burst-xmark flex items-center justify-center w-12 h-12 rounded-full bg-red border-2 border-red">
                            <Icon name="times" size="24" color="white" strokeWidth={3} />
                        </div>
                    </div>
                )}

            </div>
            {/* display grid all items in same row and center */}
            <div className="grid">
                <p className={`row-start-1 row-end-2 col-start-1 col-end-2 mt-2 text-center text-gray font-semibold text-lg opacity-0 transition-opacity duration-500 ${isRunning ? 'opacity-100' : 'opacity-0'}`}>
                    {isRunning && retryCount === 0 && __("Running test, please wait...", "burst-statistics")}
                    {isRunning && retryCount === 1 && __("Hmm, let's try that again...", "burst-statistics")}
                    {isRunning && retryCount === 2 && __("One more attempt, hang tight...", "burst-statistics")}
                </p>                
                <p className={`row-start-1 row-end-2 col-start-1 col-end-2 mt-2 text-center text-gray font-semibold text-lg opacity-0 transition-opacity duration-500 ${isFailed ? 'opacity-100' : 'opacity-0'}`}>
                    {__("Unfortunately, Burst could not detect the test visit.", "burst-statistics")}
                </p>
                <p className={`row-start-1 row-end-2 col-start-1 col-end-2 mt-2 text-center text-gray font-semibold text-lg opacity-0 transition-opacity duration-500 ${isSuccess ? 'opacity-100' : 'opacity-0'}`}>
                    {__("Successfully detected a visit on your site!", "burst-statistics")}
                </p>
            </div>

            {/* if failed, show list with four steps to troubleshoot, last step should be support. Second to last should be link to troubleshooting article */}
            {isFailed && (
                <Support handleManualRetry={handleManualRetry} isRunning={isRunning}/>
            )}
        </>
    );
}

const TrackingTest = () => {
    const {
        onboardingData,
        setTrackingTestRunning,
        setTrackingTestCompleted,
        setTrackingTestSuccess,
    } = useOnboardingStore();
    
    const [visitors, setVisitors] = useState(0);
    const [testState, setTestState] = useState('idle'); // 'idle', 'running', 'completed'
    const retryCountRef = useRef(0);
    const maxRetries = 2;
    const isPro = onboardingData.is_pro;

    const runTrackingTest = async () => {
        const startTime = Date.now();
        const minDuration = 3000; // 3 seconds minimum
        
        setTestState('running');
        setTrackingTestRunning(true);
        setTrackingTestCompleted(false);
        setTrackingTestSuccess(false);

        try {
            // Create and load test iframe
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            // Wait for both test pages to load
            await new Promise((resolve) => {
                let stage = 0;
                
                const handleLoad = () => {
                    if (stage === 0) {
                        // Load second page
                        iframe.src = onboardingData.site_url + '/404' + glue(onboardingData.site_url) + 'burst_test_hit&burst_nextpage';
                        stage = 1;
                    } else {
                        // Both stages complete
                        iframe.removeEventListener('load', handleLoad);
                        document.body.removeChild(iframe);
                        resolve();
                    }
                };
                
                iframe.addEventListener('load', handleLoad);
                iframe.src = onboardingData.site_url + glue(onboardingData.site_url) + 'burst_test_hit';
            });

            // Check if tracking worked
            const response = await getLiveVisitors(onboardingData.nonce);
            const success = response > 0;
            
            // Calculate elapsed time and ensure minimum duration
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, minDuration - elapsedTime);
            
            // If test completed too quickly, wait for remaining time
            if (remainingTime > 0) {
                await new Promise(resolve => setTimeout(resolve, remainingTime));
            }
            
            // Now set the final results
            setVisitors(response);
            setTrackingTestSuccess(success);
            
            if (!success && retryCountRef.current < maxRetries) {
                // Retry after delay - don't call finally block for retries
                retryCountRef.current++;
                setTimeout(() => runTrackingTest(), 3000);
                return; // Exit without calling finally
            }
            
            // Test completed (success or max retries reached)
            setTestState('completed');
            setTrackingTestCompleted(true);
            setTrackingTestRunning(false);
            
        } catch (error) {
            console.error('Tracking test error:', error);
            
            // Still ensure minimum duration even on error
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, minDuration - elapsedTime);
            
            if (remainingTime > 0) {
                await new Promise(resolve => setTimeout(resolve, remainingTime));
            }
            
            setTestState('completed');
            setTrackingTestCompleted(true);
            setTrackingTestSuccess(false);
            setTrackingTestRunning(false);
        }
    };

    const handleManualRetry = () => {
        retryCountRef.current = 0; // Reset retry counter for manual retry
        runTrackingTest();
    };

    useEffect(() => {
        runTrackingTest();
    }, []); // Only run once on mount

    

    const isRunning = testState === 'running';
    const isCompleted = testState === 'completed';
    const isSuccess = isCompleted && visitors > 0;
    const isFailed = isCompleted && visitors === 0;

    return (
        <div className="burst-today-select-item burst-tooltip-live">
            <ConnectionAnimation 
                isRunning={isRunning} 
                isSuccess={isSuccess} 
                testCompleted={isCompleted}
                isFailed={isFailed}
                retryCount={retryCountRef.current}
                isPro={isPro}
                handleManualRetry={handleManualRetry}
            />
        </div>
    );
};

export default TrackingTest;