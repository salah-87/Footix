# Étude des billetteries des grands clubs (novembre 2026)

Avant de finaliser le plan du stade, j'ai étudié la billetterie de cinq grands clubs : Real Madrid, FC Barcelone, Manchester City, Bayern Munich et PSG. Tous vendent par zone et par catégorie, avec un prix qui dépend de l'affiche, une limite de billets par personne et un secteur visiteurs vendu par le club adverse.

## Ce que j'ai relevé
| Club | Ce qui m'a servi pour Footix |
|---|---|
| Real Madrid | 4 zones (Lateral, Fondo) × 7 hauteurs ; prix par zone et hauteur (130 à 455 € pour un Clasico) ; zone VIP dès 790 € ; billets visiteurs vendus uniquement par le club adverse ; billet sur mobile uniquement |
| FC Barcelone | Zones Tribuna, Lateral, Gol ; 6 billets par match pour un socio (2 pour les grandes affiches) ; places fauteuil avec un siège accompagnateur à côté |
| Manchester City | Catégories de match A à D ; moins de 18 ans environ moitié prix ; 1 à 4 billets par membre selon l'affiche |
| Bayern Munich | Catégories 1 à 5 (80 à 15 € en Bundesliga, jusqu'à 130 € en Ligue des champions) ; -50 % pour moins de 14 ans, 65 ans et plus, handicap, justificatif à l'entrée, pas de réduction en hospitalité ; 2 billets par membre ; 227 places fauteuil |
| PSG | 4 tribunes (Paris, Auteuil, Borelli, Boulogne) ; virages les moins chers ; hospitalités surtout à la saison ; porte PMR et porte visiteurs dédiées |

## Ce que Footix fait déjà
Stade en tribunes, anneaux et blocs ; 6 catégories dont VIP et Kop ; prix par catégorie et par match ; parcage visiteurs non vendu en ligne ; places PMR ; limite par commande ; billet QR code utilisable une fois.

## Ce que j'ai ajouté après l'étude
1. **6 billets au maximum par compte et par match** (RG5), même en plusieurs commandes. Contrôlé dans la transaction d'achat, avec un verrou `SELECT … FOR UPDATE` sur l'utilisateur : deux commandes envoyées en même temps par le même compte passent l'une après l'autre. Code `409 TICKET_LIMIT_REACHED`.
2. **Tarif réduit à -50 %** (RG16) pour les moins de 14 ans, les 65 ans et plus et les personnes en situation de handicap. Le serveur calcule le prix, refuse le tarif réduit en loge VIP (`422 REDUCED_NOT_ALLOWED`), enregistre `tickets.tariff`, et l'écran de contrôle demande le justificatif.

## Ce que j'ai laissé de côté
Ventes réservées aux membres, tirage au sort, bourse de revente officielle, billet nominatif avec pièce d'identité (contraire à la minimisation des données), catégories de match A, B, C (le prix par catégorie et par match produit déjà cet effet).

## Sources (consultées le 23 novembre 2026)
- Real Madrid : https://www.realmadrid.com/fr-FR/football/matchs/billetterie/real-madrid-barcelona-09-05-2027 ; https://www.realmadrid.com/es-ES/area-vip/faqs ; https://www.bernabeudigital.com/noticias/los-precios-de-las-entradas-del-real-madrid-fc-barcelona-donde-y-cuando-comprarlas-319523
- FC Barcelone : https://www.fcbarcelona.com/en/news/767453/queries-about-purchasing-tickets ; https://www.fcbarcelona.com/en/club/accessibility-facilities/spotify-camp-nou ; https://www.fcbarcelona.com/en/news/4106425/new-ticket-sales-services-for-wheelchair-users
- Manchester City : https://www.mancity.com/news/mens/premier-league-tickets-2026-27-on-sale-soon-63919545 ; https://www.goal.com/en/news/manchester-city-ticket-prices/blt5d5789e94ab31607
- Bayern Munich : https://fcbayern.com/en/tickets/info/prices-and-concessions ; https://fcbayern.com/en/tickets/info/faq ; https://fcbayern.com/en/tickets/info/customer-information-for-disabled-persons ; https://fcbayern.com/en/tickets/fc-bayern-hospitality-tickets/general-information
- PSG : https://www.psg.fr/le-club/installations/parc-des-princes/infos-pratiques/ ; https://www.goal.com/fr/news/comment-acheter-des-billets-pour-le-paris-saint-germain-en-2026-prix-moyens-match-arsenal-vs-psg-hospitalite-et-autres-options/blte7546309cc9924f1 ; https://footballgroundguide.com/psg-tickets-price-buy-guide
