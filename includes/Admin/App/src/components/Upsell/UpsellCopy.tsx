import React from "react";
import { burst_get_website_url } from "@/utils/lib.js";
import Icon from "@/utils/Icon";
import ButtonInput from "@/components/Inputs/ButtonInput";
import { useABTest } from "@/hooks/useABTest";
import { __, sprintf } from '@wordpress/i18n';
import useLicenseData from "@/hooks/useLicenseData";

interface UpsellCopyProps {
    className?: string;
    type: string;
}

interface UpsellConfigsProps {
    [key: string]: {
        testID: string;
        upgradePlan: {
            header:string,
            subTitle:string,
            licenseInsufficient:string,
        },
        variations: {
            [key: string]: {
                utm_medium: string;
                title: string;
                description: string;
                bullets: {
                    icon: string;
                    text: string;
                }[];
            };
        };
    };
}

const upsellConfigs: UpsellConfigsProps = {
    sales: {
        upgradePlan: {
            header: __( 'Unlock Sales Performance', 'burst-statistics' ),
            subTitle: __( 'Gain valuable insights into your store’s revenue, top products, and sales trends.', 'burst-statistics' ) ,
            licenseInsufficient: __('Your current license does not include the Sales dashboard.', 'burst-statistics')
        },
        testID: 'sales-upsell-copy-v1',
        variations: {
            A: {
                utm_medium: 'sales-upsell-variation-a',
                title: __("Is your checkout costing you sales?", "burst-statistics"),
                description: __(
                    "You work hard to bring visitors to your site. But do you know why some buy and others leave? Without the right insights, it’s impossible to see where your funnel is leaking revenue. Burst Pro reveals what’s working, what’s broken, and where you can make small changes that drive big results.",
                    "burst-statistics"
                ),
                bullets: [
                    {
                        icon: "goals",
                        text: __("Find drop-offs: See exactly where visitors leave in your checkout funnel.", "burst-statistics"),
                    },
                    {
                        icon: "goals",
                        text: __("Reduce cart abandonment: Identify checkout issues before they cost sales.", "burst-statistics"),
                    },
                    {
                        icon: "goals",
                        text: __("Spot opportunities: Learn which products, channels, and devices generate the most revenue.", "burst-statistics"),
                    },
                ],
            },
            B: {
                utm_medium: 'sales-upsell-variation-b',
                title: __( "Are your visitors buying, or just browsing?", "burst-statistics" ),
                description: "",
                bullets: [
                    {
                        icon: "goals",
                        text: __( "Uncover checkout drop‑offs", "burst-statistics" ),
                    },
                    {
                        icon: "goals",
                        text: __( "Spot and fix cart abandonment issues", "burst-statistics" ),
                    },
                    {
                        icon: "goals",
                        text: __( "See which products and channels earn revenue", "burst-statistics" ),
                    },
                ],
            }
        }
    },
    sources: {
        upgradePlan: {
            header: __('Unlock Source Insights', 'burst-statistics'),
            subTitle: __('Get detailed insights into where your traffic comes from.', 'burst-statistics'),
            licenseInsufficient: ''
        },
        // Keeping testID to upsell-copy-v1 for backwards compatibility.
        testID: 'upsell-copy-v1',
        variations: {
            A: {
                utm_medium: 'upsell-variation-a',
                title: __("Are you just guessing with your marketing?", "burst-statistics"),
                description: __(
                    "You spend time and money creating campaigns, but can't see what's actually working. Are your newsletters driving traffic or just getting opened? Is your social media budget paying off? Without clear tracking, you're making decisions in the dark, which is inefficient and frustrating.",
                    "burst-statistics"
                ),
                bullets: [
                    {
                        icon: "goals",
                        text: __("Stop guessing: Track UTM campaigns to see which channels deliver real visitors.", "burst-statistics"),
                    },
                    {
                        icon: "filter",
                        text: __("Optimize with confidence: Refine on-site promotions by analyzing custom URL parameters.", "burst-statistics"),
                    },
                    {
                        icon: "world",
                        text: __("Go beyond numbers: Visualize exactly where your visitors are with an interactive world map.", "burst-statistics"),
                    },
                ],
            },
            B: {
                utm_medium: 'upsell-variation-b',
                title: __("Turn your traffic into targeted growth.", "burst-statistics"),
                description: __(
                    "Effective growth comes from understanding your audience on a deeper level. Burst Pro provides the tools to see not just how many people visit, but who they are and what brought them to you, so you can focus your efforts where they matter most.",
                    "burst-statistics"
                ),
                bullets: [
                    {
                        icon: "goals",
                        text: __("Measure the success of your marketing with automatic UTM campaign tracking.", "burst-statistics"),
                    },
                    {
                        icon: "filter",
                        text: __("Optimize your website by tracking how visitors interact with specific parameters.", "burst-statistics"),
                    },
                    {
                        icon: "world",
                        text: __("Tailor your content by identifying key visitor locations, from country down to the city.", "burst-statistics"),
                    },
                ],
            }
        },
    }
}

