---
title: "Interactions tactiles et écrans du téléphone"
labels: [wayfinder:grilling]
parent: map-android
status: closed
assignee: cat
blocked_by: []
---

## Question

L'interface vient du poste (clavier, souris, survol). Quels gestes et quels écrans faut-il adapter au tactile ?

## Ce qu'on sait

- Déjà fait (2026-10-14) : barre du bas en icônes, pas de barre de titre, raccourcis `Alt+…` masqués sans survol, placeholder réduit, bouton « effacer », panneau des packs.
- Sur le poste : clic sur un mot = copier, double-clic = chercher ce mot (rebond), survol des proches = chemins du pivot, flèches/Entrée/Suppr dans l'historique. Rien de cela n'a été vérifié au doigt.
- Paysage : le clavier virtuel cache tout le résultat (écran trop bas).
- Bouton retour Android : ferme l'appli (aucune navigation entre pages gérée).
- Thème sombre : suit le système (Android 10+), pas vérifié à l'écran sur le téléphone.

## À trancher

- Geste pour « chercher ce mot » (double-tap ? appui long ?) et retour visuel de la copie.
- Chemins du pivot sans survol (appui ?).
- Historique au doigt : relancer, supprimer (glisser ?).
- Bouton retour : revenir à la page principale / au mot précédent ?
- Paysage : bloquer en portrait ou réorganiser ?

## Résolution (2026-10-14)

Tout ce qui suit vaut **sur écran tactile seulement** (`matchMedia('(hover: none) and (pointer: coarse)')`, le test qui masque déjà les pastilles `Alt+…`). Le poste ne change pas : clic = copier, double-clic = chercher, `title` pour les chemins du pivot, raccourcis clavier.

1. **Mot du résultat** : un tap ouvre une **bulle** avec « Copier » et « Chercher », plus une ligne « via en, es (N chemins) », en lecture seule, sur les mots issus du pivot seulement. La bulle s'ouvre au-dessus du mot, ou en dessous près du haut de l'écran ; elle se ferme sur un tap dehors, un défilement, ou un tap sur un autre mot (qui ouvre la sienne). « Copier » ferme la bulle, surligne le mot (`.copied`) et affiche le toast existant. Les deux boutons appellent `copy()` / `bounce()` : seul le déclencheur diffère du poste.
2. **« Chercher » depuis la bulle** : le mot va dans le champ **sans clavier** (pas de focus) ; le résultat reste visible, on tape le champ pour le modifier.
3. **Historique** : un appui long sur une entrée ouvre la même bulle avec « Supprimer » (une seule entrée ; l'effacement complet reste dans les réglages). Sélection de texte et menu natif bloqués sur les entrées. Le tap rouvre toujours l'entrée.
4. **Bouton retour**, dans l'ordre : fermer la bulle ouverte ; (le clavier est fermé par Android avant l'appli) ; Historique ou Réglages → page principale ; page principale → appli en arrière-plan (comportement Android par défaut). **Pas** de retour aux recherches précédentes.
5. **Paysage** : laissé tel quel (le clavier cache le résultat ; usage rare).
6. **Focus automatique** de `goTo()` : aucun sur l'Historique (le clavier cacherait la liste) ; sur la page principale, seulement si le champ est vide (lancement, après « effacer »).
7. **Hors périmètre** : partager les résultats vers une autre appli (la WebView n'a pas `navigator.share`, il faudrait un pont Kotlin `ACTION_SEND`). Amélioration possible plus tard, pas une adaptation au tactile. Un « Partager » dans la bulle du mot est écarté : il ferait doublon avec « Copier ».
8. **À vérifier pendant la mise en œuvre**, sans décision à prendre : le thème sombre à l'écran du téléphone.

## Mise en œuvre (2026-10-14)

- `web/app.js` : `isTouch()` (même requête média que le CSS) ; bulle `#bubble` (`openBubble`/`closeBubble`) pour les mots du résultat (Copier, Chercher, ligne « via … ») et pour l'appui long (500 ms) sur une entrée de l'historique (Supprimer) ; « Chercher » sans focus ; focus de `goTo()` limité comme décidé ; `window.langswapBack()` pour le bouton retour.
- La ligne « via … » reprend le contenu de l'infobulle du poste : les mots intermédiaires (`fr:bavarder, es:charlar…`) et le nombre de chemins, pas seulement les langues.
- `MainActivity.kt` : retour par `OnBackInvokedCallback` (Android 13+, `enableOnBackInvokedCallback`) ou `onBackPressed` ; la page décide, sinon `moveTaskToBack` (l'appli garde sa recherche).
- CSS tactile : entrées non sélectionnables, sans menu natif ni « × » (suppression par appui long seulement).
- Vérifié sur le Mi 9 SE : bulle au-dessus du mot, Copier (toast), Chercher (pas de clavier), via sur un mot du pivot, appui long, les trois étapes du retour, reprise de l'appli, thème sombre (bascule en direct, bulle lisible).
