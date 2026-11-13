import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Bug, RefreshCw } from "lucide-react";

interface WorkspaceErrorBoundaryProps {
  name: string;
  onReturn?: () => void;
  children: ReactNode;
}

interface WorkspaceErrorBoundaryState {
  error: Error | null;
  resetKey: number;
}

export class WorkspaceErrorBoundary extends Component<WorkspaceErrorBoundaryProps, WorkspaceErrorBoundaryState> {
  state: WorkspaceErrorBoundaryState = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<WorkspaceErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const detail = `${this.props.name}: ${error.message}\n${info.componentStack ?? ""}`;
    window.dispatchEvent(new CustomEvent("shadowium:workspace-error", { detail }));
    console.error(detail);
  }

  private reload = (): void => {
    this.setState((state) => ({ error: null, resetKey: state.resetKey + 1 }));
  };

  render(): ReactNode {
    if (!this.state.error) return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
    return (
      <section className="workspace-crash-card" role="alert">
        <span className="workspace-crash-icon"><AlertTriangle size={30} /></span>
        <div className="workspace-crash-copy">
          <h2>{this.props.name} could not be displayed</h2>
          <p>ShadowiumUI isolated the editor failure so the rest of the workbench stays usable.</p>
          <pre>{this.state.error.message}</pre>
          <div className="workspace-crash-actions">
            <button className="material-button filled" type="button" onClick={this.reload}><RefreshCw size={15} /> Reload {this.props.name}</button>
            {this.props.onReturn && <button className="material-button tonal" type="button" onClick={this.props.onReturn}><ArrowLeft size={15} /> Return to World</button>}
            <button className="material-button text" type="button" onClick={() => navigator.clipboard?.writeText(this.state.error?.stack ?? this.state.error?.message ?? "Unknown workspace error")}><Bug size={15} /> Copy crash details</button>
          </div>
        </div>
      </section>
    );
  }
}
