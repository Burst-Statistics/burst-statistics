import { memo } from "react";
import { Block } from "./Block";

type CollapsableBlockProps = {
  className?: string;
  children: React.ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
};

export const CollapsableBlock = memo(
  ({
    className = "",
    children,
    title,
    isOpen,
    onToggle,
  }: CollapsableBlockProps) => {
    return (
      <Block className={className}>
        <details
          className="group"
          open={isOpen}
          onToggle={(e) => onToggle(e.currentTarget.open)}
        >
          <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 hover:rounded-xl">
            <span className="text-base font-medium text-black">{title}</span>
            <svg
              className="h-5 w-5 text-gray transition-transform group-open:rotate-180"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </summary>
          <div className="p-4 pt-0">{children}</div>
        </details>
      </Block>
    );
  },
);

CollapsableBlock.displayName = "CollapsableBlock";
