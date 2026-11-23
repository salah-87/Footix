# Footix – Référence de l'API

Préfixe : `/api`. Format : JSON. Authentification : `Authorization: Bearer <token>`.
Format d'erreur unique : `{ "error": { "code": "…", "message": "…", "details": […] } }`.

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/health` | Public | Vérifier que l'API répond |
| POST | `/auth/register` | Public | Créer un compte (spectateur) |
| POST | `/auth/login` | Public (limité) | Obtenir un token |
| GET | `/auth/me` | Connecté | Mon profil |
| GET | `/matches` | Public | Matchs en vente et à venir |
| GET | `/matches/:id` | Public | Détail + disponibilité par tribune |
| GET | `/matches/:id/stands/:standId/seats` | Public | Plan de places (libre / vendue) |
| POST | `/orders` | Connecté | Acheter 1 à 6 places `{ matchId, seatIds[] }` |
| GET | `/orders/me` | Connecté | Mes commandes |
| GET | `/tickets/me` | Connecté | Mes billets |
| GET | `/tickets/:id/qr` | Propriétaire | QR code du billet (PNG en base64) et son contenu en texte |
| POST | `/scan` | Contrôleur, admin | Scanner un billet `{ token }` |
| GET | `/admin/matches` | Admin | Tous les matchs, quel que soit le statut, avec les billets vendus |
| GET | `/admin/reference` | Admin | Stades avec leurs tribunes, et équipes (formulaire de création) |
| POST | `/admin/matches` | Admin | Créer un match avec ses prix |
| PATCH | `/admin/matches/:id` | Admin | Changer la date ou le statut |
| GET | `/admin/audit?action=&limit=` | Admin | Journal d'audit (MongoDB) |
| GET | `/admin/scans?limit=` | Admin | Journal des scans (MongoDB) |

## Codes d'erreur métier
| HTTP | Code | Signification |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Données invalides (détails par champ) |
| 400 | `INVALID_TICKET` | QR code non signé par Footix |
| 401 | `MISSING_TOKEN`, `INVALID_TOKEN`, `INVALID_CREDENTIALS` | Authentification absente ou refusée |
| 403 | `FORBIDDEN` | Rôle insuffisant |
| 404 | `MATCH_NOT_FOUND`, `TICKET_NOT_FOUND`, `UNKNOWN_TICKET` | Ressource inexistante (ou pas la vôtre) |
| 409 | `SEAT_ALREADY_SOLD` | Une place vient d'être vendue |
| 409 | `MATCH_NOT_ON_SALE`, `MATCH_ALREADY_STARTED`, `MATCH_CANCELLED`, `INVALID_TRANSITION` | Règle de gestion non respectée |
| 409 | `TICKET_ALREADY_USED`, `EMAIL_TAKEN` | Doublon |
| 422 | `INVALID_SEATS`, `SAME_TEAM`, `UNKNOWN_TEAM`, `UNKNOWN_STADIUM`, `INVALID_STAND` | Données cohérentes en forme mais invalides métier |
| 429 | `TOO_MANY_ATTEMPTS` | Trop de tentatives de connexion |
| 503 | `LOGS_UNAVAILABLE` | MongoDB indisponible |

**Pourquoi 400, 409 et 422 ?** 400 : la requête est mal formée. 422 : bien formée mais impossible métier (une place d'un autre stade). 409 : conflit avec l'état actuel (place déjà vendue).
