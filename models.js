// ─── Model Management ────────────────────────────────────────────
function calculateGlobalBoundingBox() {
    globalBoundingBox = new THREE.Box3();
    models.forEach(model => { if (model.visible) globalBoundingBox.union(new THREE.Box3().setFromObject(model.group)); });
}

async function addModelFromFile(file, color, unit = 'm') {
    try {
        // Ensure THREE.js is available
        if (typeof THREE === 'undefined') {
            throw new Error('THREE.js library not loaded. Please refresh the page.');
        }
        
        let geometries;
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'obj') geometries = await loadOBJFile(file);
        else if (ext === 'stl') geometries = await loadSTLFile(file);
        else if (ext === 'glb' || ext === 'gltf') geometries = await loadGLTFFile(file);
        else throw new Error('פורמט קובץ לא נתמך');
        if (!geometries || !geometries.length) throw new Error('לא הצלחתי לטעון את הגיאומטריה');
        
        // Ensure scene is initialized
        if (typeof scene === 'undefined' || !scene) {
            throw new Error('3D scene not initialized. Please refresh the page.');
        }
        
        const mainGroup = new THREE.Group();
        const isAligned = geometries.some(g => g.userData && g.userData.isAligned);
        geometries.forEach(geometry => {
            if (!geometry || !geometry.attributes.position) return;
            if (!isAligned) geometry.center();
            geometry.computeBoundingBox();
            const material = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, flatShading: false });
            mainGroup.add(new THREE.Mesh(geometry, material));
        });
        if (!mainGroup.children.length) throw new Error('לא נמצאו meshes תקינים');
        if (!isAligned) {
            const box = new THREE.Box3().setFromObject(mainGroup);
            const size = new THREE.Vector3(); box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) mainGroup.scale.set(4/maxDim, 4/maxDim, 4/maxDim);
            mainGroup.position.y = 0;
        }
        scene.add(mainGroup);
        const modelData = {
            id: modelCounter++,
            name: file.name,
            date: censor(new Date().toLocaleString('he-IL')),
            group: mainGroup,
            meshes: mainGroup.children,
            visible: true,
            originalGeometries: mainGroup.children.map(mesh => mesh.geometry.clone()),
            color,
            unit,
            format: ext.toUpperCase()
        };
        models.push(modelData);
        restoreModelTransform(modelData);
        saveModelToIDB(modelData);
        updateModelList();
        
        // ─── Sidebar Integration
        if (typeof sidebarController !== 'undefined') {
            sidebarController.addModelToList(modelData);
        }
        
        calculateGlobalBoundingBox();
        if (models.length === 1) adjustCameraToModel();
        if (models.length > 1 && anchorState.points.length >= 2) {
            const alignResult = await autoAlignNewModel(modelData);
            if (alignResult.success) {
                calculateGlobalBoundingBox(); applyCuts(); saveSession();
                showToast(`✓ יישור אוטומטי הצליח — שגיאה: ${censor(alignResult.avgError.toFixed(4))}`);
            } else if (alignResult.reason === 'errorTooLarge') {
                showToast(`⚠️ יישור אוטומטי בוטל — שגיאה: ${censor(alignResult.avgError.toFixed(4))}`, 'error');
            }
        }
        return modelData;
    } catch (error) {
        console.error('Error loading model:', error);
        throw error;
    }
}

