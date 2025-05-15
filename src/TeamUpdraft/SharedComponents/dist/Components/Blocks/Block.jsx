import { memo } from "react";
import clsx from "clsx";
import ErrorBoundary from "@/components/Common/ErrorBoundary";
var Block = memo(function (_a) {
    var _b = _a.className, className = _b === void 0 ? "" : _b, children = _a.children;
    return (<ErrorBoundary>
    <div className={clsx("col-span-12 flex flex-col overflow-hidden rounded-xl bg-white shadow-md relative", className)}>
      {children}
    </div>
    </ErrorBoundary>);
});
Block.displayName = "Block";
export default Block;
