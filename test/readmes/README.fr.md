# 🏺 Système d'analyse 3D des fouilles archéologiques

Système interactif accessible via navigateur, conçu pour afficher, analyser et synchroniser les modèles 3D issus des couches de fouilles. Il permet de combiner différentes numérisations en une seule scène unifiée pour la recherche archéologique visuelle.

---

## 🛠 Guide d'utilisation : Que faire ?

### Étape 1 : Importer les modèles

* **Où cliquer :** À droite, dans le cadre blanc avec l'icône 📤.

* **Que se passe-t-il :** Une fenêtre s'ouvre pour vous permettre de sélectionner des fichiers sur votre ordinateur. Vous pouvez sélectionner plusieurs fichiers simultanément (OBJ, STL, GLB, GLTF).

* **Astuce :** Le système affiche un message de chargement jusqu'à ce que le modèle apparaisse au centre de l'écran.

### Étape 2 : Gérer et contrôler les couches

Une fois les modèles chargés, ils apparaissent dans la liste de la barre latérale droite. Chaque modèle possède 3 boutons :

1. **Bouton Œil** : Cliquez pour afficher/masquer le modèle (utile pour voir ce qui se trouve sous un calque).

2. **Bouton Épingler (📍)** : Cliquez pour lancer l’alignement (voir étape 3).

3. **Bouton Corbeille** : Cliquez pour supprimer le modèle de la scène.

## Étape 3 : Alignement d’un modèle

Si vous avez importé deux calques qui ne sont pas parfaitement superposés :

1. Cliquez sur le bouton **Épingler (📍)** à côté du modèle à déplacer.

2. Le système vous demandera de marquer des points :

* **Premier clic** : sur un point précis du modèle à déplacer.

* **Deuxième clic** : sur le point correspondant du modèle fixe (celui qui est déjà en place).

3. Après avoir marqué les points, le système calculera et déplacera le modèle vers son nouvel emplacement.

### Étape 4 : Découpage
* **Où cliquer :** La barre supérieure comporte 3 curseurs (X, Y, Z).

* **Que faire :** Faites glisser le cercle sur l’axe horizontal.

* **Résultat :** Les modèles seront découpés et disparaîtront progressivement, révélant une coupe transversale de la fouille.

### Étape 5 : Exportation et enregistrement

En bas du menu de droite :

1. Sélectionnez le format souhaité (STL ou GLTF) dans le menu déroulant.

2. Cliquez sur le bouton bleu **« Télécharger le modèle combiné »**.

3. **Résultat :** Le système fusionnera tous les éléments affichés à l’écran en un seul fichier et le téléchargera sur votre ordinateur.

---

## ✨ Fonctionnalités clés

### 🔍 Analyse dynamique des couches (Découpage avancé)

Possibilité d’effectuer une « fouille virtuelle » à l’aide de plans de coupe en temps réel. Indispensable pour l’étude des relations stratigraphiques et des structures internes.

### 📍 Algorithme d'alignement multipoint

Synchronisation spatiale précise entre différentes numérisations sans logiciel externe.

### ⚓ Points d'ancrage fixes – Alignement par point d'ancrage principal

Un modèle peut être défini comme « Maître » (
). Le système sélectionnera des points d'ancrage recommandés (à partir de la position des bords et des points médians) et les enregistrera dans le stockage local. Chaque nouveau modèle importé tentera de s'aligner automatiquement sur le Maître en fonction des points les plus proches des points d'ancrage principaux.

- Définition manuelle : Sélectionnez un modèle et cliquez sur le bouton ⚓ dans la liste des modèles pour le définir comme Maître. (Vous pouvez également sélectionner manuellement les points Maître dans la scène.)

- Sélection recommandée : Le système recommandera automatiquement le modèle le plus approprié (celui qui se distingue par sa taille) comme Maître.

- Alignement sur le modèle : Pour chaque modèle, vous pouvez sélectionner manuellement des points d'alignement en cliquant sur le bouton 📌 dans la liste des modèles, en sélectionnant au moins 3 points et en cliquant sur « Aligner sur le Maître ». Une option dans l'interface utilisateur permet d'activer l'alignement automatique pour chaque nouveau modèle importé (c'est-à-dire que si cette option est activée, les nouveaux modèles tenteront automatiquement de s'aligner sur le modèle maître).

### 🎥 Vue 3D interactive

* **Moteur :** Three.js

* **Déplacement :** Faites glisser pour faire pivoter, utilisez la molette pour zoomer et cliquez avec le bouton droit pour vous déplacer.

### ⛶ Mode plein écran

Cliquez sur l'icône carrée dans le coin supérieur pour effacer l'écran et afficher uniquement le modèle avec des commandes flottantes ; idéal pour présenter des résultats lors de conférences ou sur le terrain.

**Technologies :** Three.js, JavaScript ES6, CSS Grid/Flexbox, API Fichier HTML5