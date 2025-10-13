
import { clsx } from "clsx";
import {ErrorBoundary} from "../ErrorBoundary";
import {memo} from "react";

type BlockProps = {
  className?: string;
  children: React.ReactNode;
};

export const Block = memo(({ className = "", children }: BlockProps) => {

  return (
      <ErrorBoundary>
    <div
      className={clsx(
        "col-span-12 flex flex-col overflow-hidden rounded-xl bg-white shadow-md relative",
        className, // later so should override the above
      )}
    >
      {children}
    </div>
    </ErrorBoundary>
  );
});

Block.displayName = "Block";