function updateModelList() {
    const listContainer = document.getElementById('sidebarModelList');
    if (!listContainer) return; // Exit if container doesn't exist yet
    listContainer.innerHTML = '';
    if (models.length >= 2 && !alignState.active) {
        const alignRow = document.createElement('div');
        alignRow.style.cssText = 'margin-bottom:8px;';
        alignRow.innerHTML = `<button class="align-execute-btn" style="width:100%;font-size:0.85em;" onclick="openAlignPanel()">🎯 יישר מודלים</button>`;
        listContainer.appendChild(alignRow);
    }
    models.forEach(model => {
        const colorInfo = getColorInfo(model.color);
        const isBase = (model.id === baseModelId);
        const swatches = MODEL_COLORS.map(c =>
            `<span onclick="changeModelColor(${model.id},${c.hex})" title="${c.name}"
             style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c.css};cursor:pointer;border:${model.color===c.hex?'2px solid #fff':'1px solid #555'};flex-shrink:0;"></span>`
        ).join('');
        const item = document.createElement('div');
        item.className = 'model-item' + (isBase ? ' is-base-model' : '');
        item.innerHTML = `
            <div>
                <div class="model-name">
                    <div class="color-indicator" style="background-color:${colorInfo.hex}"></div>
                    <div class="flex-grow">
                        ${model.name}
                        <div class="color-name">צבע: ${colorInfo.name} &nbsp;|&nbsp; 📐 ${model.unit||'?'}</div>
                        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;">${swatches}</div>
                    </div>
                    ${isBase ? '<span class="base-model-badge">🔒 בסיס</span>' : ''}
                </div>
                <div class="model-date">${model.date}</div>
                <div class="model-controls">
                    <span class="visibility-toggle ${model.visible?'visible':''}" onclick="toggleVisibility(${model.id})">${model.visible?'👁️':'🚫'}</span>
                    <span class="visibility-toggle" onclick="rotateModelY(${model.id})">🔄Y</span>
                    <span class="visibility-toggle" onclick="rotateModelX(${model.id})">🔄X</span>
                    <span class="visibility-toggle" onclick="rotateModelZ(${model.id})">🔄Z</span>
                    <button class="set-base-btn ${isBase?'active':''}" onclick="setBaseModel(${model.id})">${isBase?'🔒 בסיס':'⚓ קבע בסיס'}</button>
                    <span class="visibility-toggle" title="הורד מודל זה" onclick="downloadSingleModel(${model.id})">📥</span>
                    <span class="delete-btn" onclick="deleteModel(${model.id})">🗑️</span>
                </div>
            </div>`;
        listContainer.appendChild(item);
    });
    updateDownloadSection();
}

function changeModelColor(id, hexNum) {
    const model = models.find(m => m.id === id);
    if (!model) return;
    model.color = hexNum;
    const cssColor = getColorInfo(hexNum).hex;
    model.meshes.forEach(mesh => { if (mesh.material) mesh.material.color.set(cssColor); });
    updateModelList();
    saveSession();
}

function setBaseModel(id) {
    if (baseModelId === id) {
        baseModelId = null;
        showToast('מודל בסיס בוטל');
    } else {
        baseModelId = id;
        const m = models.find(m => m.id === id);
        showToast(`🔒 "${m ? m.name : id}" הוגדר כמודל בסיס`);
    }
    updateModelList();
    saveSession();
}

function toggleVisibility(id) {
    const model = models.find(m => m.id === id);
    if (model) {
        model.visible = !model.visible;
        model.group.visible = model.visible;
        calculateGlobalBoundingBox(); applyCuts(); updateModelList(); saveSession();
    }
}

function rotateModelY(id) { const m = models.find(m=>m.id===id); if(m){m.group.rotation.y+=Math.PI/2;calculateGlobalBoundingBox();applyCuts();saveSession();} }
function rotateModelZ(id) { const m = models.find(m=>m.id===id); if(m){m.group.rotation.z+=Math.PI/2;calculateGlobalBoundingBox();applyCuts();saveSession();} }
function rotateModelX(id) { const m = models.find(m=>m.id===id); if(m){m.group.rotation.x+=Math.PI/2;calculateGlobalBoundingBox();applyCuts();saveSession();} }

function deleteModel(id) {
    const index = models.findIndex(m => m.id === id);
    if (index !== -1) {
        const removedName = models[index].name;
        scene.remove(models[index].group);
        for (let i = alignState.markers.length - 1; i >= 0; i--) {
            if (alignState.markers[i].modelId === id) {
                const mesh = alignState.markers[i].mesh;
                if (mesh && mesh.parent) mesh.parent.remove(mesh);
                alignState.markers.splice(i, 1);
            }
        }
        models.splice(index, 1);
        if (baseModelId === id) baseModelId = null;
        
        // ─── Sidebar Integration
        if (typeof sidebarController !== 'undefined') {
            sidebarController.removeModelFromList(id);
        }
        
        calculateGlobalBoundingBox(); applyCuts(); updateModelList(); saveSession();
        idbDelete(removedName).catch(()=>{});
    }
}

