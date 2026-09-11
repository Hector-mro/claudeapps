import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { adoptAccessKeyFromLocation } from './sync/config'

adoptAccessKeyFromLocation()

// Un lien `#cle=` ouvert dans un onglet qui affiche déjà l'app ne change que le
// fragment : pas de chargement de page, donc rien ne lirait le code. On le
// récupère ici, puis on recharge pour repartir avec, comme à une ouverture normale.
window.addEventListener('hashchange', () => {
  if (adoptAccessKeyFromLocation()) location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Une version déjà installée doit pouvoir être remplacée : on vérifie les
  // mises à jour au lancement, à chaque retour au premier plan (une app de
  // téléphone laissée en arrière-plan n'est pas relancée), et une fois par
  // heure si l'app reste ouverte.
  const hadController = !!navigator.serviceWorker.controller
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.update()
      setInterval(() => reg.update(), 3600000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update()
      })
    })
  })

  // Quand un nouveau service worker prend la main, on recharge une fois pour
  // afficher la nouvelle version. Jamais à la première installation, où il
  // n'y avait encore rien à remplacer.
  if (hadController) {
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      location.reload()
    })
  }
}
