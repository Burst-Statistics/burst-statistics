import type { ReactNode } from 'react';

declare module '@wordpress/element' {
    export interface Component<P = {}, S = {}> {
        render(): ReactNode;
        setState<K extends keyof S>(
            state: ((prevState: Readonly<S>) => Pick<S, K> | S | null) | Pick<S, K> | S | null,
            callback?: () => void
        ): void;
        forceUpdate(callback?: () => void): void;
    }

    export interface ComponentClass<P = {}, S = {}> {
        new (props: P, context?: any): Component<P, S>;
        displayName?: string;
        defaultProps?: Partial<P>;
        contextType?: any;
    }

    export interface FunctionComponent<P = {}> {
        (props: P, context?: any): ReactNode;
        displayName?: string;
        defaultProps?: Partial<P>;
    }

    export type FC<P = {}> = FunctionComponent<P>;

    export function useState<T>(initialState: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
    export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
    export function useMemo<T>(factory: () => T, deps: DependencyList | undefined): T;
    export function memo<P = {}>(
        Component: FunctionComponent<P>,
        propsAreEqual?: (prevProps: P, nextProps: P) => boolean
    ): FC<P>;
}

export interface Step {
    id: string;
    title: string;
    subtitle: string;
    fields?: Array<{
        id: string;
        default?: string | boolean;
    }>;
    bullets?: string[];
    conditional_bullets?: Array<Record<string, string>>;
    button: {
        id: string;
        label: string;
    };
    visible?: boolean;
}

export interface SettingField {
    id: string;
    value: string | boolean;
    [key: string]: any;
}

export interface OnboardingState {
    isOpen: boolean;
    currentStepIndex: number;
    completedSteps: string[];
    steps: Step[];
    setOpen: (isOpen: boolean) => void;
    setCurrentStepIndex: (index: number) => void;
    addSuccessStep: (stepId: string) => void;
    setSteps: (steps: Step[]) => void;
}

export type DependencyList = ReadonlyArray<any>;
export type EffectCallback = () => (void | (() => void | undefined));
export type SetStateAction<S> = S | ((prevState: S) => S);
export type Dispatch<A> = (value: A) => void; 