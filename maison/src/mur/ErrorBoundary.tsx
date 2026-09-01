import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Un mur qui plante affiche une page blanche, dans un salon, sans console
 * pour comprendre. On attrape donc l'erreur, on la garde lisible à l'écran,
 * et on recharge la page une minute plus tard : la plupart des pannes d'un
 * affichage en lecture seule se soignent par un rechargement.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  private timer: number | null = null;

  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { message: null };
  }

  static getDerivedStateFromError(error: unknown): { message: string } {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    if (this.timer === null) {
      this.timer = window.setTimeout(() => window.location.reload(), 60000);
    }
  }

  componentWillUnmount(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
  }

  render(): ReactNode {
    if (this.state.message === null) return this.props.children;
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          padding: '6vh 6vw',
          background: '#efebe1',
          color: '#8b857a',
          font: 'italic 3vh Georgia, serif',
        }}
      >
        L'écran s'est arrêté. Il se recharge tout seul dans une minute.
        <div style={{ marginTop: '3vh', font: '1.6vh ui-monospace, monospace' }}>{this.state.message}</div>
      </div>
    );
  }
}
