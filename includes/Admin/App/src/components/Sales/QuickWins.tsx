/**
 * QuickWins Component.
 */
import { useDate } from "@/store/useDateStore";
import { useFiltersStore } from "@/store/useFiltersStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { __ } from "@wordpress/i18n";
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import getQuickWins from "@/api/getQuickWins";
import Icon from "@/utils/Icon";
import { Root, Trigger, Content, Close } from '@radix-ui/react-popover';
import { useEffect, useState } from "react";
import { doAction } from "@/utils/api";
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from "framer-motion";


type QuickWinsKeys = 'critical' | 'opportunity' | 'recommended';

interface QuickWinItem {
    type: QuickWinsKeys;
    key: string;
    title: string;
    message: string;
    recommendation: string;
    url: string | null;
}

interface QuickWinsData {
    quickWins: QuickWinItem[];
}

const blockHeadingProps = {
    title: __( 'Opportunities', 'burst-statistics' ),
}

const blockContentProps = {
    className: 'p-0',
}

const iconMap = {
    critical: {
        icon: 'zap',
        backgroundColor: 'bg-red'
    },
    opportunity: {
        icon: 'sun',
        backgroundColor: 'bg-green'
    },
    recommended: {
        icon: 'bulb',
        backgroundColor: 'bg-blue'
    }
}

/**
 * QuickWins component.
 *
 * @return {JSX.Element} The QuickWins component.
 */
