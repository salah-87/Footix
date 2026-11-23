# Footix – Fiche de révision pour le jury

**Comment l'utiliser :** cache les réponses, réponds à voix haute avec tes mots, puis compare. L'objectif est d'expliquer, pas de réciter. Les phrases courtes en gras sont à retenir mot pour mot ; le reste, reformule.

---
## A. Présentation du projet (à dire en 1 minute)
> Footix est un site de billetterie pour un stade. Elle vend des places numérotées, génère un billet avec un QR code signé, et contrôle chaque billet une seule fois à l'entrée. Le point technique central est d'empêcher qu'une place soit vendue deux fois, même avec des achats simultanés. J'utilise PostgreSQL pour les données métier, MongoDB pour les journaux, Node/Express pour l'API, et Docker pour le déploiement.

**Pourquoi ce projet ?** Il couvre toutes les compétences back-end : base relationnelle, accès aux données SQL et NoSQL, composants métier, sécurité, tests, déploiement.

---
## B. Base de données
**1. Pourquoi PostgreSQL ET MongoDB ?**
Relationnel pour les données métier qui ont des relations strictes et besoin de transactions (places, commandes). NoSQL pour les journaux : écriture rapide, structure libre, pas de jointure, et une perte n'est pas critique.

**2. Comment empêches-tu de vendre deux fois la même place ?**
**Par une contrainte d'unicité sur (match, place) dans la table des billets.** Même si deux requêtes arrivent en même temps, la base accepte la première et refuse la seconde avec l'erreur 23505, que je transforme en réponse 409. Je ne dépends donc pas seulement de mon code.

**3. Pourquoi une transaction pour une commande ?**
Une commande crée une ligne `orders` et plusieurs `tickets`. Si l'un des billets échoue (place déjà prise), tout est annulé (ROLLBACK) : pas de commande à moitié créée. C'est le principe ACID : atomicité.

