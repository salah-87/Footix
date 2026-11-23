# Footix – Sécurité et tests

## 1. Menaces, protections et preuves
| Menace | Protection mise en place | Preuve (test) |
|---|---|---|
| Injection SQL | Requêtes paramétrées (`$1`, `$2`) ; validation Joi ; un seul fichier de repositories contient du SQL | E-mail `' OR 1=1 --` → 400 ; mot de passe `' OR '1'='1` → 401 ; `seatIds: ['1 OR 1=1']` → 400 ; `/matches/1;DROP TABLE tickets` → 400 |
| Injection NoSQL | Champ validé comme chaîne ; filtre construit à partir d'un objet | `?action[$ne]=x` → 400 ; `token: {$ne: null}` → 400 |
| Affectation de masse (mass assignment) | `stripUnknown` ; le rôle n'existe pas dans le schéma d'inscription ; le repository n'accepte pas de rôle | Inscription avec `role: admin` → compte spectateur. Test de mutation : la faille n'apparaît que si les **trois** couches sont cassées |
| Contrôle d'accès défaillant | Middleware `authorize(role)` sur chaque route sensible | 4 routes admin × 3 profils (anonyme 401, spectateur 403, contrôleur 403) |
| Accès à la donnée d'un autre (IDOR) | `user_id` dans la requête SQL ; réponse 404 identique | Le QR d'un autre utilisateur → 404 |
| Vol ou falsification de jeton de connexion | Algorithme HS256 imposé ; expiration 1 h ; secret en variable d'environnement | Jetons : aléatoire, autre secret, expiré, `alg: none` → tous 401 |
| Faux QR code | Jeton signé avec un secret **distinct** de celui du login | QR signé avec un autre secret → 400 ; QR modifié après signature → 400 ; `alg: none` → 400 |
| Double vente d'une place | Contrainte `UNIQUE (match_id, seat_id)` + transaction | 15 achats simultanés de la même place → 1 succès, 14 × 409, 1 seul billet en base |
| Double utilisation d'un billet | `UPDATE … WHERE status='valid'` atomique | 10 scans simultanés → 1 accepté, 9 refusés |
| Force brute sur le login | Limite de tentatives par IP | 4e tentative → 429 |
| Énumération des comptes | Même réponse et même durée (hash factice) pour e-mail inconnu et mauvais mot de passe | Les deux réponses sont strictement identiques |
| Fuite de données sensibles | Le hash n'est jamais renvoyé ; aucun mot de passe dans les journaux ; compte de lecture sans accès aux hashs | Tests sur les réponses et sur les logs MongoDB |
| Fuite d'informations techniques | Erreurs 500 génériques, pas de stack trace ; en-tête `X-Powered-By` supprimé | Test JSON invalide, route inconnue |
| Requêtes trop volumineuses | `express.json({ limit: '10kb' })` | Corps de 20 Ko → 413 |
| Secrets dans le code | Variables d'environnement ; démarrage refusé en production si secrets faibles ou identiques | `config/env.js` |
| Injection de code dans la page (XSS) | Les données de l'API sont insérées avec `textContent` et `setAttribute`, jamais `innerHTML` ; politique CSP stricte : scripts, styles et polices uniquement depuis le serveur, aucun script ni style en ligne | Test : la CSP n'autorise ni `unsafe-inline` ni source externe ; les pages ne contiennent ni script en ligne, ni attribut `style`, ni `onclick` |
| Intégration du site dans une page piège (clickjacking) | `frame-ancestors 'none'` | Test sur l'en-tête CSP |
| Redirection ouverte après connexion | `safeReturn()` n'accepte qu'un chemin local (`/billets`), jamais `//site.com` ni `https://…` | Parcours navigateur : `?retour=//exemple-pirate.com` ramène à l'accueil |
| Masquage des liens pris pour de la sécurité | Les liens sont masqués selon le rôle pour le confort ; le serveur revérifie chaque droit | Parcours navigateur : un contrôleur qui ouvre `/admin` voit un refus, l'API répond 403 |
| Compte applicatif trop puissant | Rôle `footix_app` sans droits `DROP`, `ALTER` | `DROP TABLE` refusé, vérifié en SQL |