const QuickWins = (): JSX.Element => {
    const { startDate, endDate, range } = useDate( ( state ) => state );
    const filters = useFiltersStore( ( state ) => state.filters );
    const [ quickWins, setQuickWins ] = useState< QuickWinItem[] | null >(null);
    const queryClient = useQueryClient();

    const quickWinsQuery = useQuery<QuickWinsData | null>(
        {
            queryKey: [ 'quickWins', startDate, endDate, range, filters ],
            queryFn: () => getQuickWins( { startDate, endDate, range, filters } ),
            placeholderData: null,
            gcTime: 10000
        }
    );

    const dismissMutation = useMutation({
        mutationFn: async (key: string) => {
            const response = await doAction('ecommerce/quick-win/dismiss', { id: key });
            if (!response?.success) {
                throw new Error(response?.message || 'Failed to dismiss quick win');
            }
            return response;
        },
        onMutate: async (key: string) => {
            await queryClient.cancelQueries({ queryKey: ['quickWins', startDate, endDate, range, filters] });

            const previousData = queryClient.getQueryData<QuickWinsData | null>(['quickWins', startDate, endDate, range, filters]);

            if (previousData?.quickWins) {
                const newData = {
                    ...previousData,
                    quickWins: previousData.quickWins.filter(item => item.key !== key),
                };
                queryClient.setQueryData(['quickWins', startDate, endDate, range, filters], newData);
            }

            return { previousData };
        },
        onError: (err, key, context) => {
            // Rollback if mutation fails or backend returned success=false
            if (context?.previousData) {
                queryClient.setQueryData(['quickWins', startDate, endDate, range, filters], context.previousData);
            }

            toast.error( err instanceof Error ? err.message : __( 'An error occurred', 'burst-statistics' ) );
        },
        onSuccess: () => {},
    });

    const snoozeMutation = useMutation({
        mutationFn: async (key: string) => {
            const response = await doAction('ecommerce/quick-win/snooze', { id: key });
            if (!response?.success) {
                throw new Error(response?.message || 'Failed to snooze quick win');
            }
            return response;
        },
        onMutate: async (key: string) => {
            await queryClient.cancelQueries({ queryKey: ['quickWins', startDate, endDate, range, filters] });

            const previousData = queryClient.getQueryData<QuickWinsData | null>(['quickWins', startDate, endDate, range, filters]);

            if (previousData?.quickWins) {
                const newData = {
                    ...previousData,
                    quickWins: previousData.quickWins.filter(item => item.key !== key),
                };
                queryClient.setQueryData(['quickWins', startDate, endDate, range, filters], newData);
            }

            return { previousData };
        },
        onError: (err, key, context) => {
            // Rollback if mutation fails or backend returned success=false
            if (context?.previousData) {
                queryClient.setQueryData(['quickWins', startDate, endDate, range, filters], context.previousData);
            }

            toast.error( err instanceof Error ? err.message : __( 'An error occurred', 'burst-statistics' ) );
        },
        onSuccess: () => {},
    });

    const quickWinsData = quickWinsQuery.data || { quickWins: [] };

    useEffect( () => {
        if ( quickWinsData.quickWins ) {
            setQuickWins( quickWinsData.quickWins );
        }
    }, [ quickWinsData.quickWins ] );

    const quickWinVariants = {
        hidden: { opacity: 0, y: -10 },
        visible: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
    };

    return (
        <Block className="row-span-2 overflow-hidden xl:col-span-6">
            <BlockHeading { ...blockHeadingProps } />

            <BlockContent { ...blockContentProps }>
                {
                    quickWinsQuery.isFetching ? (
                        <p className="p-6 text-sm text-gray-500">{ __( 'Loading...', 'burst-statistics' ) }</p>
                    ) : (
                        quickWins && quickWins.length > 0 && quickWins ? (
                            <div className="flex h-full flex-col overflow-y-auto max-h-96">
                                <AnimatePresence>
                                    {
                                        quickWins.map(( quickWin ) => {
                                        if ( ! quickWin.type ) {
                                            return null;
                                        }

                                        const { type, key, message, recommendation, url, title } = quickWin;

                                        return (
                                            <motion.div
                                                key={`${type}_${key}`}
                                                variants={quickWinVariants}
                                                initial="hidden"
                                                animate="visible"
                                                exit="exit"
                                                transition={{ duration: 0.5, ease: "easeOut" }}
                                                className="border-t border-gray-200 p-6 group"
                                            >
                                                <div className='flex items-start justify-between mb-4'>
                                                    <div className='flex flex-col gap-2'>
                                                        <div className='flex items-center gap-3'>
                                                            {
                                                                iconMap[type] && (
                                                                    <Icon name={iconMap[type].icon} color='white' size={25} className={`rounded-full p-1 ${iconMap[type].backgroundColor}`} />
                                                                )
                                                            }

                                                            <h3 className="text-md font-semibold">{title}</h3>
                                                        </div>

                                                        <p className="text-base text-gray-600">{message}</p>
                                                    </div>

                                                    <Root>
                                                        <Trigger asChild>
                                                            <button className='hidden group-hover:inline-block burst-button burst-button--secondary rounded-full bg-gray-300 p-2'>
                                                                <Icon size={24} name='ellipsis' />
                                                            </button>
                                                        </Trigger>

                                                        <Content sideOffset={5} align='end' className="z-50 min-w-[280px] max-w-[600px] rounded-lg border border-gray-200 bg-white p-0 shadow-xl" hideWhenDetached={true}>
                                                            <Close asChild>
                                                                <button
                                                                    className="w-full px-6 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                                                                    onClick={() => dismissMutation.mutate(key)}
                                                                >
                                                                    { __( 'Dismiss', 'burst-statistics' ) }
                                                                </button>
                                                            </Close>

                                                            <Close asChild>
                                                                <button
                                                                    className="w-full px-6 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                                                                    onClick={() => snoozeMutation.mutate(key)}
                                                                >
                                                                    { __( 'Snooze for 30 days', 'burst-statistics' ) }
                                                                </button>
                                                            </Close>
                                                        </Content>
                                                    </Root>
                                                </div>

                                                {
                                                    url && (
                                                    <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="items-center bg-blue-lightest pt-2 pb-2 pl-3 pr-3 rounded flex gap-3"
                                                    >
                                                        <Icon name='graph' color='blue' size={24} />

                                                        <p className='flex-1 text-sm font-semibold text-black'>{recommendation}</p>

                                                        <span className='shrink-0 text-xxs font-semibold text-black-light flex gap-1 items-center'>
                                                            { __( 'Read our guide', 'burst-statistics' ) }
                                                            <Icon name='right-arrow' color='black-light' size={24} className='inline-block' />
                                                        </span>
                                                    </a>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <p className="p-6 text-sm text-gray-500">{ __( 'Crunching data. Check back later to see if there are quick wins!', 'burst-statistics' ) }</p>
                        )
                    )
                }
            </BlockContent>
        </Block>
    )
}

export default QuickWins;