**4. Que veut dire ACID ?**
Atomicité (tout ou rien), Cohérence (les contraintes sont respectées), Isolation (les transactions simultanées ne se mélangent pas), Durabilité (une fois validé, c'est enregistré).

**5. Pourquoi stocker les prix en centimes ?**
Les nombres décimaux provoquent des erreurs d'arrondi (0,1 + 0,2 ≠ 0,3 en informatique). Les entiers sont exacts.

**6. Pourquoi une table `match_category_prices` ?**
Le prix dépend à la fois du match ET de la catégorie : c'est une association plusieurs-à-plusieurs avec un attribut. Mettre le prix dans `seat_categories` ou `matches` serait faux (3e forme normale). Comme dans les grands clubs, la même Catégorie 1 coûte 45 € contre Bordeaux et 38 € contre Creuse.

**7. Pourquoi `tickets.price_cents` alors que le prix existe déjà ailleurs ?**
Pour garder le prix payé : si le tarif change, l'historique reste juste. C'est une redondance volontaire.

**8. Qu'est-ce qu'une clé primaire, une clé étrangère ?**
Primaire : identifie une ligne de façon unique. Étrangère : référence la clé primaire d'une autre table et garantit qu'on ne pointe pas vers une ligne qui n'existe pas.

**9. Quels comptes de base de données as-tu créés ?**
Un propriétaire (crée les tables), `footix_app` (lit et écrit, ne peut pas supprimer de table), `footix_readonly` (lecture seule, sans accès aux mots de passe). C'est le principe du **moindre privilège** : si l'API est compromise, l'attaquant ne peut pas détruire le schéma.

**10. Comment sauvegardes-tu et restaures-tu ?**
`pg_dump` en format compressé, `pg_restore` pour restaurer. Je l'ai testé : après suppression de tables, la restauration a retrouvé toutes les données.

---
## C. Sécurité
**11. Comment protèges-tu les mots de passe ?**
Je ne les stocke jamais en clair : je stocke un **hash bcrypt**, avec un sel aléatoire et un coût de calcul volontairement lent. Un hash ne se « déchiffre » pas : on compare le hash du mot de passe saisi avec celui stocké.

**12. Hacher ou chiffrer, quelle différence ?**
Le chiffrement est réversible avec une clé ; le hachage est à sens unique. Pour un mot de passe, on n'a jamais besoin de le retrouver : on veut seulement le vérifier.

**13. À quoi sert le sel ?**
Il rend le hash différent pour deux utilisateurs ayant le même mot de passe, et empêche les attaques par tables précalculées.

**14. Pourquoi limiter le mot de passe à 72 caractères ?**
bcrypt n'utilise que les 72 premiers octets : accepter plus serait trompeur.

**15. Comment fonctionne l'authentification ?**
Au login, si le mot de passe est bon, le serveur renvoie un **JWT** signé (identifiant, rôle, expiration 1 h). Le client le renvoie dans l'en-tête `Authorization: Bearer`. À chaque requête, un middleware vérifie la signature et l'expiration.

**16. Un JWT est-il chiffré ?**
Non, il est **signé** : on peut le lire, mais pas le modifier sans invalider la signature. Il ne faut donc jamais y mettre d'information secrète.

**17. Pourquoi imposer l'algorithme HS256 à la vérification ?**
Pour refuser un jeton `alg: none` (non signé) ou signé avec un autre algorithme. Testé.

**18. Différence entre authentification et autorisation ?**
Authentification : qui es-tu ? (`authenticate`). Autorisation : as-tu le droit ? (`authorize('admin')`).

**19. Comment évites-tu les injections SQL ?**
**Requêtes paramétrées** : les valeurs passent séparément du texte SQL (`$1`, `$2`), elles ne sont jamais interprétées comme du SQL. Plus la validation des entrées avec Joi.

**20. Qu'est-ce que l'affectation de masse et comment l'évites-tu ?**
Un client envoie un champ qu'on n'attendait pas (`role: admin`). Je supprime les champs inconnus avec `stripUnknown`, et le rôle n'existe tout simplement pas dans le schéma d'inscription. Trois couches le bloquent.

**21. Pourquoi renvoyer le même message pour « e-mail inconnu » et « mauvais mot de passe » ?**
Pour ne pas permettre de découvrir quels e-mails ont un compte. Je fais aussi une comparaison bcrypt factice pour que le temps de réponse soit le même.

**22. Comment bloques-tu la force brute ?**
Une limite de tentatives par IP et par fenêtre de temps (réponse 429).

**23. Pourquoi le prix n'est-il jamais envoyé par le client ?**
Un client malveillant pourrait envoyer `priceCents: 1`. Le serveur lit toujours le prix en base. Testé.

**24. Pourquoi deux secrets (login et QR code) ?**
Séparation des usages : si l'un fuit, l'autre reste sûr, et un jeton de login ne peut pas servir de faux billet.

**25. Pourquoi une réponse 404 et non 403 quand on demande le QR d'un autre ?**
Un 403 confirmerait que ce billet existe. Un 404 identique évite de sonder les identifiants (IDOR).

---
## D. Composants métier
**26. Comment fonctionne le contrôle à l'entrée ?**
Je vérifie la signature du QR, puis que le billet existe, puis que le match n'est pas annulé, puis je marque le billet utilisé avec un `UPDATE … WHERE status='valid'`.

**27. Pourquoi cet `UPDATE` est-il atomique ?**
Le test « est-il encore valide ? » et la mise à jour sont **une seule opération**. Avec deux scans simultanés, un seul `UPDATE` trouve une ligne `valid`. Si je faisais d'abord un `SELECT` puis un `UPDATE`, les deux scans pourraient passer entre les deux (condition de concurrence).

**28. Pourquoi séparer routes, services et repositories ?**
Routes : HTTP seulement. Services : règles métier. Repositories : SQL seulement. Chaque couche se teste et se modifie sans toucher aux autres.

**29. Quelle différence entre les codes 400, 409 et 422 ?**
400 : requête mal formée. 422 : bien formée mais impossible métier. 409 : conflit avec l'état actuel (place déjà vendue).

**30. Que se passe-t-il si MongoDB tombe en panne ?**
Les ventes continuent : les fonctions de journalisation avalent leurs erreurs. Une vente ne doit pas échouer à cause d'un journal.

---
## E. Tests
**31. Qu'as-tu testé ?**
114 tests automatisés (108 Jest, 6 node:test) : authentification, validation, achat, concurrence, scan, rôles, en-têtes HTTP, limitation, journaux MongoDB, pages et CSP. Couverture de 95 % du code serveur. En plus, un parcours complet dans un vrai navigateur et un audit d'accessibilité.

**32. Comment prouves-tu qu'il n'y a pas de double vente ?**
Un test lance **15 achats simultanés** de la même place : exactement un réussit, 14 reçoivent 409, et la base ne contient qu'un seul billet.

**33. Comment sais-tu que tes tests ne sont pas faibles ?**
Je les ai mis à l'épreuve par des **mutations** : j'ai cassé volontairement la contrainte d'unicité, l'`UPDATE` atomique et le filtre de rôle. À chaque fois, des tests ont échoué.

**34. Test unitaire ou d'intégration ?**
Mes tests sont surtout d'**intégration** : ils passent par l'API réelle et une vraie base PostgreSQL. C'est volontaire : les risques de ce projet (transactions, contraintes, concurrence) n'apparaissent pas avec des simulations.

---
## F. Déploiement
**35. Pourquoi Docker ?**
Même environnement partout : API, PostgreSQL et MongoDB démarrent avec `docker compose up`. L'API attend que les bases soient prêtes (healthchecks), tourne avec un utilisateur non-root, et les bases ne sont exposées qu'en local.

**36. Où sont les secrets ?**
Dans un fichier `.env` (non versionné) ou des variables d'environnement, jamais dans le code. En production, le serveur refuse de démarrer avec des secrets faibles.

---
## G. Interface web
**37. Pourquoi pas de framework (React, Vue) ?**
Le besoin tient en six pages : du JavaScript natif suffit, sans étape de compilation ni dépendance à maintenir. C'est aussi plus léger pour l'utilisateur (éco-conception).

**38. Comment empêches-tu le XSS dans l'interface ?**
Toutes les données venant de l'API sont insérées avec `textContent` ou `setAttribute`, **jamais avec `innerHTML`**. En plus, la **politique CSP** interdit tout script qui ne vient pas de mon serveur : un script injecté ne s'exécuterait pas.

**39. Qu'est-ce que la CSP ?**
Un en-tête HTTP qui dit au navigateur d'où il a le droit de charger scripts, styles, images, polices. La mienne n'autorise que mon propre serveur (`'self'`), plus les images `data:` pour le QR code, et interdit d'afficher le site dans une iframe (`frame-ancestors 'none'`).

**40. Pourquoi les polices sont-elles sur ton serveur et pas chez Google Fonts ?**
Pour la CSP (aucune source externe), pour le RGPD (Google ne reçoit pas l'adresse IP des visiteurs) et pour l'éco-conception : deux polices variables seulement, Archivo pour le texte (90 Ko) et Fraunces pour les titres (37 Ko).

**40 bis. Comment as-tu choisi le style ?**
J'ai d'abord maquetté une direction sombre et futuriste dans Figma (« nuit de match »), avec les composants, les couleurs en variables et le schéma d'enchaînement. Puis j'ai comparé quatre styles sur les mêmes écrans (nuit, affiche, pelouse, prestige), chacun vérifié en accessibilité, et j'ai retenu **Prestige** : blanc, bleu marine, filets dorés, titres à empattements. C'est possible sans toucher au HTML ni au JavaScript, car la structure (`style.css`) est séparée de l'identité visuelle (`themes/prestige.css`).

**41. Où est stocké le jeton côté navigateur, et quelle est la limite ?**
Dans `sessionStorage` : il disparaît à la fermeture de l'onglet. Limite : un script injecté pourrait le lire. Mieux : un cookie `HttpOnly` posé par le serveur.

**42. Qu'est-ce qu'une redirection ouverte et comment l'évites-tu ?**
Après connexion, la page renvoie vers l'adresse donnée dans `?retour=`. Un attaquant pourrait y mettre son site pour du phishing. Ma fonction `safeReturn` n'accepte qu'un chemin local qui commence par un seul `/`.

**43. Masquer le lien « Administration » suffit-il à protéger la page ?**
Non : c'est du confort. Le serveur revérifie le rôle à chaque requête (403 sinon). Tout ce qui est côté navigateur peut être modifié par l'utilisateur.

**44. Comment as-tu vérifié l'accessibilité ?**
Boutons et libellés réels (`button`, `label`), `aria-pressed` sur les sièges, les blocs du plan et les catégories, `aria-label` qui lit « Rang 3, place 12, vendue », zone `aria-live` pour le panier et le verdict du contrôle, focus visible, lien d'évitement. Audit **axe-core : aucune violation WCAG 2.1 AA** sur les 6 pages.

**45. Comment le contrôleur scanne-t-il un QR code ?**
Un lecteur de QR code USB se comporte comme un clavier : il tape le code puis Entrée dans le champ, qui garde le focus. Sur mobile compatible, un bouton utilise la caméra (`BarcodeDetector`) : c'est une amélioration progressive, la saisie reste possible partout.

---
## H. Questions pièges à anticiper
- **« Quelles sont les limites de ton projet ? »** Pas de paiement réel, pas de révocation de jeton, limitation de débit en mémoire. Je les connais et je sais comment les améliorer (voir `docs/04-securite-et-tests.md`).
- **« Qu'est-ce que tu ferais avec plus de temps ? »** Remboursement, réservation temporaire de 10 minutes, jetons de rafraîchissement, e-mails de confirmation, Redis pour la limitation de débit.
- **« Tu as utilisé une IA ? »** Dis la vérité : tu as utilisé un assistant pour concevoir et apprendre, et tu es capable d'expliquer chaque ligne (c'est ce que cette fiche prépare).


## Le plan du stade (catégories, blocs, VIP, PMR)

**46. Comment le stade est-il découpé ?**
Comme les billetteries des grands clubs : stade → 4 tribunes → 31 blocs (anneau bas, loges, anneau haut) → places numérotées par rang. Chaque bloc a une catégorie : Hospitalité VIP (loges de la tribune présidentielle), Catégorie 1 (centre, anneau bas), Catégorie 2, Catégorie 3, Virage Kop (derrière le but Ouest), Parcage visiteurs (virage Est).

**47. Pourquoi la catégorie est sur le bloc et pas sur la place ?**
Toutes les places d'un bloc ont la même catégorie. La mettre sur chaque place la répéterait des centaines de fois : redondance, risque d'incohérence. C'est la 3e forme normale.

**48. Comment le parcage visiteurs n'est-il pas vendu ?**
Il n'a simplement pas de prix pour le match. La requête qui cherche les places vendables fait une jointure sur `match_category_prices` : sans prix, la place n'est pas trouvée, l'achat renvoie `422 INVALID_SEATS` et le plan du bloc renvoie `404 SECTOR_NOT_FOUND`. Aucune condition spéciale dans le code : c'est la donnée qui décide.

**49. Comment est dessiné le plan ?**
En SVG, créé en JavaScript avec `createElementNS` (jamais `innerHTML`). Chaque bloc est un rectangle calculé : vue de dessus à plat, les anneaux s'éloignent du terrain un par un, les blocs sont alignés le long de chaque tribune. La couleur vient de la catégorie, vérifiée par une expression régulière `#rrggbb` côté client et par une contrainte `CHECK` en base.

**50. Le plan est-il accessible ?**
Chaque bloc vendable a `role="button"`, `tabindex="0"`, un `aria-label` complet (« Bloc N3, Tribune Nord, anneau bas, Catégorie 1, 45 € la place, 112 places libres, dont 2 PMR ») et réagit à Entrée et Espace. Les blocs non vendus ont `aria-disabled`. Après le choix d'un bloc, le focus passe au titre de la liste des places. Les places PMR sont annoncées « place PMR pour fauteuil roulant ». axe-core : aucune violation.

**51. Pourquoi la couleur passe par `style.setProperty` alors que la CSP interdit les styles en ligne ?**
La CSP bloque les attributs `style="…"` écrits dans le HTML. Modifier une propriété CSS en JavaScript (CSSOM) n'est pas concerné. La valeur est de toute façon contrôlée avant (format `#rrggbb`).


## Ce que m'a appris l'étude des grands clubs (docs/05-etude-billetteries.md)

**52. Comment avez-vous conçu la billetterie ?**
J'ai étudié les sites du Real Madrid, du FC Barcelone, de Manchester City, du Bayern Munich et du PSG. Tous découpent le stade en zones et catégories, font varier le prix selon l'affiche, limitent le nombre de billets par personne et laissent le club adverse vendre le secteur visiteurs. Footix reprend ces règles à l'échelle d'un club amateur.

**53. Pourquoi une limite par compte et par match, en plus de la limite par commande ?**
Avec seulement 6 places par commande, un même compte pouvait passer plusieurs commandes. Barcelone (6), le Bayern (2) et Manchester City (1 à 4) limitent par personne et par match. Dans la transaction, je verrouille la ligne de l'utilisateur (`SELECT … FOR UPDATE`), je compte ses billets pour ce match, puis j'insère. Deux commandes envoyées en même temps par le même compte passent donc l'une après l'autre : la seconde voit les billets de la première et reçoit `409 TICKET_LIMIT_REACHED`. Un test le vérifie.

**54. Pourquoi verrouiller l'utilisateur et pas la table ?**
Verrouiller toute la table `tickets` bloquerait les achats de tout le monde. Le verrou sur une seule ligne `users` ne ralentit que les commandes du même compte.

**55. Comment marche le tarif réduit ?**
Le navigateur envoie seulement la liste des places au tarif réduit. Le serveur reprend le prix en base et le divise par deux ; il refuse le tarif réduit en loge VIP (`422 REDUCED_NOT_ALLOWED`), comme le Bayern pour ses hospitalités. Le billet garde la mention `tariff = 'reduit'` et l'écran de contrôle demande le justificatif, car on ne peut pas vérifier un âge ou un handicap en ligne.