/**
 * UpsellCopy component that displays different upsell messages based on A/B testing.
 * Uses campaign parameters to track conversion rates for each variation.
 */
const UpsellCopy: React.FC< UpsellCopyProps > = ( { className = "", type = 'sources' } ) => {
    const { licenseActivated, isPro } = useLicenseData();

    const upsellConfig = upsellConfigs[ type ] || upsellConfigs['sources'];

    const testID = upsellConfig.testID;
    const variations = Object.keys( upsellConfig.variations );

    // Use A/B testing to assign variation.
    const { variation } = useABTest( testID, variations );

    // Get the appropriate copy based on variation
    // Note: Only A and B are used, but keeping C content for potential future use
    const content = upsellConfig.variations[ variation ] || upsellConfig.variations['A'];

    // Base campaign parameters for all variations
    // Don't use `utm_campaign` here as it is filled in by the plugin automatically
    const baseParams = {
        utm_source: "plugin",
        utm_medium: content.utm_medium,
    };

    // if this is premium, but user has not activated the license, or has a not sufficient tier
    if ( isPro ) {
        return (
            <div className="text-center space-y-6">
                <h2 className="text-2xl font-semibold text-gray-900">
                    { upsellConfig.upgradePlan.header }
                </h2>

                <p className="text-lg text-gray-600 max-w-md mx-auto">
                    { upsellConfig.upgradePlan.subTitle }
                </p>

                <p className="text-base text-gray-500">
                    {
                        ! licenseActivated && __('Already have a license? Activate it to access these features.', 'burst-statistics')
                    }

                    {
                        licenseActivated && upsellConfig.upgradePlan.licenseInsufficient
                    }
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    {
                        ! licenseActivated && (
                            <ButtonInput
                                btnVariant="primary"
                                size="lg"
                                link={ {to: '/settings/license'} }
                            >
                                {
                                    __( 'Activate License', 'burst-statistics' )
                                }
                            </ButtonInput>
                        )
                    }

                    <ButtonInput
                        btnVariant="secondary"
                        size="lg"
                        onClick={() => {
                            window.open( burst_get_website_url( 'pricing', baseParams ), '_blank' );
                        }}
                    >
                        { __( 'Upgrade Plan', 'burst-statistics' ) }
                    </ButtonInput>
                </div>
            </div>
        )
    }


    // if we're here, this is free.
    return (
        <div className={`mx-auto flex justify-center max-w-3xl gap-8 flex-wrap${className}`}>
            <div className="text-center">
                <h2 className="mb-4 text-2xl font-bold leading-tight text-black md:text-3xl">
                    { content.title }
                </h2>

                <p className="text-base leading-relaxed text-gray">
                    { content.description }
                </p>
            </div>

            <div className="max-w-content mx-auto flex flex-col space-y-4">
                {
                    content.bullets.map( ( bullet, index ) => {
                        const parts = bullet.text.split( ":" );
                        const hasColon = parts.length > 1;

                        return (
                            <div key={index} className="flex max-w-fit items-center space-x-4">
                                <div className="mt-0.5 flex-shrink-0">
                                    <div
                                        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-light">
                                        <Icon
                                            name={bullet.icon}
                                            color="black"
                                            size={14}
                                            strokeWidth={2}
                                        />
                                    </div>
                                </div>

                                <div className="pt-1">
                                    <p className="m-0 whitespace-nowrap text-md leading-relaxed text-gray">
                                        {
                                            hasColon ? (
                                                <>
                                                    <span className="font-semibold text-gray">
                                                        {parts[0]}:
                                                    </span>

                                                    <span className="ml-1">{parts.slice(1).join(":")}</span>
                                                </>
                                            ) : (
                                                <span className="font-semibold text-gray">
                                                    {bullet.text}
                                                </span>
                                            )
                                        }
                                    </p>
                                </div>
                            </div>
                        );
                    })
                }
            </div>

            <div className="flex w-full flex-col items-center space-y-3 text-center">
                <ButtonInput
                    btnVariant="primary"
                    size="lg"
                    link={{to: burst_get_website_url("pricing", baseParams)}}
                >
                    { __("Upgrade to Pro", "burst-statistics") }
                </ButtonInput>

                <div>
                    <ButtonInput
                        btnVariant="tertiary"
                        size="md"
                        link={{to: burst_get_website_url("/", baseParams)}}
                    >
                        { __("Learn about all features", "burst-statistics") }
                    </ButtonInput>
                </div>
            </div>

            {
                process.env.NODE_ENV === "development" && (
                    <div className="mt-6 w-full text-center">
                        <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1">
                            <Icon name="help" color="gray" size={14} className="mr-1"/>
                            <span className="text-xs text-gray">
                                { sprintf(__("Variation: %s", "burst-statistics"), variation) }
                            </span>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default UpsellCopy;