## 2. Inventaire des tests (comptés par Jest)
| Fichier | Contenu | Tests |
|---|---|---|
| `auth.test.js` | Inscription, hachage, connexion, validation, jetons falsifiés | 19 |
| `orders.test.js` | Catalogue, achat, prix côté serveur, atomicité, rollback, concurrence | 15 |
| `scan.test.js` | QR code, contrôle d'accès, usage unique, faux et modifiés, match annulé, scans simultanés | 14 |
| `admin.test.js` | Rôles, création de match, transitions de statut, liste et données de référence, en-têtes HTTP | 24 |
| `ratelimit.test.js` | Limitation du login | 1 |
| `front.test.js` | Pages servies, CSP stricte, absence de script et de style en ligne, fichiers statiques | 9 |
| `mongo.integration.test.js` | Journaux d'audit et de scans avec une vraie connexion MongoDB | 5 |

**Total : 87 tests, tous réussis** (82 sans MongoDB, 5 de plus avec). Couverture du serveur mesurée avec MongoDB : 91 % des instructions, 79 % des branches, 92 % des fonctions.

**Tests de l'interface dans un vrai navigateur (Chromium, Playwright) :** achat complet par un visiteur qui se connecte en cours de route (sélection conservée), affichage du QR code, scan accepté puis refusé, faux billet refusé, accès refusé à un contrôleur sur l'administration, redirection ouverte bloquée, aucun débordement horizontal sur mobile (iPhone 13). **Audit d'accessibilité axe-core (WCAG 2.1 AA + bonnes pratiques) : aucune violation sur les 6 pages.** Ce parcours a trouvé 3 vrais défauts, corrigés : la tribune « Ouest » placée à l'Est (le mot contient « est »), une page plus large que l'écran sur mobile, un champ de date qui débordait dans l'administration.

Lancer : `npm test` (PostgreSQL requis, base `footix_test`). Avec MongoDB : `MONGO_TEST_URL=mongodb://localhost:27017/footix_test npm test`.

## 3. Tests de mutation (vérifier que les tests détectent les vrais bugs)
Un test qui ne peut jamais échouer ne prouve rien. J'ai cassé volontairement trois protections :
| Mutation | Résultat |
|---|---|
| Suppression de la contrainte `UNIQUE (match_id, seat_id)` | **3 tests échouent** (dont la concurrence) |
| Scan sans `AND status = 'valid'` | **2 tests échouent** (usage unique et scans simultanés) |
| Le rôle envoyé par le client est accepté (schéma + service + repository) | **1 test échoue** |
Le code a ensuite été restauré : 75/75.

## 4. Limites connues (honnêtes)
- **Pas de révocation de jeton :** un jeton volé reste valable jusqu'à son expiration (1 h) ; le rôle est lu dans le jeton, donc un changement de rôle n'est effectif qu'à la reconnexion. Amélioration : jetons courts + jeton de rafraîchissement révocable.
- **Inscription :** l'erreur `EMAIL_TAKEN` révèle qu'un e-mail existe. Compromis courant ; amélioration : confirmation par e-mail.
- **Limitation du login en mémoire :** elle ne se partage pas entre plusieurs instances (Redis en production), et derrière un reverse proxy il faut configurer `trust proxy`, sinon toutes les requêtes semblent venir de la même IP.
- **Jeton dans `sessionStorage` :** il disparaît à la fermeture de l'onglet, mais reste lisible par un script en cas de faille XSS. La CSP stricte et l'usage de `textContent` réduisent ce risque ; l'amélioration serait un cookie `HttpOnly`, `Secure`, `SameSite=Strict` posé par le serveur (avec protection CSRF).
- **HTTPS :** non géré par l'API ; il doit être assuré par un reverse proxy (nginx, Traefik…).
- **Docker Compose :** les fichiers sont valides (YAML vérifié) mais n'ont **pas été exécutés** dans mon environnement : à tester sur votre machine.
- **MongoDB :** testé avec FerretDB (compatible protocole MongoDB, stockage PostgreSQL), pas avec MongoDB lui-même ; à confirmer avec `docker compose up`.
- **Comptes de démonstration et mots de passe de développement :** à supprimer ou changer en production (retirer `03_seed.sql`).
- **Paiement :** simulé (hors périmètre).
