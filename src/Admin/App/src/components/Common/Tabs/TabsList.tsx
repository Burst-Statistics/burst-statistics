import React from "react";
import clsx from "clsx";
import type { ReactElement } from "react";
import { TabsTrigger } from "@/components/Common/Tabs";
/**
 * Single tab item type.
 */
interface TabItem {
	id: string;
	title: string;
	activeStyle?: string;
}
/**
 * Props for the TabsList component.
 */
export interface TabsListProps extends React.HTMLAttributes< HTMLDivElement > {
	tabConfig: TabItem[];
	tabGroup: string;
	className?: string;
}

/**
 * Tab list component.
 *
 * @param {TabsListProps} props - Component props.
 * @param {string} [props.className] - Additional class names.
 * @param {React.ReactNode} props.tabGroup - The content of the tab list.
 *
 * @returns {JSX.Element} The rendered tab list component.
 */
export function TabsList( { className, tabConfig, tabGroup }: TabsListProps ): ReactElement {
	return (
		<div
			className={ clsx(
				"grid grid-flow-col auto-cols-fr gap-0.5 border border-gray-300 rounded-md bg-gray-200 p-0.5 shadow-sm",
				className
			) }
		>
			{tabConfig.map( ( tabItem, index ) => {
					const style = index === 0 ? "blue" : index === 1 ? "green" : undefined;
					return (
							<TabsTrigger
								key={tabItem.id}
								group={ tabGroup }
								activeStyle={style}
								id={tabItem.id}
							>
								{ tabItem.title }
							</TabsTrigger>
						)
					}
				)
			}
		</div>
	);
}
