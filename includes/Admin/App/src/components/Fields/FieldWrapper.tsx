import React, { memo } from "react";
import * as Label from "@radix-ui/react-label";
import { __ } from "@wordpress/i18n";
import { clsx } from "clsx";
import RecommendBadge from "@/components/Common/RecommendBadge";
import DisabledBadge from "@/components/Common/DisabledBadge";
import ProBadge from "@/components/Common/ProBadge";
import useLicenseStore from "@/store/useLicenseStore";
import HelpTooltip from "@/components/Common/HelpTooltip";

interface FieldWrapperProps {
  label: string;
  // Allow context to be a ReactNode or an object with text and url.
  context?: React.ReactNode | { text?: string; url?: string };
  help?: string;
  error?: string;
  reverseLabel?: boolean;
  alignWithLabel?: boolean;
  fullWidthContent?: boolean;
  className?: string;
  inputId: string;
  required?: boolean;
  recommended?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  pro?: { url?: string };
  warning?: string;
}

const isContextObject = (
  value: any,
): value is { text?: string; url?: string } => {
  return value && typeof value === "object" && !React.isValidElement(value);
};

const FieldWrapper = memo(
  ({
    label,
    context,
    help,
    error,
    reverseLabel = false,
    alignWithLabel = false,
    fullWidthContent = false,
    className = "",
    inputId,
    required = false,
    recommended = false,
    disabled = false,
    children,
    warning,
    pro,
  }: FieldWrapperProps) => {
    const { isLicenseValid } = useLicenseStore();

    // Outer wrapper with conditional error background
    const wrapperClasses = clsx(
      className,
      "w-full py-4 box-border",
      !fullWidthContent && "px-6",
      error && "bg-red-light",
    );

    // Use a flex container that is row when aligning side-by-side and column otherwise.
    const containerClasses = alignWithLabel
      ? "flex flex-row items-center justify-between"
      : "flex flex-col";

    // Compute order classes based on reverseLabel.
    const labelOrderClass = reverseLabel ? "order-2" : "order-1";
    const fieldOrderClass = reverseLabel ? "order-1" : "order-2";

    // Margins based on horizontal or vertical layout.
    const labelMargin = alignWithLabel
      ? reverseLabel
        ? "ml-4"
        : ""
      : reverseLabel
        ? "mt-2"
        : "";
    const fieldMargin = alignWithLabel
      ? !reverseLabel
        ? "ml-4"
        : ""
      : !reverseLabel
        ? "mt-2"
        : "";

    const labelBlock = (
      <div
        className={clsx(
          "flex items-center gap-2",
          labelMargin,
          fullWidthContent && "px-6",
        )}
      >
        <Label.Root
          className="cursor-pointer text-md font-medium text-black"
          htmlFor={inputId}
        >
          {label}
        </Label.Root>
        {required && (
          <span className="ml-1 text-xs font-normal text-gray">
            ({__("Required", "burst-statistics")})
          </span>
        )}
        {recommended && <RecommendBadge />}
        {disabled && !pro && <DisabledBadge />}
        {pro && !isLicenseValid() && <ProBadge id={inputId} url={pro.url} />}
        {help && (
          <HelpTooltip content={help}>
            <span className="inline-flex h-5 w-5 cursor-default items-center justify-center rounded-full border border-gray-400 bg-gray-200 text-center text-base leading-none text-gray hover:bg-gray-300 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary">
              ?
            </span>
          </HelpTooltip>
        )}
      </div>
    );

    const fieldBlock = (
      <div className={clsx("w-full", fieldMargin, fullWidthContent && "px-0")}>
        {children}
      </div>
    );

    return (
      <div className={wrapperClasses}>
        <div className={containerClasses}>
          <div className={clsx(labelOrderClass)}>{labelBlock}</div>
          <div className={clsx(fieldOrderClass)}>{fieldBlock}</div>
        </div>

        {error && (
          <p className="mt-2 text-sm font-semibold text-red" role="alert">
            {error}
          </p>
        )}

        {warning && (
          <p className="mt-2 text-sm font-semibold text-orange" role="alert">
            {warning}
          </p>
        )}

        {context && (
          <p className="mt-2 text-sm font-normal text-gray">
            {isContextObject(context) ? context.text : context}
            {isContextObject(context) && context.url && " "}
            {isContextObject(context) && context.url && (
              <a
                className="text-blue underline"
                href={context.url}
                target="_blank"
              >
                {__("More info", "burst-statistics")}
              </a>
            )}
          </p>
        )}
      </div>
    );
  },
);

FieldWrapper.displayName = "FieldWrapper";

export default FieldWrapper;
