import { memo } from "react";
import clsx from "clsx";
import ErrorBoundary from "@/components/Common/ErrorBoundary";

type BlockProps = {
  className?: string;
  children: React.ReactNode;
};

const Block = memo(({ className = "", children }: BlockProps) => {
  return (
      <ErrorBoundary>
    <div
      className={clsx(
        "col-span-12 flex flex-col overflow-hidden rounded-xl bg-white shadow-md relative border border-gray-100",
        className, // later so should override the above
      )}
    >
      {children}
    </div>
    </ErrorBoundary>
  );
});

Block.displayName = "Block";

export default Block;
