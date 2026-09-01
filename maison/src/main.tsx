import { createRoot } from 'react-dom/client';
import { PhoneApp } from './app/PhoneApp';
import './shared/theme.css';

// Deux surfaces, deux URL, un jeton unique pour le foyer :
//   /app/:token  — le téléphone
//   /mur/:token  — l'écran du salon
// Pas de bibliothèque de routage : il n'y a rien à router.
function surface(): { kind: 'app' | 'mur'; token: string } | null {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  if (parts[0] === 'app') return { kind: 'app', token: parts[1] };
  if (parts[0] === 'mur') return { kind: 'mur', token: parts[1] };
  return null;
}

function Landing({ message }: { message: string }) {
  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: 24, lineHeight: 1.5 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 400 }}>Maison</h1>
      <p>{message}</p>
    </main>
  );
}

const target = surface();
const root = document.getElementById('root');

if (root !== null) {
  createRoot(root).render(
    target === null ? (
      <Landing message="Cette adresse n'existe pas. Ouvre le lien du foyer, en /app/… ou /mur/…" />
    ) : target.kind === 'app' ? (
      <PhoneApp token={target.token} />
    ) : (
      <Landing message="L'écran mural arrive au jalon 2." />
    ),
  );
}
