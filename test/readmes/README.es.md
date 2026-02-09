# 🏺 Sistem de analiză 3D a săpăturilor arheologice
Un sistem interactiv bazat pe browser, conceput pentru afișarea, analizarea și sincronizarea modelelor 3D din straturile de săpături. Sistemul permite combinarea diferitelor scanări într-o singură scenă unificată pentru cercetare arheologică vizuală.

---

## 🛠 Ghid de operare: Pe ce faceți clic?

### Pasul 1: Încărcarea modelelor
* **Unde se face clic:** În partea dreaptă, în interiorul casetei albe cu pictograma 📤.
* **Ce se întâmplă:** Se va deschide o fereastră pentru selectarea fișierelor de pe computer. Puteți selecta mai multe fișiere simultan (OBJ, STL, GLB, GLTF).
* **Sfat:** Sistemul va afișa un mesaj de încărcare până când modelul apare în centrul ecranului.

### Pasul 2: Gestionarea și controlul straturilor
După încărcare, modelele vor apărea în lista din bara laterală dreaptă. Fiecare model are 3 butoane:
1. **Butonul ochi:** Faceți clic pentru a ascunde/afișa modelul (util atunci când doriți să vedeți ce se află „sub” un anumit strat).
2. **Butonul Fixare (📍):** Faceți clic pentru a începe procesul de aliniere (vezi pasul 3).
3. **Butonul coș de gunoi:** Faceți clic pentru a șterge modelul din scenă.

### Pasul 3: Alinierea unui model (Aliniere)
Dacă ați încărcat două straturi care nu stau exact unul peste altul:
1. Faceți clic pe **Fixare (📍)** de lângă modelul pe care doriți să îl mutați.
2. Sistemul vă va solicita să marcați puncte:
* **Primul clic:** pe un punct specific din modelul pe care doriți să îl mutați.
* **Al doilea clic:** pe punctul corespunzător din modelul „fix” (cel care este deja la locul său).
3. După marcarea punctelor, sistemul va calcula și va muta modelul în noua sa locație.

### Pasul 4: Decupare
* **Unde se face clic:** Există 3 cursoare în bara de sus (X, Y, Z).
* **Ce trebuie să faceți:** Trageți cercul pe axa stânga și dreapta.
* **Rezultat:** Modelele vor fi decupate și vor dispărea treptat, permițându-vă să vedeți o secțiune transversală a excavației.

### Pasul 5: Export și salvare
În partea de jos a meniului din dreapta:
1. Selectați formatul dorit (STL sau GLTF) din meniul derulant.
2. Faceți clic pe butonul albastru **„Descărcați modelul combinat”**.
3. **Rezultat:** Sistemul va îmbina tot ce este afișat pe ecran într-un singur fișier și îl va descărca pe computer.

---

## ✨ Caracteristici cheie

### 🔍 Analiza dinamică a straturilor (Decupare avansată)
Capacitatea de a efectua o „excavație virtuală” folosind planuri de tăiere în timp real. Esențial pentru examinarea relațiilor stratigrafice și a structurilor interne.

### 📍 Algoritm de aliniere multi-punct
Sincronizare spațială precisă între diferite scanări fără a fi nevoie de software extern.

### ⚓ Mize fixe – Aliniere după ancora principală
Un model poate fi definit ca „Master” (
). Sistemul va selecta punctele de ancorare recomandate pentru acesta (din locația marginilor și a punctelor de mijloc) și va salva ancorele în localStorage. Fiecare model nou pe care îl încărcați va încerca să se alinieze automat față de Master pe baza punctelor cele mai apropiate de ancorele principale.

- Definire manuală: Selectați un model și faceți clic pe butonul ⚓ din lista de modele pentru a-l defini ca Master. (De asemenea, puteți selecta manual punctele Master în scenă.)
- Selecție recomandată: Sistemul va recomanda automat cel mai potrivit model (cel care iese în evidență ca dimensiune) ca Master.

- Aliniere la model: Pentru fiecare model puteți selecta manual punctele de aliniere făcând clic pe butonul 📌 din lista de modele, selectând cel puțin 3 puncte și făcând clic pe „Aliniere la Master”. Există, de asemenea, un **comutator** în interfața cu utilizatorul care activează „alinierea automată” pentru fiecare încărcare nouă (adică, dacă este activat, noile modele vor încerca automat să se alinieze cu Master-ul).

### 🎥 Vizualizare 3D interactivă
* **Motor:** Three.js.
* **Mișcare:** Trageți pentru rotire, rotiță pentru zoom, buton dreapta pentru panoramare.

### ⛶ Mod ecran complet
Dacă faceți clic pe pictograma pătrată din colțul de sus, ecranul va fi șters și va fi afișat doar modelul cu comenzi plutitoare - ideal pentru prezentarea descoperirilor la conferințe sau pe teren.

**Tehnologii:** Three.js, JavaScript ES6, CSS Grid/Flexbox, API fișier HTML5