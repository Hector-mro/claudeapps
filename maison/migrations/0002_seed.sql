-- Seed : un foyer de deux adultes sans enfants.
--
-- La répartition des domaines ci-dessous est un point de départ arbitraire.
-- Elle n'a de sens qu'une fois rediscutée à deux : c'est exactement ce que
-- fait l'écran de revue hebdomadaire (réassignation au niveau du domaine).
--
-- Les dates sont posées en relatif (date('now', '±N days')) pour que le jeu
-- d'essai reste pertinent quel que soit le jour du seed. « now » est en UTC ;
-- un décalage d'un jour entre minuit et 2 h du matin est sans conséquence ici.

INSERT INTO people (id, name, color) VALUES
  (1, 'Hector', '#b45309'),
  (2, 'Nina',   '#0e7490');

-- Jeton non devinable : 128 bits d'aléa, généré à l'installation.
-- `npm run db:token` le relit.
INSERT INTO household (id, display_token, weekly_review_weekday) VALUES
  (1, lower(hex(randomblob(16))), 0);   -- revue le dimanche

INSERT INTO domains (id, name, owner_id, minimum_standard, active) VALUES
  (1, 'Poubelles',                1, 'Aucun sac fermé ne passe la nuit dans la cuisine.',                    1),
  (2, 'Vaisselle',                 1, 'L''évier est vide avant d''aller se coucher.',                          1),
  (3, 'Rangement',                 2, 'Les surfaces du salon sont dégagées quand on éteint la lumière.',       1),
  (4, 'Lessive',                   2, 'Rien ne dort plus de 24 h dans la machine.',                            1),
  (5, 'Courses',                   1, 'Il n''y a jamais deux matins de suite sans petit-déjeuner possible.',   1),
  (6, 'Draps',                     2, 'On ne dort pas plus de deux semaines dans les mêmes draps.',            1),
  (7, 'Aspirateur',                1, 'Pas de moutons visibles au sol dans les pièces de vie.',                1),
  (8, 'Toilettes et salle de bain',2, 'Une cuvette et un lavabo qu''on montre sans gêne à quelqu''un qui passe.',1),
  (9, 'Sols',                      1, 'Aucune trace collante sous les pieds nus dans la cuisine.',             1);

INSERT INTO tasks
  (id, domain_id, title, kind, trigger_cue, interval_days, next_due_on, estimated_minutes, effort, active, created_at)
VALUES
  -- Poubelles
  (1, 1, 'Sortir la poubelle',              'recurring', 'Avant de te mettre au lit, la veille de la collecte',          7,  date('now'),            5,  'low',  1, datetime('now')),
  (2, 1, 'Descendre le verre',              'recurring', 'Quand tu charges le coffre pour partir aux courses',           14, date('now', '+4 days'), 10, 'low',  1, datetime('now')),

  -- Vaisselle
  (3, 2, 'Vider le lave-vaisselle',         'recurring', 'En attendant que le café passe, le matin',                     2,  date('now'),            5,  'low',  1, datetime('now')),
  (4, 2, 'Récurer l''évier et le plan de travail', 'recurring', 'Une fois le dîner rangé, avant de passer au salon',      4,  date('now', '-1 days'), 10, 'low',  1, datetime('now')),

  -- Rangement
  (5, 3, 'Dégager la table basse',          'recurring', 'En rentrant du travail, avant de poser ton sac',               3,  date('now'),            5,  'low',  1, datetime('now')),
  (6, 3, 'Trier la pile de courrier',       'recurring', 'Avec le café du samedi matin, assis à table',                  14, date('now', '+5 days'), 15, 'low',  1, datetime('now')),

  -- Lessive
  (7, 4, 'Lancer une machine',              'recurring', 'Le soir, en sortant de la douche',                             3,  date('now', '-2 days'), 5,  'low',  1, datetime('now')),
  (8, 4, 'Plier et ranger le linge sec',    'recurring', 'Quand tu allumes une série le soir, le panier devant toi',     4,  date('now'),            25, 'high', 1, datetime('now')),

  -- Courses
  (9, 5, 'Courses de la semaine',           'recurring', 'Le samedi matin, avant que le quartier se réveille',           7,  date('now', '+2 days'), 60, 'high', 1, datetime('now')),
  (10,5, 'Compléter le frais en milieu de semaine', 'recurring', 'En rentrant du travail, avant de monter',              7,  date('now'),            20, 'low',  1, datetime('now')),

  -- Draps
  (11,6, 'Changer les draps du lit',        'recurring', 'Le matin où tu lances la première machine du week-end',        14, date('now', '+3 days'), 20, 'high', 1, datetime('now')),

  -- Aspirateur
  (12,7, 'Aspirateur dans les pièces de vie','recurring','Quand la musique du samedi est lancée',                        7,  date('now', '-1 days'), 30, 'high', 1, datetime('now')),
  (13,7, 'Aspirateur chambre et couloir',   'recurring', 'Juste après avoir changé les draps',                           14, date('now', '+3 days'), 20, 'high', 1, datetime('now')),

  -- Toilettes et salle de bain
  (14,8, 'Nettoyer les toilettes',          'recurring', 'Pendant que l''eau de la douche chauffe',                      7,  date('now'),            10, 'low',  1, datetime('now')),
  (15,8, 'Récurer la douche et le lavabo',  'recurring', 'En sortant de la douche du dimanche, tant que c''est humide',  14, date('now', '+6 days'), 25, 'high', 1, datetime('now')),

  -- Sols
  (16,9, 'Laver le sol de la cuisine',      'recurring', 'Pendant que la machine tourne, en attendant la fin du cycle',  10, date('now', '-9 days'), 20, 'high', 1, datetime('now')),

  -- Ponctuelle : disparaît une fois cochée
  (17,5, 'Rapporter les ampoules usagées',  'oneoff',    NULL,                                                           NULL, date('now'),          10, 'low',  1, datetime('now'));

-- Un peu d'historique, pour que la revue hebdomadaire ait quelque chose à montrer
-- dès le premier lancement.
INSERT INTO completions (task_id, person_id, done_at, skipped) VALUES
  (3,  1, datetime('now', '-1 days'), 0),
  (5,  2, datetime('now', '-1 days'), 0),
  (7,  2, datetime('now', '-2 days'), 0),
  (1,  1, datetime('now', '-3 days'), 0),
  (8,  2, datetime('now', '-3 days'), 1),   -- repoussée
  (8,  2, datetime('now', '-5 days'), 1),   -- repoussée une seconde fois
  (12, 1, datetime('now', '-6 days'), 0),
  (3,  2, datetime('now', '-4 days'), 0);
