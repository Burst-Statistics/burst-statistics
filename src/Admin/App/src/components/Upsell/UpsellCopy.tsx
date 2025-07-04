import React from "react";
import { burst_get_website_url } from "@/utils/lib.js";
import Icon from "@/utils/Icon";
import ButtonInput from "@/components/Inputs/ButtonInput";
import { useABTest } from "@/hooks/useABTest";
import { __, _n, _x, sprintf } from '@wordpress/i18n';

interface UpsellCopyProps {
  className?: string;
}

/**
 * UpsellCopy component that displays different upsell messages based on A/B testing.
 * Uses campaign parameters to track conversion rates for each variation.
 */
const UpsellCopy: React.FC<UpsellCopyProps> = ({ className = "" }) => {
  // Use A/B testing to assign variation
  const { variation } = useABTest("upsell-copy-v1", ["A", "B"]);

  // Base campaign parameters for all variations
  const baseParams = {
    utm_source: "plugin",
    utm_medium: "upsell",
    utm_campaign: `upsell-variation-${variation.toLowerCase()}`,
  };

  // Get the appropriate copy based on variation
  // Note: Only A and B are used, but keeping C content for potential future use
  const getUpsellContent = (variation: string) => {
    switch (variation) {
      case "A":
        return {
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
        };

      case "B":
        return {
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
        };

      default:
        // Fallback to variation A if something unexpected happens
        return getUpsellContent("A");
    }
  };
  const content = getUpsellContent(variation);

  return (
    <div className={`mx-auto flex max-w-3xl gap-8 flex-wrap${className}`}>
      {/* Header */}
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-bold leading-tight text-black md:text-3xl">
          {content.title}
        </h2>
        <p className="text-base leading-relaxed text-gray">
          {content.description}
        </p>
      </div>

      {/* Feature Bullets */}
      <div className="max-w-content mx-auto flex flex-col space-y-4">
        {content.bullets.map((bullet, index) => {
          const parts = bullet.text.split(":");
          const hasColon = parts.length > 1;

          return (
            <div key={index} className="flex max-w-fit items-center space-x-4">
              <div className="mt-0.5 flex-shrink-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-light">
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
                  {hasColon ? (
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
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA Buttons */}
      <div className="flex w-full flex-col items-center space-y-3 text-center">
        {/* Primary CTA Button */}
        <ButtonInput
          btnVariant="primary"
          size="lg"
          link={{ to: burst_get_website_url("pricing", baseParams) }}
        >
          {__("Upgrade to Pro", "burst-statistics")}
        </ButtonInput>

        {/* Secondary Features Button */}
        <div>
          <ButtonInput
            btnVariant="tertiary"
            size="md"
            link={{ to: burst_get_website_url("/", baseParams) }}
          >
            {__("Learn about all features", "burst-statistics")}
          </ButtonInput>
        </div>
      </div>

      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-6 w-full text-center">
          <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1">
            <Icon name="help" color="gray" size={14} className="mr-1" />
            <span className="text-xs text-gray">
              {sprintf(__("Variation: %s", "burst-statistics"), variation)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpsellCopy;
