import { createRoot } from 'react-dom/client';

// Jalon 1 : seule l'API est construite. Le mur (jalon 2) et l'interface
// téléphone (jalon 3) viendront remplir ce point d'entrée.
function Placeholder() {
  return (
    <main style={{ font: '16px/1.5 system-ui, sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 20 }}>Maison</h1>
      <p>
        Jalon 1 : schéma, migrations, seed et API en lecture. Les interfaces
        arrivent aux jalons suivants.
      </p>
      <p>
        <a href="/sonde.html">Sonde tablette</a> — à ouvrir sur la tablette du salon.
      </p>
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Placeholder />);
