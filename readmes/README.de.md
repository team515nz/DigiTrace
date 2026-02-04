# 🏺 3D-System zur Analyse archäologischer Ausgrabungen
Ein interaktives, browserbasiertes System zur Anzeige, Analyse und Synchronisierung von 3D-Modellen aus Ausgrabungsschichten. Das System ermöglicht die Kombination verschiedener Scans zu einer einheitlichen Szene für die visuelle archäologische Forschung.

---

## 🛠 Bedienungsanleitung: Worauf müssen Sie klicken?

### Schritt 1: Modelle hochladen
* **Wo klicken?** Rechts im weißen Feld mit dem 📤-Symbol.

* **Was passiert?** Ein Fenster zur Auswahl der Dateien von Ihrem Computer öffnet sich. Sie können mehrere Dateien gleichzeitig auswählen (OBJ, STL, GLB, GLTF).

* **Tipp:** Das System zeigt eine Ladeanzeige an, bis das Modell in der Bildschirmmitte erscheint.

### Schritt 2: Schichten verwalten und steuern
Nach dem Laden werden die Modelle in der Liste in der rechten Seitenleiste angezeigt. Jedes Modell verfügt über 3 Schaltflächen:
1. **Augensymbol:** Klicken Sie hier, um das Modell ein-/auszublenden (nützlich, um zu sehen, was sich unter einer bestimmten Ebene befindet).

2. **Anheften (📍):** Klicken Sie hier, um den Ausrichtungsprozess zu starten (siehe Schritt 3).

3. **Papierkorbsymbol:** Klicken Sie hier, um das Modell aus der Szene zu löschen.

### Schritt 3: Modell ausrichten
Wenn Sie zwei Ebenen hochgeladen haben, die nicht exakt übereinander liegen:
1. Klicken Sie auf das **Anheften (📍)** neben dem Modell, das Sie verschieben möchten.

2. Sie werden aufgefordert, Punkte zu markieren:
* **Erster Klick:** auf einen bestimmten Punkt im Modell, das Sie verschieben möchten.

* **Zweiter Klick:** auf den entsprechenden Punkt im „fixierten“ Modell (dem, das sich bereits an seiner Position befindet).

3. Nach dem Markieren der Punkte berechnet das System die Position des Modells und verschiebt es an seinen neuen Standort.

### Schritt 4: Beschneiden
* **Klickposition:** In der oberen Leiste befinden sich drei Schieberegler (X, Y, Z).

* **Vorgehensweise:** Ziehen Sie den Kreis auf der Achse nach links oder rechts.

* **Ergebnis:** Die Modelle werden beschnitten und verschwinden nach und nach, sodass Sie einen Querschnitt der Ausgrabung sehen können.


### Schritt 5: Exportieren und Speichern

Unten im rechten Menü:

1. Wählen Sie das gewünschte Format (STL oder GLTF) aus dem Dropdown-Menü.


2. Klicken Sie auf die blaue Schaltfläche **„Kombiniertes Modell herunterladen“**.


3. **Ergebnis:** Das System fügt alle angezeigten Daten zu einer Datei zusammen und lädt diese auf Ihren Computer herunter.


---

## ✨ Hauptfunktionen


### 🔍 Dynamische Schichtanalyse (Erweitertes Beschneiden)
Die Möglichkeit, eine „virtuelle Ausgrabung“ mithilfe von Schnittebenen in Echtzeit durchzuführen. Unverzichtbar für die Untersuchung stratigraphischer Beziehungen und interner Strukturen.

### 📍 Mehrpunkt-Ausrichtungsalgorithmus
Präzise räumliche Synchronisierung verschiedener Scans ohne externe Software.

### ⚓ Feste Ankerpunkte – Ausrichtung über primäre Ankerpunkte
Ein Modell kann als „Master“ (
) definiert werden. Das System wählt empfohlene Ankerpunkte (anhand der Kanten- und Mittelpunktpositionen) aus und speichert diese im lokalen Speicher. Jedes neu hochgeladene Modell versucht, sich automatisch relativ zum Master anhand der Punkte, die den primären Ankerpunkten am nächsten liegen, auszurichten.

- Manuelle Definition: Wählen Sie ein Modell aus und klicken Sie in der Modellliste auf die Schaltfläche ⚓, um es als Master festzulegen. (Sie können Masterpunkte auch manuell in der Szene auswählen.)
- Empfohlene Auswahl: Das System empfiehlt automatisch das am besten geeignete Modell (das mit der größten Größe) als Master.

- Am Modell ausrichten: Für jedes Modell können Sie Ausrichtungspunkte manuell auswählen, indem Sie in der Modellliste auf die Schaltfläche 📌 klicken, mindestens drei Punkte auswählen und anschließend auf „Am Master ausrichten“ klicken. In der Benutzeroberfläche gibt es außerdem einen **Schalter**, der die automatische Ausrichtung für jeden neuen Upload aktiviert (d. h., wenn diese Option aktiviert ist, versuchen neue Modelle automatisch, sich am Master auszurichten).

### 🎥 Interaktive 3D-Ansicht
* **Engine:** Three.js

* **Bewegung:** Ziehen zum Drehen, Mausrad zum Zoomen, rechte Maustaste zum Verschieben.

### ⛶ Vollbildmodus
Durch Klicken auf das quadratische Symbol in der oberen Ecke wird der Bildschirm gelöscht und nur das Modell mit den Steuerelementen angezeigt – ideal für die Präsentation von Ergebnissen auf Konferenzen oder im Feld.

**Technologien:** Three.js, JavaScript ES6, CSS Grid/Flexbox, HTML5 File API