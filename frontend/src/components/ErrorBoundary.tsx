import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Keeps one crashing component from blanking the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-2xl mx-auto p-8">
          <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/25
                          rounded-xl p-6">
            <h2 className="font-bold text-red-700 dark:text-red-400 mb-2">Something broke in the UI</h2>
            <pre className="text-xs text-red-600 dark:text-red-300 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <button onClick={() => this.setState({ error: null })}
                    className="btn btn-primary mt-4">
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
