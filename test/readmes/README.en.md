# 🏺 3D Archaeological Excavation Analysis System
An interactive browser-based system designed for displaying, analyzing and synchronizing 3D models from excavation layers. The system allows the combination of different scans into a single unified scene for visual archaeological research.

---

## 🛠 Operating Guide: What do you click?

### Step 1: Uploading the models
* **Where to click:** On the right side, inside the white box with the 📤 icon.
* **What happens:** A window will open for selecting files from your computer. You can select multiple files at once (OBJ, STL, GLB, GLTF).
* **Tip:** The system will display a loading message until the model appears in the center of the screen.

### Step 2: Managing and controlling layers
After loading, the models will appear in the list in the right sidebar. Each model has 3 buttons:
1. **Eye button:** Click to hide/show the model (useful when you want to see what is "under" a certain layer).
2. **Pin button (📍):** Click to start the alignment process (see step 3).
3. **Trash can button:** Click to delete the model from the scene.

### Step 3: Aligning a model (Alignment)
If you have uploaded two layers that do not sit exactly on top of each other:
1. Click the **Pin (📍)** next to the model you want to move.
2. The system will ask you to mark points:
* **First click:** on a specific point in the model you want to move.
* **Second click:** on the corresponding point in the "fixed" model (the one that is already in place).
3. After marking the points, the system will calculate and move the model to its new location.

### Step 4: Clipping
* **Where to click:** There are 3 sliders in the top bar (X, Y, Z).
* **What to do:** Drag the circle on the axis left and right.
* **Result:** The models will be clipped and gradually disappear, allowing you to see a cross-section of the excavation.

### Step 5: Export and Save
At the bottom of the right menu:
1. Select the desired format (STL or GLTF) from the drop-down menu.
2. Click the blue button **"Download Combined Model"**.
3. **Result:** The system will merge everything displayed on the screen into one file and download it to your computer.

---

## ✨ Key Features

### 🔍 Dynamic Layer Analysis (Advanced Clipping)
The ability to perform a "virtual excavation" using real-time cutting planes. Essential for examining stratigraphic relationships and internal structures.

### 📍 Multi-Point Alignment Algorithm
Accurate spatial synchronization between different scans without the need for external software.

### ⚓ Fixed Stakes – Alignment by primary anchor
One model can be defined as the "Master" (
). The system will select recommended anchor points for it (from the location of edges and midpoints), and save the anchors in localStorage. Each new model you upload will attempt to automatically align itself relative to the Master based on the points closest to the primary anchors.

- Manual definition: Select a model and click the ⚓ button in the model list to define it as the Master. (You can also manually select Master points in the scene.)
- Recommended selection: The system will automatically recommend the most suitable model (the one that stands out in size) as the Master.
- Align to Model: For each model you can manually select alignment points by clicking the 📌 button in the model list, selecting at least 3 points and clicking "Align to Master". There is also a **switch** in the UI that enables "auto-align" for each new upload (i.e. if enabled, new models will automatically attempt to align themselves to the Master).

### 🎥 Interactive 3D View
* **Engine:** Three.js.
* **Movement:** Drag to rotate, wheel to zoom, right button to pan.

### ⛶ Fullscreen Mode
Clicking the square icon in the top corner will clear the screen and display only the model with floating controls - ideal for presenting findings at conferences or in the field.

**Technologies:** Three.js, JavaScript ES6, CSS Grid/Flexbox, HTML5 File API