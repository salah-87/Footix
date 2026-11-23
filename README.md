# Footix – API de billetterie de stade

Site et API REST de vente de places numérotées, avec billets à QR code signé et contrôle à l'entrée.
**Stack :** Node.js 22, Express 4, PostgreSQL 16 (données métier), MongoDB (journaux), Docker Compose, Jest + Supertest.

**Design :** style « Prestige » (blanc, bleu marine, filets dorés, titres Fraunces à empattements, texte Archivo), retenu après comparaison de quatre directions visuelles. `public/css/style.css` contient la structure et les composants ; `public/css/themes/prestige.css` contient l'identité visuelle. Polices hébergées sur le serveur. Maquettes, composants et schéma d'enchaînement dans Figma : https://www.figma.com/design/GmLCBwxayLOTuZ1m4TA9Qq (première direction visuelle, « nuit de match »).

## Démarrage rapide (Docker)
```bash
cp .env.example .env        # puis modifier les deux secrets
docker compose up --build
curl http://localhost:3000/api/health
```
Puis ouvrir **http://localhost:3000** dans le navigateur.

| Page | Adresse | Pour qui |
|---|---|---|
| Matchs en vente | `/` | Tout le monde |
| Plan du stade (blocs, catégories, VIP, PMR) et choix des places | `/match?id=1` | Tout le monde (achat : connecté) |
| Connexion, inscription | `/connexion` | Visiteurs |
| Mes billets et QR codes | `/billets` | Spectateurs |
| Contrôle à l'entrée | `/controle` | Contrôleurs, administrateurs |
| Administration | `/admin` | Administrateurs |
Comptes de démonstration (mot de passe `Passw0rd!demo`) : `admin@footix.test`, `controle@footix.test`, `fan@footix.test`.
⚠️ Mots de passe et données de démonstration : développement uniquement.

## Démarrage local (sans Docker)
1. Créer la base : `psql -f db/01_schema.sql`, puis `02_roles.sql`, puis `03_seed.sql`.
2. `cp .env.example .env` et adapter `DATABASE_URL` (et `MONGO_URL` si MongoDB tourne).
3. `npm install && npm run dev`

## Exemple de parcours
```bash
# 1. connexion
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"fan@footix.test","password":"Passw0rd!demo"}' | jq -r .token)
# 2. acheter deux places du match 1
curl -s -X POST localhost:3000/api/orders -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"matchId":1,"seatIds":[1,2]}'
# 3. récupérer le QR code du billet (PNG en base64)
curl -s localhost:3000/api/tickets/1/qr -H "Authorization: Bearer $TOKEN"
```

## Tests
```bash
npm test                                   # 96 tests (PostgreSQL, base footix_test)
MONGO_TEST_URL=mongodb://localhost:27017/footix_test npm test   # + 5 tests MongoDB = 101
npm run test:front                         # 6 tests unitaires des fonctions du navigateur
```

L'intégration continue (`.github/workflows/ci.yml`) relance tout à chaque `git push` :
PostgreSQL et MongoDB en conteneurs, `npm audit`, puis les tests.

## Sauvegarde / restauration
`./scripts/backup.sh` et `./scripts/restore.sh <fichier>` (voir `docs/02-base-de-donnees.md`).

## Structure
```
src/routes/        HTTP (routes fines)          src/services/      règles métier
src/repositories/  SQL uniquement               src/models/        MongoDB (journaux)
src/middlewares/   auth, rôles, validation      src/validation/    schémas Joi
db/                schéma, rôles, données       docs/              cahier des besoins, BDD, API, sécurité, fiches
public/            interface web : HTML, CSS (structure + thème Prestige), JavaScript sans framework, polices Archivo et Fraunces hébergées
```
## Documentation
`docs/01-cahier-des-besoins.md` · `02-base-de-donnees.md` · `03-api.md` · `04-securite-et-tests.md` · `fiches/revision-jury.md`
