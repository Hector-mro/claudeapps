/* Undercover — Banque de mots
 * Chaque entrée est une PAIRE de mots proches : n'importe lequel des deux
 * peut devenir le mot des civils ou celui de l'undercover (tirage aléatoire).
 * d = difficulté : 1 = facile (mots assez différents), 2 = moyen, 3 = corsé (très proches)
 */
(function (global) {
  'use strict';

  var CATEGORIES = [
    { id: 'food',         name: 'Nourriture & boissons', emoji: '🍔' },
    { id: 'animals',      name: 'Animaux',               emoji: '🦊' },
    { id: 'objects',      name: 'Objets du quotidien',   emoji: '🪑' },
    { id: 'places',       name: 'Lieux',                 emoji: '🏝️' },
    { id: 'sports',       name: 'Sports & loisirs',      emoji: '⚽' },
    { id: 'jobs',         name: 'Métiers',               emoji: '👩‍🚒' },
    { id: 'nature',       name: 'Nature & météo',        emoji: '🌦️' },
    { id: 'transport',    name: 'Transports',            emoji: '🚗' },
    { id: 'body',         name: 'Corps & santé',         emoji: '🖐️' },
    { id: 'culture',      name: 'Culture & spectacle',   emoji: '🎬' },
    { id: 'clothes',      name: 'Vêtements',             emoji: '🧢' },
    { id: 'tech',         name: 'Technologie',           emoji: '📱' },
    { id: 'abstract',     name: 'Idées & émotions',      emoji: '💭' },
    { id: 'celebrations', name: 'Fêtes & occasions',     emoji: '🎉' },
    { id: 'custom',       name: 'Mes mots',              emoji: '✍️' }
  ];

  // [ mot A, mot B, catégorie, difficulté ] — paires françaises
  var RAW_FR = [
    ['Fraise', 'Framboise', 'food', 2],
    ['Banane', 'Mangue', 'food', 1],
    ['Pizza', 'Quiche', 'food', 2],
    ['Hamburger', 'Sandwich', 'food', 2],
    ['Café', 'Thé', 'food', 1],
    ['Chocolat', 'Caramel', 'food', 2],
    ['Baguette', 'Croissant', 'food', 1],
    ['Pâtes', 'Riz', 'food', 1],
    ['Frites', 'Chips', 'food', 2],
    ['Crêpe', 'Gaufre', 'food', 2],
    ['Glace', 'Sorbet', 'food', 3],
    ['Yaourt', 'Fromage blanc', 'food', 3],
    ['Ketchup', 'Mayonnaise', 'food', 2],
    ['Soupe', 'Bouillon', 'food', 3],
    ['Miel', 'Confiture', 'food', 2],
    ['Vin', 'Bière', 'food', 1],
    ['Sushi', 'Maki', 'food', 3],
    ['Tarte', 'Gâteau', 'food', 2],
    ['Œuf', 'Omelette', 'food', 2],
    ['Citron', 'Orange', 'food', 1],
    ['Sel', 'Poivre', 'food', 1],
    ['Popcorn', 'Barbe à papa', 'food', 2],
    ['Bonbon', 'Chewing-gum', 'food', 2],
    ['Pain', 'Brioche', 'food', 2],

    ['Chat', 'Chien', 'animals', 1],
    ['Lion', 'Tigre', 'animals', 2],
    ['Loup', 'Renard', 'animals', 2],
    ['Aigle', 'Faucon', 'animals', 3],
    ['Requin', 'Dauphin', 'animals', 1],
    ['Grenouille', 'Crapaud', 'animals', 3],
    ['Papillon', 'Libellule', 'animals', 2],
    ['Abeille', 'Guêpe', 'animals', 3],
    ['Cheval', 'Âne', 'animals', 2],
    ['Lapin', 'Lièvre', 'animals', 3],
    ['Souris', 'Rat', 'animals', 3],
    ['Tortue', 'Escargot', 'animals', 2],
    ['Serpent', 'Anguille', 'animals', 2],
    ['Pingouin', 'Manchot', 'animals', 3],
    ['Vache', 'Chèvre', 'animals', 1],
    ['Singe', 'Gorille', 'animals', 2],
    ['Poule', 'Canard', 'animals', 1],
    ['Crocodile', 'Alligator', 'animals', 3],
    ['Hibou', 'Chouette', 'animals', 3],
    ['Éléphant', 'Rhinocéros', 'animals', 2],

    ['Parapluie', 'Ombrelle', 'objects', 3],
    ['Brosse à dents', 'Peigne', 'objects', 2],
    ['Savon', 'Shampoing', 'objects', 2],
    ['Miroir', 'Fenêtre', 'objects', 2],
    ['Chaise', 'Tabouret', 'objects', 2],
    ['Canapé', 'Lit', 'objects', 1],
    ['Bougie', 'Lampe', 'objects', 2],
    ['Ciseaux', 'Couteau', 'objects', 2],
    ['Stylo', 'Crayon', 'objects', 2],
    ['Cahier', 'Agenda', 'objects', 2],
    ['Sac à dos', 'Valise', 'objects', 1],
    ['Clé', 'Cadenas', 'objects', 2],
    ['Balai', 'Aspirateur', 'objects', 1],
    ['Éponge', 'Serviette', 'objects', 2],
    ['Réveil', 'Montre', 'objects', 2],
    ['Portefeuille', 'Trousse', 'objects', 2],
    ['Oreiller', 'Couverture', 'objects', 2],

    ['Plage', 'Piscine', 'places', 1],
    ['Montagne', 'Colline', 'places', 2],
    ['Forêt', 'Jungle', 'places', 2],
    ['Hôtel', 'Auberge', 'places', 2],
    ['Restaurant', 'Cantine', 'places', 2],
    ['Hôpital', 'Pharmacie', 'places', 1],
    ['École', 'Université', 'places', 1],
    ['Musée', 'Bibliothèque', 'places', 2],
    ['Cinéma', 'Théâtre', 'places', 1],
    ['Château', 'Palais', 'places', 3],
    ['Île', 'Presqu’île', 'places', 3],
    ['Marché', 'Supermarché', 'places', 2],
    ['Aéroport', 'Gare', 'places', 1],
    ['Parc', 'Jardin', 'places', 2],

    ['Football', 'Rugby', 'sports', 1],
    ['Tennis', 'Badminton', 'sports', 2],
    ['Ski', 'Snowboard', 'sports', 2],
    ['Natation', 'Plongée', 'sports', 2],
    ['Boxe', 'Judo', 'sports', 2],
    ['Vélo', 'Trottinette', 'sports', 1],
    ['Course à pied', 'Marche', 'sports', 2],
    ['Basket', 'Handball', 'sports', 2],
    ['Golf', 'Mini-golf', 'sports', 3],
    ['Yoga', 'Pilates', 'sports', 3],
    ['Échecs', 'Dames', 'sports', 2],
    ['Karaoké', 'Concert', 'sports', 2],
    ['Escalade', 'Randonnée', 'sports', 2],

    ['Médecin', 'Infirmier', 'jobs', 2],
    ['Policier', 'Gendarme', 'jobs', 3],
    ['Professeur', 'Formateur', 'jobs', 3],
    ['Cuisinier', 'Boulanger', 'jobs', 2],
    ['Pilote', 'Chauffeur', 'jobs', 2],
    ['Avocat', 'Juge', 'jobs', 2],
    ['Pompier', 'Sauveteur', 'jobs', 2],
    ['Coiffeur', 'Barbier', 'jobs', 3],
    ['Acteur', 'Mannequin', 'jobs', 2],
    ['Journaliste', 'Écrivain', 'jobs', 2],
    ['Astronaute', 'Explorateur', 'jobs', 2],
    ['Facteur', 'Livreur', 'jobs', 3],

    ['Pluie', 'Neige', 'nature', 1],
    ['Soleil', 'Lune', 'nature', 1],
    ['Rivière', 'Fleuve', 'nature', 3],
    ['Volcan', 'Geyser', 'nature', 2],
    ['Arc-en-ciel', 'Aurore boréale', 'nature', 2],
    ['Sable', 'Terre', 'nature', 2],
    ['Feuille', 'Pétale', 'nature', 2],
    ['Nuage', 'Brouillard', 'nature', 2],
    ['Tempête', 'Ouragan', 'nature', 3],
    ['Étoile', 'Planète', 'nature', 1],
    ['Cactus', 'Palmier', 'nature', 2],
    ['Rose', 'Tulipe', 'nature', 2],

    ['Voiture', 'Moto', 'transport', 1],
    ['Train', 'Métro', 'transport', 2],
    ['Avion', 'Hélicoptère', 'transport', 1],
    ['Bateau', 'Sous-marin', 'transport', 2],
    ['Bus', 'Tramway', 'transport', 2],
    ['Fusée', 'Navette spatiale', 'transport', 3],
    ['Taxi', 'Ambulance', 'transport', 2],
    ['Skateboard', 'Rollers', 'transport', 2],

    ['Main', 'Pied', 'body', 1],
    ['Œil', 'Oreille', 'body', 1],
    ['Cheveux', 'Barbe', 'body', 2],
    ['Sourire', 'Rire', 'body', 3],
    ['Sommeil', 'Sieste', 'body', 2],
    ['Rhume', 'Grippe', 'body', 3],
    ['Vaccin', 'Piqûre', 'body', 3],

    ['Guitare', 'Ukulélé', 'culture', 3],
    ['Piano', 'Orgue', 'culture', 2],
    ['Batterie', 'Tambour', 'culture', 3],
    ['Film', 'Série', 'culture', 1],
    ['Roman', 'Bande dessinée', 'culture', 2],
    ['Magicien', 'Illusionniste', 'culture', 3],
    ['Clown', 'Mime', 'culture', 2],
    ['Superhéros', 'Chevalier', 'culture', 2],
    ['Zombie', 'Vampire', 'culture', 2],
    ['Fantôme', 'Sorcière', 'culture', 2],
    ['Dessin animé', 'Manga', 'culture', 2],
    ['Selfie', 'Photo', 'culture', 3],

    ['Chapeau', 'Casquette', 'clothes', 2],
    ['Écharpe', 'Foulard', 'clothes', 3],
    ['Chaussettes', 'Collants', 'clothes', 2],
    ['Baskets', 'Sandales', 'clothes', 1],
    ['Jean', 'Pantalon', 'clothes', 3],
    ['Robe', 'Jupe', 'clothes', 2],
    ['Manteau', 'Veste', 'clothes', 3],
    ['Lunettes', 'Masque', 'clothes', 2],
    ['Cravate', 'Nœud papillon', 'clothes', 2],

    ['Téléphone', 'Tablette', 'tech', 1],
    ['Ordinateur', 'Console de jeux', 'tech', 1],
    ['Casque audio', 'Écouteurs', 'tech', 3],
    ['Télévision', 'Vidéoprojecteur', 'tech', 2],
    ['Robot', 'Drone', 'tech', 2],
    ['Wifi', 'Bluetooth', 'tech', 2],
    ['Email', 'SMS', 'tech', 2],
    ['Mot de passe', 'Empreinte digitale', 'tech', 2],
    ['Réseau social', 'Forum', 'tech', 2],

    ['Amour', 'Amitié', 'abstract', 2],
    ['Peur', 'Stress', 'abstract', 2],
    ['Rêve', 'Souvenir', 'abstract', 2],
    ['Mensonge', 'Secret', 'abstract', 2],
    ['Chance', 'Hasard', 'abstract', 3],
    ['Silence', 'Chuchotement', 'abstract', 2],
    ['Vacances', 'Week-end', 'abstract', 1],
    ['Retard', 'Absence', 'abstract', 2],

    ['Anniversaire', 'Mariage', 'celebrations', 1],
    ['Noël', 'Nouvel An', 'celebrations', 1],
    ['Halloween', 'Carnaval', 'celebrations', 2],
    ['Cadeau', 'Surprise', 'celebrations', 2],
    ['Feu d’artifice', 'Étincelle', 'celebrations', 2],
    ['Fête foraine', 'Cirque', 'celebrations', 2],
    ['Pique-nique', 'Barbecue', 'celebrations', 2],
    ['Baptême', 'Communion', 'celebrations', 3]
  ];

  // Paires anglaises, jouables via le réglage « langue des mots »
  var RAW_EN = [
    ['Strawberry', 'Raspberry', 'food', 2],
    ['Coffee', 'Tea', 'food', 1],
    ['Pancake', 'Waffle', 'food', 2],
    ['Honey', 'Jam', 'food', 2],
    ['Cake', 'Pie', 'food', 2],

    ['Cat', 'Dog', 'animals', 1],
    ['Wolf', 'Fox', 'animals', 2],
    ['Bee', 'Wasp', 'animals', 3],
    ['Whale', 'Dolphin', 'animals', 2],
    ['Crow', 'Raven', 'animals', 3],

    ['Pen', 'Pencil', 'objects', 2],
    ['Candle', 'Lamp', 'objects', 2],
    ['Key', 'Lock', 'objects', 2],

    ['Beach', 'Swimming pool', 'places', 1],
    ['Hotel', 'Hostel', 'places', 3],
    ['Castle', 'Palace', 'places', 3],

    ['Soccer', 'Rugby', 'sports', 2],
    ['Tennis', 'Badminton', 'sports', 2],
    ['Skiing', 'Snowboarding', 'sports', 2],

    ['Doctor', 'Nurse', 'jobs', 2],
    ['Chef', 'Baker', 'jobs', 2],
    ['Actor', 'Model', 'jobs', 2],

    ['Rain', 'Snow', 'nature', 1],
    ['Sun', 'Moon', 'nature', 1],
    ['Storm', 'Hurricane', 'nature', 3],

    ['Car', 'Motorbike', 'transport', 1],
    ['Train', 'Subway', 'transport', 2],
    ['Plane', 'Helicopter', 'transport', 1],

    ['Hand', 'Foot', 'body', 1],
    ['Sleep', 'Nap', 'body', 2],

    ['Ghost', 'Vampire', 'culture', 2],
    ['Movie', 'TV series', 'culture', 1],
    ['Guitar', 'Ukulele', 'culture', 3],

    ['Hat', 'Cap', 'clothes', 2],
    ['Scarf', 'Shawl', 'clothes', 3],

    ['Phone', 'Tablet', 'tech', 1],
    ['Headphones', 'Earbuds', 'tech', 3],
    ['Email', 'Text message', 'tech', 2],

    ['Love', 'Friendship', 'abstract', 2],
    ['Secret', 'Lie', 'abstract', 2],

    ['Birthday', 'Wedding', 'celebrations', 1],
    ['Christmas', 'New Year', 'celebrations', 1]
  ];

  function build(rows, prefix, lang) {
    return rows.map(function (row, i) {
      return { id: prefix + i, a: row[0], b: row[1], cat: row[2], diff: row[3], lang: lang, builtin: true };
    });
  }

  // Les identifiants français restent 'p0', 'p1'… : l'historique des paires déjà
  // tirées reste valable d'une version à l'autre.
  var PAIRS = build(RAW_FR, 'p', 'fr').concat(build(RAW_EN, 'e', 'en'));

  global.UC = global.UC || {};
  global.UC.CATEGORIES = CATEGORIES;
  global.UC.PAIRS = PAIRS;
  global.UC.LANGS = [
    { id: 'fr', name: 'Français' },
    { id: 'en', name: 'English' },
    { id: 'both', name: 'Les deux' }
  ];
  global.UC.categoryById = function (id) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].id === id) return CATEGORIES[i];
    }
    return { id: id, name: id, emoji: '❓' };
  };
})(window);
