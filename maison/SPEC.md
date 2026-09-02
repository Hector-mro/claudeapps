# Principes

Ces règles viennent de la recherche sur la charge mentale et sur la formation
d'habitudes. **Elles priment sur l'intuition de développeur** : quand une
décision technique est ambiguë, c'est ce document qui tranche, pas le confort
d'implémentation.

Le critère qui décide de tout : l'application doit retirer de la tête des deux
personnes le travail d'anticipation (« il faudrait penser à… ») et de
surveillance (« est-ce que ça a été fait ? »). Lister des tâches n'est pas le
but.

## Le système anticipe, l'humain décide

Personne ne doit saisir une tâche récurrente chaque semaine. Les récurrences
remontent seules. Si l'utilisateur doit alimenter une liste, l'application a
échoué.

## Un déclencheur contextuel, pas une heure

« En rentrant du travail, avant de poser mon sac » fonctionne. « Mardi 19 h »
est une alarme qu'on apprend à ignorer. `trigger_cue` est obligatoire à la
création d'une tâche récurrente — le schéma le refuse autrement — et c'est lui
qu'on affiche au mur, pas la date.

## Propriété entière, pas assignation ponctuelle

Un domaine a un propriétaire unique qui en assume la conception, la
planification et l'exécution. **On ne réassigne pas une tâche isolée à l'autre
personne au coup par coup** : ça recrée exactement la charge mentale qu'on veut
supprimer. Les réassignations se font au niveau du domaine, à la revue
hebdomadaire.

## Chaque domaine a un standard minimum écrit

Une phrase, décidée à deux, qui définit « fait ». Visible sur le téléphone
quand on ouvre une tâche. C'est ce qui évite le micromanagement et les disputes
sur la qualité.

## Aucun point, score, classement ou badge

Piège documenté : ça transforme le couple en comptabilité analytique et produit
du ressentiment. Une seule chose s'affiche, discrètement, dans la revue
hebdomadaire : le nombre de tâches accomplies par chacun sur 7 jours. Rien
d'autre.

## Le mur affiche au maximum 5 éléments

Plafond dur, codé en dur. Un mur qui affiche 14 tâches produit de l'évitement,
pas de l'action. Au-delà : on trie, on tronque, on mentionne « +N » sans les
lister.

## Aucune notification push, jamais

Le mur est le canal. Le téléphone sert à cocher, pas à harceler.

# Hors périmètre

À ne pas construire, même si ça semble utile : comptes utilisateurs,
notifications push, mode hors ligne, PWA installable, courses ou repas,
calendrier, intégration Google Calendar, statistiques et graphiques, thèmes
personnalisables, gamification sous quelque forme que ce soit, multi-foyers.

# Surfaces

## Mur — `/mur/:token`

Lecture seule. Aucun bouton, aucun scroll, aucun défilement automatique.
Rafraîchissement toutes les 60 s, mise à jour du DOM sans recharger la page —
et **sans redessiner la page entière** : sur un écran allumé en permanence,
les reflows visibles sont fatigants. On compare la réponse à l'état courant et
on ne touche au DOM que si le contenu a changé.

Contenu, dans cet ordre : le jour (et rien d'autre) ; « Aujourd'hui », jusqu'à
5 tâches avec le déclencheur, le titre et le prénom du propriétaire dans sa
couleur ; « Ça a glissé », les retards de plus de 7 jours, 3 au maximum, en
plus petit, section entièrement absente quand elle est vide. Rien d'autre : pas
de météo, pas d'horloge géante, pas de citation du jour.

Typographie lisible à trois mètres : titres à 40 px minimum sur une tablette
10". Fond clair le jour, thème très sombre et à faible contraste entre 22 h et
7 h pour ne pas éclairer le salon.

## Téléphone — `/app/:token`

Utilisable debout, d'une main, dans un couloir. Zone tactile d'au moins 48 px
par ligne, un tap coche. Ouvrir une tâche montre son domaine, son propriétaire
et le standard minimum. Deux actions : « fait » et « repoussé »
(`skipped = 1`, `next_due_on` décalé de 2 jours). Ajouter une tâche ponctuelle
en trois taps au maximum depuis l'ouverture de l'application.

## Revue hebdomadaire

Accessible depuis le menu, mise en avant le jour configuré. Elle montre les
tâches accomplies par chacun sur 7 jours, celles repoussées plus de deux fois,
et permet de réassigner le propriétaire d'un domaine ou de désactiver une
tâche. Une tâche repoussée trois fois est proposée à la suppression : si elle
n'est jamais faite, elle n'a pas sa place dans le système.
