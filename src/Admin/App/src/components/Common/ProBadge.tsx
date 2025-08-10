import React from "react";
import { __ } from "@wordpress/i18n";
import useLicenseStore from "@/store/useLicenseStore";
import { burst_get_website_url } from "@/utils/lib";

interface ProBadgeProps {
  id?: string;
  className?: string;
  label?: string;
  url?: string;
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
 * @returns JSX.Element
 */
const ProBadge: React.FC<ProBadgeProps> = ({
  id,
  className = "",
  url,
  label,
}) => {
  const { isLicenseValid } = useLicenseStore();

  if (isLicenseValid()) {
    return null;
  }

  let finalUrl = url;
  if (!finalUrl) {
    finalUrl = burst_get_website_url("pricing", {
      utm_source: "pro-badge",
      utm_content: id || "empty-content",
    });
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
