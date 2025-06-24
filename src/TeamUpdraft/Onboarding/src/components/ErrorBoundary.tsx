import { Component } from '@wordpress/element';
import type { ErrorInfo, ReactNode } from 'react';
import { __ } from '@wordpress/i18n';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <h2 className="text-red-800 font-semibold mb-2">
                        {__('Something went wrong', 'burst-pro')}
                    </h2>
                    <p className="text-red-600">
                        {__('Please try refreshing the page or contact support if the problem persists.', 'burst-pro')}
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}

export { ErrorBoundary }; 