# Footix – Base de données

## 1. Choix des deux moteurs
| Besoin | Moteur | Pourquoi |
|---|---|---|
| Matchs, places, commandes, billets, utilisateurs | **PostgreSQL** (relationnel) | Relations fortes, contraintes d'intégrité, transactions ACID : indispensable pour ne jamais vendre deux fois la même place |
| Journal d'audit, journal des scans | **MongoDB** (NoSQL, documents) | Écriture massive, structure souple (`details`), aucune jointure, perte tolérable sans conséquence métier |

## 2. Schéma conceptuel (MCD)
Le stade est découpé comme dans la billetterie des grands clubs : **stade → tribunes → blocs → places**. Chaque bloc appartient à une **catégorie** (Hospitalité VIP, Catégorie 1, 2, 3, Virage Kop, Parcage visiteurs) et le prix est fixé **par catégorie et par match**.
```mermaid
erDiagram
  USERS ||--o{ ORDERS : "passe"
  ORDERS ||--|{ TICKETS : "contient"
  MATCHES ||--o{ TICKETS : "concerne"
  SEATS ||--o{ TICKETS : "est vendue via"
  USERS ||--o{ TICKETS : "contrôle (used_by)"
  STADIUMS ||--|{ STANDS : "est divisé en"
  STANDS ||--|{ SECTORS : "est découpée en blocs"
  SEAT_CATEGORIES ||--o{ SECTORS : "classe"
  SECTORS ||--|{ SEATS : "contient"
  STADIUMS ||--o{ MATCHES : "accueille"
  TEAMS ||--o{ MATCHES : "joue à domicile"
  TEAMS ||--o{ MATCHES : "joue à l'extérieur"
  MATCHES ||--o{ MATCH_CATEGORY_PRICES : "fixe un tarif"
  SEAT_CATEGORIES ||--o{ MATCH_CATEGORY_PRICES : "est tarifée"

  USERS { int id PK  string email  string password_hash  string role }
  MATCHES { int id PK  datetime kickoff_at  string status }
  TICKETS { int id PK  int price_cents  string status  datetime used_at }
  STANDS { int id PK  string name  string position }
  SECTORS { int id PK  string code  string name  string tier  int position_index }
  SEAT_CATEGORIES { int id PK  string code  string name  string description  string color }
  SEATS { int id PK  int row_number  int seat_number  bool is_accessible }
  MATCH_CATEGORY_PRICES { int match_id PK  int category_id PK  int price_cents }
```
`MATCH_CATEGORY_PRICES` est une association « plusieurs à plusieurs » portant un attribut (le prix) : un match a un prix par catégorie, une catégorie a un prix différent à chaque match (l'affiche contre Bordeaux est plus chère). **Une catégorie sans ligne de prix n'est pas vendue en ligne pour ce match** : c'est le cas du parcage visiteurs, dont les billets sont vendus par le club adverse.

### Le stade de démonstration
| Tribune | Anneau bas | Loges | Anneau haut |
|---|---|---|---|
| Nord (latérale) | N1 à N5 : Cat. 2, Cat. 1 ×3, Cat. 2 | – | NH1 à NH5 : Cat. 3, Cat. 2 ×3, Cat. 3 |
| Sud (présidentielle) | S1 à S5 : comme Nord | L1 à L3 : **Hospitalité VIP** | SH1 à SH5 : comme Nord |
| Ouest (virage) | O1, O2 : **Kop** | – | OH1, OH2 : Kop |
| Est (virage) | E1 : Cat. 3, E2 : **parcage visiteurs** | – | EH1 : Cat. 3, EH2 : parcage |

31 blocs, 2 668 places, dont 8 places PMR (fauteuil roulant) au rang 1 des blocs N3, S3, E1 et O1, accès de plain-pied.

## 3. Schéma physique (MPD) – résumé
| Table | Clé primaire | Clés étrangères | Contraintes importantes |
|---|---|---|---|
| `users` | `id` | – | `role IN (spectator, controller, admin)` ; unicité sur `lower(email)` |
| `stadiums` | `id` | – | `UNIQUE (name, city)` |
| `stands` | `id` | `stadium_id` | `UNIQUE (stadium_id, name)`, `UNIQUE (stadium_id, position)`, `position IN (nord, sud, est, ouest)` |
| `seat_categories` | `id` | – | `code UNIQUE` ; `color` au format `#rrggbb` (contrôle par expression régulière) |
| `sectors` | `id` | `stand_id`, `category_id` | `UNIQUE (stand_id, code)`, `UNIQUE (stand_id, tier, position_index)`, `tier IN (bas, loge, haut)` |
| `seats` | `id` | `sector_id` | `UNIQUE (sector_id, row_number, seat_number)`, valeurs > 0, `is_accessible` (PMR) |
| `teams` | `id` | – | `name UNIQUE` |
| `matches` | `id` | `stadium_id`, `home_team_id`, `away_team_id` | `home_team_id <> away_team_id` ; `status IN (draft, on_sale, cancelled)` |
| `match_category_prices` | `(match_id, category_id)` | `match_id`, `category_id` | `price_cents >= 0` |
| `orders` | `id` | `user_id` | `total_cents >= 0` |
| `tickets` | `id` | `order_id`, `match_id`, `seat_id`, `used_by` | **`UNIQUE (match_id, seat_id)`** ; `status IN (valid, used)` ; `tariff IN (plein, reduit)` |

Script complet : `db/01_schema.sql`.

## 4. Règles de nommage
Tables au pluriel, en minuscules avec `_` (`match_category_prices`) ; colonnes en `snake_case` ; clés étrangères nommées `<table au singulier>_id` ; contraintes nommées explicitement quand le code les utilise (`tickets_match_seat_unique`) ; montants en **centimes** (entiers) pour éviter les erreurs d'arrondi des nombres décimaux.

## 5. Normalisation (3FN)
- Aucune donnée répétée : le nom du stade n'est pas copié dans chaque match, il est référencé.
- Le prix par catégorie et par match a sa propre table : il ne dépend ni du match seul, ni de la catégorie seule, mais des deux (clé composée).
- La catégorie est portée par le **bloc**, pas par la place : toutes les places d'un bloc ont la même catégorie, la répéter sur chaque place créerait une redondance.
- Le libellé, la description et la couleur d'une catégorie sont dans `seat_categories`, une seule fois.
- Seule redondance volontaire : `tickets.price_cents` conserve **le prix payé**. Si le tarif change plus tard, l'historique reste exact.

## 6. L'intégrité garantie par la base elle-même
La contrainte `tickets_match_seat_unique` est la protection centrale. Même si le code de l'application contenait un bug, ou si deux requêtes arrivaient exactement en même temps, PostgreSQL refuse la seconde insertion (erreur `23505`). Le code ne fait que traduire cette erreur en réponse `409 SEAT_ALREADY_SOLD`.

## 7. Utilisateurs de la base et droits (moindre privilège)
| Compte | Droits | Utilisé par |
|---|---|---|
| `footix_owner` / `footix` (propriétaire) | Tous (création et modification des tables) | Scripts d'installation, sauvegarde et restauration |
| `footix_app` | `SELECT, INSERT, UPDATE, DELETE` sur les tables ; **pas** de `CREATE`, `DROP`, `ALTER` | **L'API** |
| `footix_readonly` | `SELECT` uniquement ; **pas d'accès** à `users.password_hash` | Reporting |

Vérifié pour de vrai : le compte `footix_app` reçoit `must be owner of table tickets` quand il tente un `DROP TABLE`, et `footix_readonly` reçoit `permission denied for table users`. Script : `db/02_roles.sql`.

## 8. Sauvegarde et restauration (procédure testée)
```bash
DATABASE_URL=postgres://… ./scripts/backup.sh                  # crée backups/footix_<date>.dump
DATABASE_URL=postgres://… ./scripts/restore.sh backups/xxx.dump
```
Test réalisé : après sauvegarde, suppression des tables `tickets` et `orders` et des places, la restauration a retrouvé toutes les places et le ticket. En production : sauvegarde planifiée (cron), copie hors du serveur, et test de restauration régulier.

## 9. MongoDB
| Collection | Champs | Index |
|---|---|---|
| `auditlogs` | `action`, `actorId`, `actorRole`, `details` (document libre), `createdAt` | `action`, `createdAt` |
| `scanlogs` | `ticketId`, `matchId`, `controllerId`, `result` (accepted, already_used, invalid_signature, unknown_ticket, match_cancelled), `createdAt` | `matchId`, `createdAt` |

Règle : une panne de MongoDB ne bloque jamais une vente (les fonctions de journalisation avalent leurs erreurs). Aucun mot de passe ni jeton n'est écrit dans ces journaux (vérifié par un test).