function updateDownloadSection() {
    const section = document.getElementById('downloadSection');
    if (models.filter(m => m.visible).length > 0) section.classList.remove('hidden');
    else section.classList.add('hidden');
}

// ─── Clipping ────────────────────────────────────────────────────
function applyCuts() {
    if (!globalBoundingBox || !models.length) return;
    const cutYRatio = parseFloat(document.getElementById('cutY').value) / 100;
    const cutXRatio = parseFloat(document.getElementById('cutX').value) / 100;
    const cutZRatio = parseFloat(document.getElementById('cutZ').value) / 100;
    const cutYWorld = globalBoundingBox.max.y - (globalBoundingBox.max.y - globalBoundingBox.min.y) * cutYRatio;
    const cutXWorld = globalBoundingBox.min.x + (globalBoundingBox.max.x - globalBoundingBox.min.x) * cutXRatio;
    const cutZWorld = globalBoundingBox.min.z + (globalBoundingBox.max.z - globalBoundingBox.min.z) * cutZRatio;
    models.forEach(model => {
        if (!model.visible) return;
        const worldMatrix = model.group.matrixWorld;
        const meshes = model.meshes || [];
        const originalGeos = model.originalGeometries || [];
        meshes.forEach((mesh, meshIndex) => {
            const originalGeo = originalGeos[meshIndex];
            if (!originalGeo) return;
            const positions = originalGeo.attributes.position.array;
            const newPositions = [], newIndices = [];
            if (originalGeo.index) {
                const indices = originalGeo.index.array;
                for (let i = 0; i < indices.length; i += 3) {
                    const i0=indices[i]*3,i1=indices[i+1]*3,i2=indices[i+2]*3;
                    const v0=new THREE.Vector3(positions[i0],positions[i0+1],positions[i0+2]).applyMatrix4(worldMatrix);
                    const v1=new THREE.Vector3(positions[i1],positions[i1+1],positions[i1+2]).applyMatrix4(worldMatrix);
                    const v2=new THREE.Vector3(positions[i2],positions[i2+1],positions[i2+2]).applyMatrix4(worldMatrix);
                    if(v0.y<=cutYWorld&&v1.y<=cutYWorld&&v2.y<=cutYWorld&&v0.x>=cutXWorld&&v1.x>=cutXWorld&&v2.x>=cutXWorld&&v0.z>=cutZWorld&&v1.z>=cutZWorld&&v2.z>=cutZWorld){
                        const b=newPositions.length/3;
                        newPositions.push(positions[i0],positions[i0+1],positions[i0+2],positions[i1],positions[i1+1],positions[i1+2],positions[i2],positions[i2+1],positions[i2+2]);
                        newIndices.push(b,b+1,b+2);
                    }
                }
            } else {
                for (let i = 0; i < positions.length; i += 9) {
                    const v0=new THREE.Vector3(positions[i],positions[i+1],positions[i+2]).applyMatrix4(worldMatrix);
                    const v1=new THREE.Vector3(positions[i+3],positions[i+4],positions[i+5]).applyMatrix4(worldMatrix);
                    const v2=new THREE.Vector3(positions[i+6],positions[i+7],positions[i+8]).applyMatrix4(worldMatrix);
                    if(v0.y<=cutYWorld&&v1.y<=cutYWorld&&v2.y<=cutYWorld&&v0.x>=cutXWorld&&v1.x>=cutXWorld&&v2.x>=cutXWorld&&v0.z>=cutZWorld&&v1.z>=cutZWorld&&v2.z>=cutZWorld){
                        for(let j=0;j<9;j++) newPositions.push(positions[i+j]);
                    }
                }
            }
            if (newPositions.length > 0) {
                const ng = new THREE.BufferGeometry();
                ng.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
                if (newIndices.length > 0) ng.setIndex(newIndices);
                ng.computeVertexNormals();
                mesh.geometry.dispose(); mesh.geometry = ng; mesh.visible = true;
            } else { mesh.visible = false; }
        });
    });
}

