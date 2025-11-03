import React from "react";
import { __ } from "@wordpress/i18n";
import { burst_get_website_url } from "@/utils/lib";
import useLicenseData from "@/hooks/useLicenseData";
import Icon from "@/utils/Icon";

interface ProBadgeProps {
  id?: string;
  className?: string;
  label?: string;
  url?: string;
  type?: string; //icon or badge
}

/**
 * ProBadge Component
 *
 * A reusable component to display a clickable "Pro" badge.
 *
 * @param props - Component props
 * @param props.id - ID for tracking purposes (optional)
 * @param props.className - Additional classes to apply to the badge (optional)
 * @param props.label - Label instead of Burst Pro (optional)
 * @param props.url - URL to navigate to when clicked (optional)
 * @param props.type - URL to navigate to when clicked (optional)
 * @returns JSX.Element
 */
const ProBadge: React.FC<ProBadgeProps> = ({
  id='',
  className = "",
  url,
  label,
  type = "badge"
}) => {

  const {
    isTrial,
    licenseInactive,
      isLicenseValidFor,
  } = useLicenseData();

  if ( licenseInactive && !isTrial ) {
    // return null;
  }

  if ( !isTrial && isLicenseValidFor(id)) {
    return null;
  }

  let finalUrl = url;
  if (!finalUrl) {
    finalUrl = burst_get_website_url("pricing", {
      utm_source: "pro-badge",
      utm_content: id || "empty-content",
    });
  }

  if ( type === 'icon' ) {
    return (
        <a
            href={finalUrl}
            className={`inline-flex items-center px-0.5 py-0.5 inline-flex rounded-full bg-green-light border border-gray-100 transition-colors`}
            title={__(
                "Unlock this feature with Pro. Upgrade for more insights and control.",
                "burst-statistics",
            )}
        >
            <Icon color='green' name="sprout" size={14} strokeWidth={1.5}/>
        </a>
    );
  }

  return (
    <a
      href={finalUrl}
      className={`inline-flex items-center rounded bg-primary px-2 py-0.5 text-xs font-medium text-white transition-colors ${className}`}
      title={__(
        "Unlock this feature with Pro. Upgrade for more insights and control.",
        "burst-statistics",
      )}
    >
      {/* Not translated because it's a brand name */}
      {label || 'Burst Pro'}
    </a>
  );
};

export default ProBadge;
