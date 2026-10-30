import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';

type RenderErrorBoundaryProps = {
  children: ReactNode;
  onRecover: () => void;
  onHome: () => void;
};
type RenderErrorBoundaryState = { error: Error | null };

/**
 * Keep the desktop UI recoverable if a view throws during rendering.
 * This does not suppress errors: they remain visible and are logged to the console.
 */
export class RenderErrorBoundary extends Component<RenderErrorBoundaryProps, RenderErrorBoundaryState> {
  state: RenderErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RenderErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Solarium] View rendering failed:', error, info.componentStack);
  }

  private recover = (): void => {
    this.props.onRecover();
    this.setState({ error: null });
  };

  private goHome = (): void => {
    this.props.onHome();
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return <Box role="alert" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
      <Stack spacing={1.5} sx={{ width: '100%', maxWidth: 580 }}>
        <Typography variant="h6">Solarium could not display this view</Typography>
        <Alert severity="error" sx={{ overflowWrap: 'anywhere' }}>
          {this.state.error.message || 'An unexpected render error occurred.'}
        </Alert>
        <Typography color="text.secondary" fontSize={12}>
          Your conversations have not been deleted. You can close the activity panel and try again,
          or return to Home. Technical details are also available in the developer console.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={this.recover}>Close activity and retry</Button>
          <Button variant="outlined" onClick={this.goHome}>Return Home</Button>
        </Stack>
      </Stack>
    </Box>;
  }
}