// ─── File Upload Handler ─────────────────────────────────────────
// Handled by sidebar-controller.js - emits 'sidebar:filesSelected' event
// Event listener in ui.js handles file processing

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('cutY').addEventListener('input', (e) => { setTextCensored(document.getElementById('cutYValue'), `חיתוך אנכי: ${e.target.value}%`); applyCuts(); saveSession(); });
    document.getElementById('cutX').addEventListener('input', (e) => { setTextCensored(document.getElementById('cutXValue'), `חיתוך רוחב: ${e.target.value}%`); applyCuts(); saveSession(); });
    document.getElementById('cutZ').addEventListener('input', (e) => { setTextCensored(document.getElementById('cutZValue'), `חיתוך עומק: ${e.target.value}%`); applyCuts(); saveSession(); });
    document.getElementById('cutYFS')?.addEventListener('input', (e) => { document.getElementById('cutY').value = e.target.value; setTextCensored(document.getElementById('cutYValue'), `חיתוך אנכי: ${e.target.value}%`); setTextCensored(document.getElementById('cutYValueFS'), `חיתוך אנכי: ${e.target.value}%`); applyCuts(); saveSession(); });
    document.getElementById('cutXFS')?.addEventListener('input', (e) => { document.getElementById('cutX').value = e.target.value; setTextCensored(document.getElementById('cutXValue'), `חיתוך רוחב: ${e.target.value}%`); setTextCensored(document.getElementById('cutXValueFS'), `חיתוך רוחב: ${e.target.value}%`); applyCuts(); saveSession(); });
    document.getElementById('cutZFS')?.addEventListener('input', (e) => { document.getElementById('cutZ').value = e.target.value; setTextCensored(document.getElementById('cutZValue'), `חיתוך עומק: ${e.target.value}%`); setTextCensored(document.getElementById('cutZValueFS'), `חיתוך עומק: ${e.target.value}%`); applyCuts(); saveSession(); });
});

async function confirmUnits() {
    document.getElementById('unitsModal').style.display = 'none';
    const globalUnit = document.getElementById('unitsGlobalSelect').value;
    const perModelUnits = {};
    document.querySelectorAll('#unitsPerModelList select').forEach(sel => { perModelUnits[sel.dataset.filename] = sel.value; });
    await loadPendingFiles(globalUnit, perModelUnits);
}

async function loadPendingFiles(defaultUnit, perModelUnits = {}) {
    const uploadBox = document.getElementById('uploadBox');
    const loadingMsg = document.getElementById('loadingMessage');
    uploadBox.classList.add('loading'); loadingMsg.classList.remove('hidden');
    const loadedModels = [];
    for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i]; const color = pendingColors[i];
        const ext = file.name.split('.').pop().toLowerCase();
        const unit = (ext==='glb'||ext==='gltf') ? 'm' : (perModelUnits[file.name] || defaultUnit);
        try { loadingMsg.textContent = censor(`טוען ${file.name}...`); const model = await addModelFromFile(file, color, unit); if (model) loadedModels.push({model, unit}); }
        catch (error) { showToast(`שגיאה בטעינת ${file.name}: ${error.message}`, 'error'); }
    }
    uploadBox.classList.remove('loading'); loadingMsg.classList.add('hidden');
    checkSizeDiscrepancy(loadedModels);
}

function checkSizeDiscrepancy(newlyLoaded) {
    if (models.length < 2) return;
    const sizes = models.map(m => { const box = new THREE.Box3().setFromObject(m.group); const s = new THREE.Vector3(); box.getSize(s); return {name: m.name, size: Math.max(s.x, s.y, s.z)}; });
    const allSizes = sizes.map(s => s.size); const median = allSizes.slice().sort((a,b) => a-b)[Math.floor(allSizes.length/2)];
    const outliers = sizes.filter(s => s.size > median*9 || s.size < median/9);
    if (outliers.length > 0) showToast('⚠️ הבדל גדול בגודל: ' + outliers.map(o => o.name).join(', ') + ' — בדוק יחידות מידה', 'error');
}
