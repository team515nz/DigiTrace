/* ────────────────────────────────────────────────────────────────────────── */
/* features.js - Application Features & Functionality                         */
/* Merged from: models.js, alignment.js, tools.js, export.js                 */
/* ────────────────────────────────────────────────────────────────────────── */

// ────────────────────────────────────────────────────────────────────────── 
// ─── MODEL MANAGEMENT ───────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────── 

function calculateGlobalBoundingBox() {
    globalBoundingBox = new THREE.Box3();
    models.forEach(model => { if (model.visible) globalBoundingBox.union(new THREE.Box3().setFromObject(model.group)); });
}

async function addModelFromFile(file, color, unit = 'm') {
    try {
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
    // If sidebarController is active, rebuild via it to avoid HTML conflicts
    if (typeof sidebarController !== 'undefined' && sidebarController) {
        const listContainer = document.getElementById('sidebarModelList');
        if (listContainer) {
            listContainer.innerHTML = '';
            models.forEach(model => {
                const item = sidebarController.createModelListItem(model);
                listContainer.appendChild(item);
            });
            sidebarController.updateUploadZoneVisibility();
        }
        updateDownloadSection();
        return;
    }

    // Legacy fallback
    const listContainer = document.getElementById('sidebarModelList');
    if (!listContainer) return;
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

// ─── XYZ GIZMO ─────────────────────────────────────────────────────────────

function activateGizmo(id) {
    if (!transformControls) return;
    const model = models.find(m => m.id === id);
    if (!model) return;
    if (activeGizmoModelId === id) { deactivateGizmo(); return; }
    transformControls.attach(model.group);
    activeGizmoModelId = id;
    updateModelList();
    showToast('↔️ Drag the red/green/blue arrows to move. Press Esc to stop.');
}

function deactivateGizmo() {
    if (!transformControls) return;
    transformControls.detach();
    activeGizmoModelId = null;
    updateModelList();
}

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
        
        if (typeof sidebarController !== 'undefined') {
            sidebarController.removeModelFromList(id);
        }
        
        calculateGlobalBoundingBox(); applyCuts(); updateModelList(); saveSession();
        idbDelete(removedName).catch(()=>{});
    }
}

function updateDownloadSection() {
    const hasVisible = models.filter(m => m.visible).length > 0;
    // Control legacy downloadSection if present
    const section = document.getElementById('downloadSection');
    if (section) {
        if (hasVisible) section.classList.remove('hidden');
        else section.classList.add('hidden');
    }
    // Control sidebar export tab availability
    if (typeof sidebarController !== 'undefined' && sidebarController.setExportTabEnabled) {
        sidebarController.setExportTabEnabled(hasVisible);
    }
}

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

// ────────────────────────────────────────────────────────────────────────── 
// ─── ALIGNMENT SYSTEM ───────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────── 

function alignUiText(key, fallback) {
    if (typeof window.t === 'function') {
        const translated = window.t(key);
        if (translated && translated !== key) return translated;
    }
    return fallback;
}

function formatAlignUiText(key, fallback, replacements = {}) {
    return alignUiText(key, fallback).replace(/\{(\w+)\}/g, (_, token) => {
        return replacements[token] !== undefined ? replacements[token] : '';
    });
}

function getAlignSelectValue(elementId) {
    const el = document.getElementById(elementId);
    if (!el || el.value === '') return null;
    const parsed = parseInt(el.value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function getAlignModelName(modelId) {
    const model = models.find(m => m.id === modelId);
    return model ? model.name : alignUiText('alignNoModelSelected', 'Not selected');
}

function getCurrentAlignRequirement() {
    return Math.max(alignState.minPoints, alignState.points1.length);
}

function updateAlignPhaseLabels() {
    const baseLabel = document.getElementById('alignPhaseLabelBase');
    const targetLabel = document.getElementById('alignPhaseLabelTarget');
    if (baseLabel) {
        baseLabel.textContent = formatAlignUiText(
            'alignBasePhaseLabel',
            'Click "{model}" to mark base points',
            { model: getAlignModelName(alignState.model1) }
        );
    }
    if (targetLabel) {
        targetLabel.textContent = formatAlignUiText(
            'alignTargetPhaseLabel',
            'Click "{model}" to mark {count} matching points',
            { model: getAlignModelName(alignState.model2), count: getCurrentAlignRequirement() }
        );
    }
}

function updateAlignOverviewStatus(id1, id2) {
    const statusEl = document.getElementById('alignSummaryStatus');
    if (!statusEl) return;
    if (!Number.isFinite(id1) || !Number.isFinite(id2) || id1 === id2) {
        statusEl.textContent = alignUiText('alignReadyState', 'Select two different models to begin');
        return;
    }
    if (!alignState.active) {
        statusEl.textContent = alignUiText('alignStatusSelect', 'Choose the fixed model and the model that should move');
        return;
    }
    statusEl.textContent = alignState.phase === 'base'
        ? alignUiText('alignStatusBase', 'Mark clear points on the base model in the order you want to reuse')
        : alignUiText('alignStatusTarget', 'Repeat the same numbered order on the target model');
}

function renderAlignPointTokens(containerId, filledCount, totalCount, variant) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const total = Math.max(totalCount, 1);
    container.innerHTML = Array.from({ length: total }, (_, index) => {
        let stateClass = 'pending';
        if (index < filledCount) stateClass = 'complete';
        else if (index === filledCount && filledCount < total) stateClass = 'active';
        return `<div class="align-point-token ${variant} ${stateClass}"><span class="align-point-token-number">${index + 1}</span></div>`;
    }).join('');
}

function syncAlignModelPreview() {
    const id1 = getAlignSelectValue('alignModel1Select');
    const id2 = getAlignSelectValue('alignModel2Select');
    const baseSummary = document.getElementById('alignSummaryBase');
    const targetSummary = document.getElementById('alignSummaryTarget');
    if (baseSummary) baseSummary.textContent = id1 !== null ? getAlignModelName(id1) : alignUiText('alignNoModelSelected', 'Not selected');
    if (targetSummary) targetSummary.textContent = id2 !== null ? getAlignModelName(id2) : alignUiText('alignNoModelSelected', 'Not selected');
    updateAlignOverviewStatus(id1, id2);
}

function openAlignPanel() {
    if (models.length < 2) { showToast('נדרשים לפחות 2 מודלים ליישור', 'error'); return; }
    const sel1 = document.getElementById('alignModel1Select');
    const sel2 = document.getElementById('alignModel2Select');
    sel1.innerHTML = models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    sel2.innerHTML = models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    if (alignState.active) {
        if (alignState.model1 !== null) sel1.value = alignState.model1;
        if (alignState.model2 !== null) sel2.value = alignState.model2;
    } else if (baseModelId !== null) {
        sel1.value = baseModelId;
    }
    const ids = models.map(m => m.id);
    const cur1 = parseInt(sel1.value);
    let cur2 = parseInt(sel2.value);
    if (cur2 === cur1) { const other = ids.find(id => id !== cur1); if (other !== undefined) sel2.value = other; }
    setAlignMode('points');
    syncAlignModelPreview();
    alignSetStep(alignState.active ? (alignState.phase === 'target' ? 3 : 2) : 1);
    updateAlignCounters();
    updateModelList();
}

function alignSetStep(n) {
    const section = document.getElementById('alignSection');
    if (section) section.dataset.step = String(n);
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById('stepDot'+i);
        if (dot) { dot.classList.remove('active','done'); if (i < n) dot.classList.add('done'); else if (i === n) dot.classList.add('active'); }
        const page = document.getElementById('alignPage'+i);
        if (page) { page.classList.remove('active'); if (i === n) page.classList.add('active'); }
    }
}

function alignStartStep2() {
    const id1 = parseInt(document.getElementById('alignModel1Select').value);
    const id2 = parseInt(document.getElementById('alignModel2Select').value);
    if (id1 === id2) { showToast('יש לבחור שני מודלים שונים', 'error'); return; }
    const m1 = models.find(m => m.id === id1);
    const m2 = models.find(m => m.id === id2);
    if (!m1 || !m2) { showToast('שגיאה: מודל לא נמצא', 'error'); return; }
    alignState.active = true;
    alignState.model1 = id1; alignState.model2 = id2;
    alignState.selectingModel = id1; alignState.phase = 'base';
    alignState.points1 = []; alignState.points2 = [];
    alignState.markers = []; alignState.mode = 'points'; alignState.hiddenModels = [];
    applyIsolation(id1, id2);
    m2.group.visible = false;
    tintAlignModels(id1, id2);
    setAlignMode('points');
    document.getElementById('canvas-container').classList.add('align-mode');
    alignSetStep(2);
    showAlignBanner(m1.name, m2.name);
    syncAlignModelPreview();
    updateAlignCounters();
}

function applyIsolation(id1, id2) {
    if (!document.getElementById('alignIsolationToggle').checked) return;
    alignState.hiddenModels = [];
    models.forEach(model => {
        if (model.id !== id1 && model.id !== id2 && model.visible) {
            model.group.visible = false;
            alignState.hiddenModels.push(model.id);
        }
    });
}

function restoreIsolation() {
    alignState.hiddenModels.forEach(id => {
        const m = models.find(m => m.id === id);
        if (m && m.visible) m.group.visible = true;
    });
    alignState.hiddenModels = [];
}

function tintAlignModels(id1, id2) {
    models.forEach(model => {
        const meshes = model.meshes || [];
        meshes.forEach(mesh => {
            if (!mesh.material || mesh.userData.label) return;
            mesh.material._origColor = mesh.material.color.clone();
            mesh.material._origOpacity = mesh.material.opacity;
            if (model.id === id1) { mesh.material.color.set('#FFD580'); mesh.material.opacity = 0.9; }
            else if (model.id === id2) { mesh.material.color.set('#6BA8FF'); mesh.material.opacity = 0.9; }
        });
    });
}

function restoreTint() {
    models.forEach(model => {
        const meshes = model.meshes || [];
        meshes.forEach(mesh => {
            if (!mesh.material || !mesh.material._origColor) return;
            mesh.material.color.copy(mesh.material._origColor);
            mesh.material.opacity = mesh.material._origOpacity;
            delete mesh.material._origColor;
            delete mesh.material._origOpacity;
        });
    });
}

function showAlignBanner(name1, name2) {
    const banner = document.getElementById('alignIsolationBanner');
    banner.textContent = formatAlignUiText(
        'alignBannerText',
        'Alignment: {base} <- {target}',
        { base: name1, target: name2 }
    );
    banner.classList.add('visible');
}

function hideAlignBanner() { document.getElementById('alignIsolationBanner').classList.remove('visible'); }

function setAlignMode(mode) {
    alignState.mode = mode;
    const tabPoints = document.getElementById('tabPoints');
    const basePanel = document.getElementById('subpanelPoints');
    const targetPanel = document.getElementById('subpanelPointsTarget');
    if (tabPoints) tabPoints.classList.toggle('active', mode === 'points');
    if (basePanel) basePanel.classList.toggle('active', mode === 'points' && alignState.phase === 'base');
    if (targetPanel) targetPanel.classList.toggle('active', mode === 'points' && alignState.phase === 'target');
    if (mode === 'points') {
        document.getElementById('canvas-container').classList.add('align-mode');
        document.getElementById('canvas-container').classList.remove('move-mode');
    } else {
        document.getElementById('canvas-container').classList.remove('align-mode');
    }
}

function alignGoToStep3() {
    if (alignState.mode === 'points' && alignState.points1.length < alignState.minPoints) {
        showToast(`יש לסמן לפחות ${alignState.minPoints} נקודות`, 'error'); return;
    }
    alignState.phase = 'target';
    alignState.selectingModel = alignState.model2;
    const m1 = models.find(m => m.id === alignState.model1);
    const m2 = models.find(m => m.id === alignState.model2);
    setAlignMode('points');
    if (m1) m1.group.visible = false;
    if (m2) m2.group.visible = true;
    document.getElementById('requiredPointsLabel').textContent = alignState.points1.length;
    document.getElementById('btnExecuteAlign').disabled = true;
    alignSetStep(3);
    syncAlignModelPreview();
    updateAlignCounters();
}

function alignBackToStep2() {
    alignState.phase = 'base';
    alignState.selectingModel = alignState.model1;
    const m1 = models.find(m => m.id === alignState.model1);
    const m2 = models.find(m => m.id === alignState.model2);
    if (m1) m1.group.visible = true;
    if (m2) m2.group.visible = false;
    setAlignMode('points');
    document.getElementById('canvas-container').classList.add('align-mode');
    alignSetStep(2);
    syncAlignModelPreview();
    updateAlignCounters();
}

function updateAlignCounters() {
    const requiredPoints = getCurrentAlignRequirement();
    const c1 = document.getElementById('base1Counter');
    const c2 = document.getElementById('targetCounter');
    if (c1) { c1.textContent = alignState.points1.length; c1.classList.toggle('has-points', alignState.points1.length > 0); }
    if (c2) { c2.textContent = alignState.points2.length; c2.classList.toggle('has-points', alignState.points2.length > 0); }
    const baseGoal = document.getElementById('alignBaseCounterGoal');
    const targetGoal = document.getElementById('alignTargetCounterGoal');
    if (baseGoal) baseGoal.textContent = requiredPoints;
    if (targetGoal) targetGoal.textContent = requiredPoints;
    const requiredSummary = document.getElementById('alignRequiredSummary');
    if (requiredSummary) requiredSummary.textContent = requiredPoints;
    const requiredLabel = document.getElementById('requiredPointsLabel');
    if (requiredLabel) requiredLabel.textContent = requiredPoints;
    const baseMeta = document.getElementById('alignSummaryBaseMeta');
    const targetMeta = document.getElementById('alignSummaryTargetMeta');
    if (baseMeta) baseMeta.textContent = `${alignState.points1.length} / ${requiredPoints}`;
    if (targetMeta) targetMeta.textContent = `${alignState.points2.length} / ${requiredPoints}`;
    const baseProgress = document.getElementById('alignBaseProgress');
    const targetProgress = document.getElementById('alignTargetProgress');
    if (baseProgress) baseProgress.style.width = `${Math.min(100, (alignState.points1.length / requiredPoints) * 100)}%`;
    if (targetProgress) targetProgress.style.width = `${Math.min(100, (alignState.points2.length / requiredPoints) * 100)}%`;
    const baseProgressLabel = document.getElementById('alignBaseProgressLabel');
    const targetProgressLabel = document.getElementById('alignTargetProgressLabel');
    if (baseProgressLabel) baseProgressLabel.textContent = `${alignState.points1.length} / ${requiredPoints}`;
    if (targetProgressLabel) targetProgressLabel.textContent = `${alignState.points2.length} / ${requiredPoints}`;
    renderAlignPointTokens('alignBasePointsList', alignState.points1.length, requiredPoints, 'base');
    renderAlignPointTokens('alignReferencePointsList', alignState.points1.length, requiredPoints, 'reference');
    renderAlignPointTokens('alignTargetPointsList', alignState.points2.length, requiredPoints, 'target');
    const btnToStep3 = document.getElementById('btnToStep3');
    if (btnToStep3) btnToStep3.disabled = alignState.points1.length < alignState.minPoints;
    const btnExec = document.getElementById('btnExecuteAlign');
    if (btnExec) btnExec.disabled = alignState.points2.length < alignState.minPoints || alignState.points2.length < alignState.points1.length;
    updateAlignPhaseLabels();
    updateAlignOverviewStatus(getAlignSelectValue('alignModel1Select'), getAlignSelectValue('alignModel2Select'));
}

function selectAlignmentPoint(screenX, screenY) {
    raycaster.setFromCamera(mouse, camera);
    const currentModel = models.find(m => m.id === alignState.selectingModel);
    if (!currentModel) return;
    const meshes = (currentModel.meshes || []).filter(m => !m.userData?.label && !m.isSprite);
    const intersects = raycaster.intersectObjects(meshes, true);
    if (!intersects.length) return;
    const point = intersects[0].point.clone();
    if (alignState.phase === 'base') {
        alignState.points1.push(point);
        add3DPointMarker(point, `M1-${alignState.points1.length}`, currentModel.id);
    } else {
        alignState.points2.push(point);
        add3DPointMarker(point, `M2-${alignState.points2.length}`, currentModel.id);
    }
    updateAlignCounters();
}

function add3DPointMarker(point, label, modelId) {
    const model = models.find(m => m.id === modelId);
    if (!model || !model.group) return;
    const worldToLocal = model.group.matrixWorld.clone().invert();
    const localPos = point.clone().applyMatrix4(worldToLocal);
    const bbox = new THREE.Box3().setFromObject(model.group);
    const sv = new THREE.Vector3(); bbox.getSize(sv);
    const radius = Math.max(0.02, Math.max(sv.x,sv.y,sv.z,1)*0.01);
    const isModel2 = label.startsWith('M2');
    const sphereColor = isModel2 ? 0x4488FF : 0xFF8800;
    const geom = new THREE.SphereGeometry(radius,8,8);
    const mat = new THREE.MeshStandardMaterial({color:sphereColor,emissive:isModel2?0x000022:0x220800});
    const sphere = new THREE.Mesh(geom,mat);
    sphere.position.copy(localPos); sphere.userData={label,modelId};
    model.group.add(sphere);
    const num = label.split('-')[1]||label;
    const canvas = document.createElement('canvas'); canvas.width=64; canvas.height=64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = isModel2 ? '#4488ff' : '#ff8800';
    ctx.beginPath(); ctx.arc(32,32,28,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 32px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(num,32,32);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({map:texture,depthTest:false});
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(radius*3,radius*3,1);
    sprite.position.copy(localPos); sprite.position.x+=radius*2; sprite.position.y+=radius*2;
    sprite.userData={label,modelId,isSprite:true};
    model.group.add(sprite);
    alignState.markers.push({label,mesh:sphere,modelId});
    alignState.markers.push({label,mesh:sprite,modelId});
}

function undoLastPoint() {
    if (alignState.phase === 'base' && alignState.points1.length > 0) { alignState.points1.pop(); removeLastMarkerPrefix('M1'); }
    else if (alignState.phase === 'target' && alignState.points2.length > 0) { alignState.points2.pop(); removeLastMarkerPrefix('M2'); }
    updateAlignCounters();
}

function removeLastMarkerPrefix(prefix) {
    for (let i = alignState.markers.length - 1; i >= 0; i--) {
        if (alignState.markers[i].label.startsWith(prefix)) {
            const mesh = alignState.markers[i].mesh;
            if (mesh && mesh.parent) mesh.parent.remove(mesh);
            alignState.markers.splice(i, 1); break;
        }
    }
    for (let i = alignState.markers.length - 1; i >= 0; i--) {
        if (alignState.markers[i].label.startsWith(prefix)) {
            const numInLabel = parseInt(alignState.markers[i].label.split('-')[1]);
            const currentCount = prefix==='M1' ? alignState.points1.length : alignState.points2.length;
            if (numInLabel > currentCount) { const mesh = alignState.markers[i].mesh; if (mesh && mesh.parent) mesh.parent.remove(mesh); alignState.markers.splice(i, 1); }
        }
    }
}

function removeMarkersForModel(modelId) {
    for (let i = alignState.markers.length - 1; i >= 0; i--) {
        if (alignState.markers[i].modelId === modelId) {
            const mesh = alignState.markers[i].mesh;
            if (mesh && mesh.parent) mesh.parent.remove(mesh);
            alignState.markers.splice(i, 1);
        }
    }
}

function executeAlignment() {
    const numPoints = Math.min(alignState.points1.length, alignState.points2.length);
    if (numPoints < alignState.minPoints) { showToast('יש לסמן לפחות ' + alignState.minPoints + ' נקודות', 'error'); return; }
    const model1 = models.find(m => m.id === alignState.model1);
    const model2 = models.find(m => m.id === alignState.model2);
    if (!model1 || !model2) return;
    const targetPoints = alignState.points1.slice(0, numPoints);
    const sourcePoints = alignState.points2.slice(0, numPoints);
    const worldToLocal2 = model2.group.matrixWorld.clone().invert();
    const sourcePointsLocal = sourcePoints.map(p => p.clone().applyMatrix4(worldToLocal2));
    const targetCenter = new THREE.Vector3();
    const sourceCenter = new THREE.Vector3();
    targetPoints.forEach(p => targetCenter.add(p));
    sourcePointsLocal.forEach(p => sourceCenter.add(p));
    targetCenter.divideScalar(numPoints);
    sourceCenter.divideScalar(numPoints);
    const targetCentered = targetPoints.map(p => p.clone().sub(targetCenter));
    const sourceCentered = sourcePointsLocal.map(p => p.clone().sub(sourceCenter));
    const rotation = calculateOptimalRotation(sourceCentered, targetCentered);
    let sourceScale = 0, targetScale = 0;
    sourceCentered.forEach(v => sourceScale += v.lengthSq());
    targetCentered.forEach(v => targetScale += v.lengthSq());
    const scale = Math.sqrt(targetScale/sourceScale);
    model2.group.scale.set(scale,scale,scale);
    const euler = new THREE.Euler().setFromQuaternion(rotation);
    model2.group.rotation.copy(euler);
    model2.group.updateMatrixWorld(true);
    const transformedSourceCenter = sourceCenter.clone().multiplyScalar(scale).applyQuaternion(rotation);
    const translation = targetCenter.clone().sub(transformedSourceCenter);
    model2.group.position.copy(translation);
    model2.group.updateMatrixWorld(true);
    let totalError = 0;
    for (let i = 0; i < numPoints; i++) {
        const transformed = sourcePointsLocal[i].clone().multiplyScalar(scale).applyQuaternion(rotation).add(translation);
        totalError += transformed.distanceTo(targetPoints[i]);
    }
    const avgError = totalError / numPoints;
    if (baseModelId === null) baseModelId = alignState.model1;
    alignFinish(`✓ יושר בהצלחה\nנקודות: ${numPoints}\nשגיאה: ${avgError.toFixed(6)}`);
}

function alignFinish(msg) {
    calculateGlobalBoundingBox(); applyCuts(); saveSession(); cleanupAlignState();
    showToast(msg.replace(/\n/g, ' | '));
}

function cleanupAlignState() {
    alignState.markers.forEach(m => { if (m.mesh && m.mesh.parent) m.mesh.parent.remove(m.mesh); });
    alignState.markers = [];
    [alignState.model1, alignState.model2].forEach(id => {
        const m = models.find(m => m.id === id);
        if (m && m.visible) m.group.visible = true;
    });
    restoreTint(); restoreIsolation();
    alignState = { active:false, mode:'points', phase:'base', model1:null, model2:null, selectingModel:null, points1:[], points2:[], markers:[], minPoints:3, hiddenModels:[] };
    document.getElementById('canvas-container').classList.remove('align-mode', 'move-mode');
    hideAlignBanner(); updateModelList();
    if (typeof sidebarController !== 'undefined') sidebarController.openTab('models');
}

function cancelAlignment() {
    cleanupAlignState();
}

function calculateOptimalRotation(sourcePoints, targetPoints) {
    const n = sourcePoints.length;
    if (n >= 1) {
        const q = new THREE.Quaternion();
        q.setFromUnitVectors(sourcePoints[0].clone().normalize(), targetPoints[0].clone().normalize());
        return q;
    }
    return new THREE.Quaternion();
}

function kabschRotation(sourcePoints, targetPoints) {
    const n = sourcePoints.length;
    const H = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < n; i++) {
        const s=[sourcePoints[i].x,sourcePoints[i].y,sourcePoints[i].z];
        const t=[targetPoints[i].x,targetPoints[i].y,targetPoints[i].z];
        for (let r=0;r<3;r++) for(let c=0;c<3;c++) H[r][c]+=s[r]*t[c];
    }
    const {U,V}=svd3x3(H);
    const R=mat3mul(V,mat3transpose(U));
    const det=mat3det(R);
    if(det<0){V[0][2]*=-1;V[1][2]*=-1;V[2][2]*=-1;return mat3ToQuaternion(mat3mul(V,mat3transpose(U)));}
    return mat3ToQuaternion(R);
}

function mat3transpose(m){return[[m[0][0],m[1][0],m[2][0]],[m[0][1],m[1][1],m[2][1]],[m[0][2],m[1][2],m[2][2]]];}
function mat3mul(A,B){const C=[[0,0,0],[0,0,0],[0,0,0]];for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)C[i][j]+=A[i][k]*B[k][j];return C;}
function mat3det(m){return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);}

function mat3ToQuaternion(R){
    const m=R,trace=m[0][0]+m[1][1]+m[2][2];let q;
    if(trace>0){const s=0.5/Math.sqrt(trace+1);q=new THREE.Quaternion((m[2][1]-m[1][2])*s,(m[0][2]-m[2][0])*s,(m[1][0]-m[0][1])*s,0.25/s);}
    else if(m[0][0]>m[1][1]&&m[0][0]>m[2][2]){const s=2*Math.sqrt(1+m[0][0]-m[1][1]-m[2][2]);q=new THREE.Quaternion(0.25*s,(m[0][1]+m[1][0])/s,(m[0][2]+m[2][0])/s,(m[2][1]-m[1][2])/s);}
    else if(m[1][1]>m[2][2]){const s=2*Math.sqrt(1+m[1][1]-m[0][0]-m[2][2]);q=new THREE.Quaternion((m[0][1]+m[1][0])/s,0.25*s,(m[1][2]+m[2][1])/s,(m[0][2]-m[2][0])/s);}
    else{const s=2*Math.sqrt(1+m[2][2]-m[0][0]-m[1][1]);q=new THREE.Quaternion((m[0][2]+m[2][0])/s,(m[1][2]+m[2][1])/s,0.25*s,(m[1][0]-m[0][1])/s);}
    q.normalize();return q;
}

function svd3x3(A){
    let U=[[1,0,0],[0,1,0],[0,0,1]],V=[[1,0,0],[0,1,0],[0,0,1]],B=[A[0].slice(),A[1].slice(),A[2].slice()];
    for(let iter=0;iter<20;iter++){
        for(let p=0;p<3;p++){for(let q2=p+1;q2<3;q2++){
            const alpha=B[p][p]*B[p][p]+B[q2][p]*B[q2][p];if(alpha<1e-12)continue;
            {const t2=(B[q2][p]*B[p][p]+B[q2][q2]*B[p][q2]);if(Math.abs(t2)<1e-12)continue;
             const t1=(B[p][p]*B[p][p]+B[p][q2]*B[p][q2]-B[q2][p]*B[q2][p]-B[q2][q2]*B[q2][q2])/2;
             const tau=t1/t2,t=tau<0?-1/(Math.abs(tau)+Math.sqrt(1+tau*tau)):1/(Math.abs(tau)+Math.sqrt(1+tau*tau));
             const c=1/Math.sqrt(1+t*t),s2=t*c;
             for(let k=0;k<3;k++){const tmp=B[p][k];B[p][k]=c*tmp+s2*B[q2][k];B[q2][k]=-s2*tmp+c*B[q2][k];}
             for(let k=0;k<3;k++){const tmp=U[k][p];U[k][p]=c*tmp+s2*U[k][q2];U[k][q2]=-s2*tmp+c*U[k][q2];}}
            {const t2=(B[p][q2]*B[p][p]+B[q2][q2]*B[q2][p]);if(Math.abs(t2)<1e-12)continue;
             const t1=(B[p][p]*B[p][p]+B[q2][p]*B[q2][p]-B[p][q2]*B[p][q2]-B[q2][q2]*B[q2][q2])/2;
             const tau=t1/t2,t=tau<0?-1/(Math.abs(tau)+Math.sqrt(1+tau*tau)):1/(Math.abs(tau)+Math.sqrt(1+tau*tau));
             const c=1/Math.sqrt(1+t*t),s2=t*c;
             for(let k=0;k<3;k++){const tmp=B[k][p];B[k][p]=c*tmp+s2*B[k][q2];B[k][q2]=-s2*tmp+c*B[k][q2];}
             for(let k=0;k<3;k++){const tmp=V[k][p];V[k][p]=c*tmp+s2*V[k][q2];V[k][q2]=-s2*tmp+c*V[k][q2];}}
        }}
    }
    return{U,V};
}

function sampleModelPoints(model, maxPoints) {
    const points=[]; model.group.updateMatrixWorld(true);
    const meshes=model.meshes||[];
    const perMesh=Math.ceil(maxPoints/(meshes.length||1));
    for(const mesh of meshes){
        mesh.updateMatrixWorld(true);
        const geom=mesh.geometry;
        if(!geom||!geom.attributes.position)continue;
        const pos=geom.attributes.position; const mat=mesh.matrixWorld;
        const step=Math.max(1,Math.floor(pos.count/perMesh));
        for(let i=0;i<pos.count&&points.length<maxPoints;i+=step)
            points.push(new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mat));
    }
    return points;
}

function icpStep(newModel, targetCloud) {
    const sourceCloud=sampleModelPoints(newModel,400);
    if(sourceCloud.length<3)return Infinity;
    const pairs=sourceCloud.map(sp=>{
        let bestDistSq=Infinity,bestPt=null;
        for(const tp of targetCloud){const d=sp.distanceToSquared(tp);if(d<bestDistSq){bestDistSq=d;bestPt=tp;}}
        return{src:sp,tgt:bestPt,dist:Math.sqrt(bestDistSq)};
    });
    pairs.sort((a,b)=>a.dist-b.dist);
    const keep=pairs.slice(0,Math.max(4,Math.floor(pairs.length*0.75)));
    const srcC=new THREE.Vector3(),tgtC=new THREE.Vector3();
    keep.forEach(p=>{srcC.add(p.src);tgtC.add(p.tgt);}); srcC.divideScalar(keep.length);tgtC.divideScalar(keep.length);
    const srcCen=keep.map(p=>p.src.clone().sub(srcC));
    const tgtCen=keep.map(p=>p.tgt.clone().sub(tgtC));
    const rotation=kabschRotation(srcCen,tgtCen);
    let ss=0,ts=0;
    srcCen.forEach(v=>ss+=v.lengthSq()); tgtCen.forEach(v=>ts+=v.lengthSq());
    const scaleFactor=ss>1e-12?Math.sqrt(ts/ss):1;
    const newQuat=rotation.clone().multiply(newModel.group.quaternion);
    const rotatedSrcC=srcC.clone().applyQuaternion(rotation).multiplyScalar(scaleFactor);
    const translation=tgtC.clone().sub(rotatedSrcC);
    const newPos=newModel.group.position.clone().applyQuaternion(rotation).multiplyScalar(scaleFactor).add(translation);
    const newScale=newModel.group.scale.clone().multiplyScalar(scaleFactor);
    newModel.group.position.copy(newPos); newModel.group.quaternion.copy(newQuat); newModel.group.scale.copy(newScale);
    newModel.group.updateMatrixWorld(true);
    return keep.reduce((s,p)=>s+p.dist,0)/keep.length;
}

function findClosestPointOnModel(model, worldPoint) {
    let best=null,bestDist=Infinity;
    model.group.updateMatrixWorld(true);
    (model.meshes||[]).forEach(mesh=>{
        mesh.updateMatrixWorld(true);
        const geom=mesh.geometry; if(!geom||!geom.attributes.position)return;
        const pos=geom.attributes.position; const mat=mesh.matrixWorld;
        const v=new THREE.Vector3(); const step=Math.max(1,Math.floor(pos.count/3000));
        for(let i=0;i<pos.count;i+=step){
            v.fromBufferAttribute(pos,i).applyMatrix4(mat);
            const d=v.distanceTo(worldPoint); if(d<bestDist){bestDist=d;best=v.clone();}
        }
    });
    return best;
}

async function autoAlignNewModel(newModel) {
    if(!document.getElementById('anchorAutoAlign').checked)return{success:false,reason:'disabled'};
    const anchors=anchorState.points;
    if(anchors.length<2)return{success:false,reason:'noAnchors'};
    const loadingMsg=document.getElementById('loadingMessage');
    loadingMsg.classList.remove('hidden'); loadingMsg.textContent='מכין יישור ICP...';
    await new Promise(r=>setTimeout(r,20));
    const baseModel=models.find(m=>m.id!==newModel.id);
    if(!baseModel){loadingMsg.classList.add('hidden');return{success:false,reason:'noBase'};}
    const targetCloud=sampleModelPoints(baseModel,1500);
    if(targetCloud.length<10){loadingMsg.classList.add('hidden');return{success:false,reason:'noPoints'};}
    const origPos=newModel.group.position.clone(),origQuat=newModel.group.quaternion.clone(),origScale=newModel.group.scale.clone();
    const baseBB=new THREE.Box3().setFromObject(baseModel.group);
    const baseCenter=new THREE.Vector3(); baseBB.getCenter(baseCenter);
    const candidateEulers=[[0,0,0],[Math.PI,0,0],[0,Math.PI,0],[0,0,Math.PI],[Math.PI/2,0,0],[-Math.PI/2,0,0],[0,Math.PI/2,0],[0,-Math.PI/2,0]];
    let bestError=Infinity,bestPos=origPos.clone(),bestQuat=origQuat.clone(),bestScale=origScale.clone();
    for(let ci=0;ci<candidateEulers.length;ci++){
        loadingMsg.textContent=`מריץ ICP (כיוון ${ci+1}/${candidateEulers.length})...`;
        await new Promise(r=>setTimeout(r,0));
        newModel.group.position.copy(origPos); newModel.group.quaternion.copy(origQuat); newModel.group.scale.copy(origScale);
        newModel.group.updateMatrixWorld(true);
        const[ex,ey,ez]=candidateEulers[ci];
        newModel.group.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(ex,ey,ez)));
        newModel.group.updateMatrixWorld(true);
        const newBB=new THREE.Box3().setFromObject(newModel.group);
        const newCenter=new THREE.Vector3(); newBB.getCenter(newCenter);
        newModel.group.position.add(baseCenter.clone().sub(newCenter));
        newModel.group.updateMatrixWorld(true);
        let prevErr=Infinity;
        for(let iter=0;iter<35;iter++){const err=icpStep(newModel,targetCloud);if(Math.abs(prevErr-err)<1e-6)break;prevErr=err;}
        let anchorError=0;
        for(const anchor of anchors){const closest=findClosestPointOnModel(newModel,anchor);if(closest)anchorError+=closest.distanceTo(anchor);}
        anchorError/=anchors.length;
        if(anchorError<bestError){bestError=anchorError;bestPos=newModel.group.position.clone();bestQuat=newModel.group.quaternion.clone();bestScale=newModel.group.scale.clone();}
    }
    newModel.group.position.copy(bestPos); newModel.group.quaternion.copy(bestQuat); newModel.group.scale.copy(bestScale);
    newModel.group.updateMatrixWorld(true); loadingMsg.classList.add('hidden');
    const threshold=parseFloat(document.getElementById('anchorThreshold').value)||0.5;
    if(bestError>threshold){
        newModel.group.position.copy(origPos); newModel.group.quaternion.copy(origQuat); newModel.group.scale.copy(origScale);
        newModel.group.updateMatrixWorld(true);
        return{success:false,reason:'errorTooLarge',avgError:bestError,threshold};
    }
    return{success:true,avgError:bestError};
}

// ────────────────────────────────────────────────────────────────────────── 
// ─── TOOLS (RULER & ANCHORS) ────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────── 

function setRulerBtnStyle(active, finished) {
    const color = finished ? '#5a7a5a' : active ? '#8a5a5a' : '#5a5a8a';
    ['rulerBtn','rulerBtnFS'].forEach(id => { const el=document.getElementById(id); if(el) el.style.background=color; });
}

function toggleRuler() {
    if (rulerState.active || rulerState.finished) { cancelRuler(); return; }
    if (!scene) { showToast(typeof t === 'function' ? t('uploadFirst') : 'Upload a model first', 'error'); return; }
    rulerState.active=true; rulerState.finished=false; rulerState.points=[]; clearRulerObjects();
    setRulerBtnStyle(true, false);
    document.getElementById('canvas-container').style.cursor='crosshair';
    showRulerOverlay(typeof t === 'function' ? t('rulerPoint1') : '📏 Click first point on model');
}

function cancelRuler() {
    rulerState.active=false; rulerState.finished=false; clearRulerObjects();
    setRulerBtnStyle(false, false);
    document.getElementById('canvas-container').style.cursor='';
    document.getElementById('rulerOverlay').style.display='none';
}

function clearRulerObjects() {
    rulerState.markers.forEach(m => rulerScene && rulerScene.remove(m)); rulerState.markers=[];
    if(rulerState.line){rulerScene && rulerScene.remove(rulerState.line); rulerState.line=null;}
    rulerState.points=[];
}

function showRulerOverlay(text) {
    const el=document.getElementById('rulerOverlay'); el.style.display='block'; el.textContent=text;
}

function pickRulerPoint(clientX, clientY) {
    const container=document.getElementById('canvas-container');
    const rect=container.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((clientX-rect.left)/rect.width)*2-1,-((clientY-rect.top)/rect.height)*2+1), camera);
    const allMeshes=[]; let hitUnit='m';
    models.forEach(model=>{
        if(!model.visible)return;
        (model.meshes||[]).forEach(mesh=>{
            if(mesh.visible&&!(mesh.userData&&mesh.userData.label)&&!mesh.isSprite){allMeshes.push(mesh);mesh._modelRef=model;}
        });
    });
    const intersects=raycaster.intersectObjects(allMeshes, false);
    if(!intersects.length)return;
    const hit=intersects[0]; const point=hit.point.clone();
    hitUnit=(hit.object._modelRef&&hit.object._modelRef.unit)||'m';
    const sphereGeo=new THREE.SphereGeometry(0.06,12,12);
    const sphereMat=new THREE.MeshBasicMaterial({color:0xFFFF00,depthTest:false,depthWrite:false});
    const sphere=new THREE.Mesh(sphereGeo,sphereMat); sphere.position.copy(point);
    rulerScene.add(sphere); rulerState.markers.push(sphere); rulerState.points.push(point);
    if(rulerState.points.length===1){rulerState.modelUnit=hitUnit;showRulerOverlay(typeof t==='function'?t('rulerPoint2'):'📏 Click second point');}
    else if(rulerState.points.length===2){
        const lineGeo=new THREE.BufferGeometry().setFromPoints(rulerState.points);
        const lineMat=new THREE.LineBasicMaterial({color:0xFFFF00,linewidth:2,depthTest:false,depthWrite:false});
        rulerState.line=new THREE.Line(lineGeo,lineMat); rulerScene.add(rulerState.line);
        const distScene=rulerState.points[0].distanceTo(rulerState.points[1]);
        const hitModel=allMeshes[0]?._modelRef;
        let distReal=distScene; let unitLabel=rulerState.modelUnit;
        if(hitModel&&hitModel.group){const sc=hitModel.group.scale.x;if(sc&&sc!==1)distReal=distScene/sc;}
        const distLabel=typeof t==='function'?t('rulerDistance'):'📏 Distance';
        const closeSuffix=typeof t==='function'?t('rulerDistanceSuffix'):'(click 📏 to close)';
        showRulerOverlay(`${distLabel}: ${formatDistance(distReal,unitLabel)}   ${closeSuffix}`);
        rulerState.active=false; rulerState.finished=true;
        setRulerBtnStyle(false, true); document.getElementById('canvas-container').style.cursor='';
    }
}

function formatDistance(val, unit) {
    const toM=UNIT_TO_METERS[unit]||1; const meters=val*toM;
    let result;
    if(meters>=1000)result=(meters/1000).toFixed(3)+' km';
    else if(meters>=1)result=meters.toFixed(4)+' m';
    else if(meters>=0.01)result=(meters*100).toFixed(3)+' cm';
    else result=(meters*1000).toFixed(3)+' mm';
    return censorNumber(result);
}

function restorePendingRuler() {
    const saved=window._pendingRulerRestore;
    if(!saved||!rulerScene){return;} window._pendingRulerRestore=null;
    try {
        const pts=saved.points.map(p=>new THREE.Vector3(p.x,p.y,p.z));
        clearRulerObjects();
        pts.forEach(point=>{
            const sphereGeo=new THREE.SphereGeometry(0.06,12,12);
            const sphereMat=new THREE.MeshBasicMaterial({color:0xFFFF00,depthTest:false,depthWrite:false});
            const sphere=new THREE.Mesh(sphereGeo,sphereMat); sphere.position.copy(point);
            rulerScene.add(sphere); rulerState.markers.push(sphere); rulerState.points.push(point);
        });
        if(pts.length===2){
            const lineGeo=new THREE.BufferGeometry().setFromPoints(pts);
            const lineMat=new THREE.LineBasicMaterial({color:0xFFFF00,linewidth:2,depthTest:false,depthWrite:false});
            rulerState.line=new THREE.Line(lineGeo,lineMat); rulerScene.add(rulerState.line);
        }
        rulerState.modelUnit=saved.modelUnit||'m'; rulerState.active=false; rulerState.finished=true;
        setRulerBtnStyle(false, true); if(saved.displayText)showRulerOverlay(saved.displayText);
    } catch(e) { console.warn('restorePendingRuler error:',e); }
}

function updateAnchorStatus() {
    const el=document.getElementById('anchorStatus'); if(!el)return;
    const n=anchorState.points.length;
    if(n===0){el.textContent='אין נקודות קבועות';el.style.color='#888';}
    else if(anchorState.picking){el.textContent=censor(`בוחר נקודות: ${n} עד כה — לחץ ESC לסיום`);el.style.color='#fa0';}
    else{el.textContent=censor(`${n} נקודות קבועות מוגדרות ✓`);el.style.color='#8f8';}
    document.getElementById('startAnchorBtn').textContent=anchorState.picking?'✓ סיים בחירה':'🖱️ בחר נקודות';
}

function startAnchorPicking() {
    if(anchorState.picking){anchorState.picking=false;document.getElementById('canvas-container').style.cursor='';updateAnchorStatus();saveAnchorToStorage();return;}
    if(!scene){showToast('העלה מודל תחילה', 'error');return;}
    anchorState.picking=true; document.getElementById('canvas-container').style.cursor='crosshair'; updateAnchorStatus();
}

function clearAnchorPoints() {
    anchorState.picking=false; anchorState.points=[];
    anchorState.markers.forEach(m => rulerScene && rulerScene.remove(m)); anchorState.markers=[];
    document.getElementById('canvas-container').style.cursor=''; updateAnchorStatus(); saveAnchorToStorage();
}

function addAnchorPoint(worldPoint) {
    anchorState.points.push(worldPoint.clone());
    const geo=new THREE.SphereGeometry(0.07,12,12);
    const mat=new THREE.MeshBasicMaterial({color:0x00FF88,depthTest:false,depthWrite:false});
    const sphere=new THREE.Mesh(geo,mat); sphere.position.copy(worldPoint);
    rulerScene.add(sphere); anchorState.markers.push(sphere); updateAnchorStatus();
}

function pickAnchorPoint(clientX, clientY) {
    const container=document.getElementById('canvas-container');
    const rect=container.getBoundingClientRect();
    const mx=((clientX-rect.left)/rect.width)*2-1;
    const my=-((clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(new THREE.Vector2(mx,my), camera);
    const allMeshes=[];
    models.forEach(model=>{if(!model.visible)return;(model.meshes||[]).forEach(mesh=>{if(mesh.visible)allMeshes.push(mesh);});});
    const intersects=raycaster.intersectObjects(allMeshes, true);
    if(intersects.length===0)return;
    addAnchorPoint(intersects[0].point);
}

function saveAnchorToStorage() {
    try{localStorage.setItem('digitrace_anchors',JSON.stringify({points:anchorState.points.map(p=>({x:p.x,y:p.y,z:p.z}))}));}catch(e){}
}

function restoreAnchorFromStorage() {
    try{
        const raw=localStorage.getItem('digitrace_anchors'); if(!raw)return;
        const data=JSON.parse(raw); if(!data.points||!data.points.length)return;
        data.points.forEach(p=>addAnchorPoint(new THREE.Vector3(p.x,p.y,p.z)));
    }catch(e){}
}

// ────────────────────────────────────────────────────────────────────────── 
// ─── EXPORT ────────────────────────────────────────────────────────────── 
// ────────────────────────────────────────────────────────────────────────── 

function getCombinedGeometry() {
    const visibleModels=models.filter(m=>m.visible);
    if(!visibleModels.length)return null;
    if(scene)scene.updateMatrixWorld(true);
    const allPositions=[],allNormals=[],allIndices=[]; let indexOffset=0;
    visibleModels.forEach(model=>{
        const worldMatrix=model.group.matrixWorld;
        const normalMatrix=new THREE.Matrix3().getNormalMatrix(worldMatrix);
        (model.meshes||[]).forEach(mesh=>{
            if(!mesh.visible)return; if(mesh.userData&&mesh.userData.label)return; if(mesh.isSprite)return;
            const geometry=mesh.geometry;
            if(!geometry||!geometry.attributes||!geometry.attributes.position)return;
            const positions=geometry.attributes.position.array; if(!positions||!positions.length)return;
            const normals=geometry.attributes.normal?geometry.attributes.normal.array:null;
            for(let i=0;i<positions.length;i+=3){
                const vertex=new THREE.Vector3(positions[i],positions[i+1],positions[i+2]).applyMatrix4(worldMatrix);
                allPositions.push(vertex.x,vertex.y,vertex.z);
                if(normals){const normal=new THREE.Vector3(normals[i],normals[i+1],normals[i+2]).applyMatrix3(normalMatrix).normalize();allNormals.push(normal.x,normal.y,normal.z);}
            }
            if(geometry.index){const indices=geometry.index.array;for(let i=0;i<indices.length;i++)allIndices.push(indices[i]+indexOffset);}
            else{for(let i=0;i<positions.length/3;i++)allIndices.push(i+indexOffset);}
            indexOffset+=positions.length/3;
        });
    });
    const combinedGeometry=new THREE.BufferGeometry();
    combinedGeometry.setAttribute('position',new THREE.Float32BufferAttribute(allPositions,3));
    if(allNormals.length>0)combinedGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(allNormals,3));
    if(allIndices.length>0)combinedGeometry.setIndex(allIndices);
    if(allNormals.length===0)combinedGeometry.computeVertexNormals();
    return combinedGeometry;
}

function getSingleModelGeometry(model) {
    if(scene)scene.updateMatrixWorld(true);
    const allPositions=[],allNormals=[],allIndices=[]; let indexOffset=0;
    const worldMatrix=model.group.matrixWorld; const normalMatrix=new THREE.Matrix3().getNormalMatrix(worldMatrix);
    (model.meshes||[]).forEach(mesh=>{
        if(!mesh.visible)return; if(mesh.userData&&mesh.userData.label)return; if(mesh.isSprite)return;
        const geometry=mesh.geometry; if(!geometry||!geometry.attributes||!geometry.attributes.position)return;
        const positions=geometry.attributes.position.array; if(!positions||!positions.length)return;
        const normals=geometry.attributes.normal?geometry.attributes.normal.array:null;
        for(let i=0;i<positions.length;i+=3){
            const vertex=new THREE.Vector3(positions[i],positions[i+1],positions[i+2]).applyMatrix4(worldMatrix);
            allPositions.push(vertex.x,vertex.y,vertex.z);
            if(normals){const normal=new THREE.Vector3(normals[i],normals[i+1],normals[i+2]).applyMatrix3(normalMatrix).normalize();allNormals.push(normal.x,normal.y,normal.z);}
        }
        if(geometry.index){const idx=geometry.index.array;for(let i=0;i<idx.length;i++)allIndices.push(idx[i]+indexOffset);}
        else{for(let i=0;i<positions.length/3;i++)allIndices.push(i+indexOffset);}
        indexOffset+=positions.length/3;
    });
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(allPositions,3));
    if(allNormals.length>0)geo.setAttribute('normal',new THREE.Float32BufferAttribute(allNormals,3));
    if(allIndices.length>0)geo.setIndex(allIndices);
    return geo;
}

function exportToSTL(geometry) {
    const positions=geometry.attributes.position.array;
    const indices=geometry.index?geometry.index.array:null;
    const triangles=[];
    if(indices){
        for(let i=0;i<indices.length;i+=3){
            const i0=indices[i]*3,i1=indices[i+1]*3,i2=indices[i+2]*3;
            const v0=new THREE.Vector3(positions[i0],positions[i0+1],positions[i0+2]);
            const v1=new THREE.Vector3(positions[i1],positions[i1+1],positions[i1+2]);
            const v2=new THREE.Vector3(positions[i2],positions[i2+1],positions[i2+2]);
            triangles.push({vertices:[v0,v1,v2],normal:v1.clone().sub(v0).cross(v2.clone().sub(v0)).normalize()});
        }
    } else {
        for(let i=0;i<positions.length;i+=9){
            const v0=new THREE.Vector3(positions[i],positions[i+1],positions[i+2]);
            const v1=new THREE.Vector3(positions[i+3],positions[i+4],positions[i+5]);
            const v2=new THREE.Vector3(positions[i+6],positions[i+7],positions[i+8]);
            triangles.push({vertices:[v0,v1,v2],normal:v1.clone().sub(v0).cross(v2.clone().sub(v0)).normalize()});
        }
    }
    const numTriangles=triangles.length;
    const buffer=new ArrayBuffer(84+numTriangles*50);
    const view=new DataView(buffer);
    const header='DIGIALIGNED Binary STL exported from DigiTrace';
    for(let i=0;i<80;i++)view.setUint8(i,i<header.length?header.charCodeAt(i):0);
    view.setUint32(80,numTriangles,true);
    let offset=84;
    for(const tri of triangles){
        view.setFloat32(offset,tri.normal.x,true);offset+=4;
        view.setFloat32(offset,tri.normal.y,true);offset+=4;
        view.setFloat32(offset,tri.normal.z,true);offset+=4;
        for(const v of tri.vertices){view.setFloat32(offset,v.x,true);offset+=4;view.setFloat32(offset,v.y,true);offset+=4;view.setFloat32(offset,v.z,true);offset+=4;}
        view.setUint16(offset,0,true);offset+=2;
    }
    return new Blob([buffer],{type:'application/octet-stream'});
}

function exportToOBJ(geometry) {
    const positions=geometry.attributes.position.array;
    const normals=geometry.attributes.normal?geometry.attributes.normal.array:null;
    const indices=geometry.index?geometry.index.array:null;
    let obj='# DIGIALIGNED\n# OBJ exported from DigiTrace\n\n';
    for(let i=0;i<positions.length;i+=3)obj+=`v ${positions[i].toFixed(6)} ${positions[i+1].toFixed(6)} ${positions[i+2].toFixed(6)}\n`;
    obj+='\n';
    if(normals){for(let i=0;i<normals.length;i+=3)obj+=`vn ${normals[i].toFixed(6)} ${normals[i+1].toFixed(6)} ${normals[i+2].toFixed(6)}\n`;obj+='\n';}
    if(indices){for(let i=0;i<indices.length;i+=3){const i0=indices[i]+1,i1=indices[i+1]+1,i2=indices[i+2]+1;obj+=normals?`f ${i0}//${i0} ${i1}//${i1} ${i2}//${i2}\n`:`f ${i0} ${i1} ${i2}\n`;}}
    else{for(let i=0;i<positions.length/3;i+=3){const i0=i+1,i1=i+2,i2=i+3;obj+=normals?`f ${i0}//${i0} ${i1}//${i1} ${i2}//${i2}\n`:`f ${i0} ${i1} ${i2}\n`;}}
    return new Blob([obj],{type:'text/plain'});
}

function exportToGLTF(geometry, binary=false) {
    const positions=geometry.attributes.position.array;
    const normals=geometry.attributes.normal?geometry.attributes.normal.array:null;
    const indices=geometry.index?geometry.index.array:null;
    const positionBuffer=new Float32Array(positions.length); for(let i=0;i<positions.length;i++)positionBuffer[i]=positions[i];
    let normalBuffer=null;
    if(normals){normalBuffer=new Float32Array(normals.length);for(let i=0;i<normals.length;i++)normalBuffer[i]=normals[i];}
    let indexBuffer=null,indexComponentType=5123;
    if(indices&&indices.length>0){
        let maxIndex=0;for(let i=0;i<indices.length;i++)if(indices[i]>maxIndex)maxIndex=indices[i];
        if(maxIndex>65535){indexBuffer=new Uint32Array(indices.length);indexComponentType=5125;}else{indexBuffer=new Uint16Array(indices.length);}
        for(let i=0;i<indices.length;i++)indexBuffer[i]=indices[i];
    }
    let minPos=[Infinity,Infinity,Infinity],maxPos=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<positions.length;i+=3){minPos[0]=Math.min(minPos[0],positions[i]);minPos[1]=Math.min(minPos[1],positions[i+1]);minPos[2]=Math.min(minPos[2],positions[i+2]);maxPos[0]=Math.max(maxPos[0],positions[i]);maxPos[1]=Math.max(maxPos[1],positions[i+1]);maxPos[2]=Math.max(maxPos[2],positions[i+2]);}
    if(binary)return createGLB(positionBuffer,normalBuffer,indexBuffer,indexComponentType,minPos,maxPos);
    return createGLTFJSON(positionBuffer,normalBuffer,indexBuffer,indexComponentType,minPos,maxPos);
}

function createGLB(positionBuffer,normalBuffer,indexBuffer,indexComponentType,minPos,maxPos) {
    const padTo4=n=>Math.ceil(n/4)*4;
    const pbl=positionBuffer.byteLength,nbl=normalBuffer?normalBuffer.byteLength:0,ibl=indexBuffer?indexBuffer.byteLength:0;
    const totalBufferLength=padTo4(pbl)+padTo4(nbl)+padTo4(ibl);
    const bufferViews=[],accessors=[]; let byteOffset=0;
    bufferViews.push({buffer:0,byteOffset,byteLength:pbl,target:34962});
    accessors.push({bufferView:0,byteOffset:0,componentType:5126,count:positionBuffer.length/3,type:'VEC3',min:minPos,max:maxPos});
    byteOffset+=padTo4(pbl);
    let normalAccessorIndex=-1;
    if(normalBuffer){bufferViews.push({buffer:0,byteOffset,byteLength:nbl,target:34962});normalAccessorIndex=accessors.length;accessors.push({bufferView:bufferViews.length-1,byteOffset:0,componentType:5126,count:normalBuffer.length/3,type:'VEC3'});byteOffset+=padTo4(nbl);}
    let indexAccessorIndex=-1;
    if(indexBuffer){bufferViews.push({buffer:0,byteOffset,byteLength:ibl,target:34963});indexAccessorIndex=accessors.length;accessors.push({bufferView:bufferViews.length-1,byteOffset:0,componentType:indexComponentType,count:indexBuffer.length,type:'SCALAR'});}
    const primitive={attributes:{POSITION:0},mode:4};
    if(normalAccessorIndex>=0)primitive.attributes.NORMAL=normalAccessorIndex;
    if(indexAccessorIndex>=0)primitive.indices=indexAccessorIndex;
    const gltf={asset:{version:'2.0',generator:'DigiTrace'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[primitive]}],accessors,bufferViews,buffers:[{byteLength:totalBufferLength}]};
    const jsonBuffer=new TextEncoder().encode(JSON.stringify(gltf));
    const paddedJsonLength=padTo4(jsonBuffer.byteLength);
    const glbLength=12+8+paddedJsonLength+8+totalBufferLength;
    const glb=new ArrayBuffer(glbLength); const glbView=new DataView(glb); const glbBytes=new Uint8Array(glb);
    glbView.setUint32(0,0x46546C67,true); glbView.setUint32(4,2,true); glbView.setUint32(8,glbLength,true);
    glbView.setUint32(12,paddedJsonLength,true); glbView.setUint32(16,0x4E4F534A,true);
    glbBytes.set(jsonBuffer,20); for(let i=jsonBuffer.byteLength;i<paddedJsonLength;i++)glbBytes[20+i]=0x20;
    const binChunkStart=20+paddedJsonLength;
    glbView.setUint32(binChunkStart,totalBufferLength,true); glbView.setUint32(binChunkStart+4,0x004E4942,true);
    let binOffset=binChunkStart+8;
    glbBytes.set(new Uint8Array(positionBuffer.buffer,positionBuffer.byteOffset,pbl),binOffset); binOffset+=padTo4(pbl);
    if(normalBuffer){glbBytes.set(new Uint8Array(normalBuffer.buffer,normalBuffer.byteOffset,nbl),binOffset);binOffset+=padTo4(nbl);}
    if(indexBuffer)glbBytes.set(new Uint8Array(indexBuffer.buffer,indexBuffer.byteOffset,ibl),binOffset);
    return new Blob([glb],{type:'model/gltf-binary'});
}

function createGLTFJSON(positionBuffer,normalBuffer,indexBuffer,indexComponentType,minPos,maxPos) {
    const totalLength=positionBuffer.byteLength+(normalBuffer?normalBuffer.byteLength:0)+(indexBuffer?indexBuffer.byteLength:0);
    const combinedBuffer=new Uint8Array(totalLength); let offset=0;
    combinedBuffer.set(new Uint8Array(positionBuffer.buffer,positionBuffer.byteOffset,positionBuffer.byteLength),offset);
    const positionOffset=offset; offset+=positionBuffer.byteLength;
    let normalOffset=0;
    if(normalBuffer){combinedBuffer.set(new Uint8Array(normalBuffer.buffer,normalBuffer.byteOffset,normalBuffer.byteLength),offset);normalOffset=offset;offset+=normalBuffer.byteLength;}
    let indexOffset=0;
    if(indexBuffer){combinedBuffer.set(new Uint8Array(indexBuffer.buffer,indexBuffer.byteOffset,indexBuffer.byteLength),offset);indexOffset=offset;}
    let binary=''; const chunkSize=8192;
    for(let i=0;i<combinedBuffer.length;i+=chunkSize)binary+=String.fromCharCode.apply(null,combinedBuffer.subarray(i,Math.min(i+chunkSize,combinedBuffer.length)));
    const dataUri='data:application/octet-stream;base64,'+btoa(binary);
    const bufferViews=[],accessors=[];
    bufferViews.push({buffer:0,byteOffset:positionOffset,byteLength:positionBuffer.byteLength,target:34962});
    accessors.push({bufferView:0,byteOffset:0,componentType:5126,count:positionBuffer.length/3,type:'VEC3',min:minPos,max:maxPos});
    let normalAccessorIndex=-1;
    if(normalBuffer){bufferViews.push({buffer:0,byteOffset:normalOffset,byteLength:normalBuffer.byteLength,target:34962});normalAccessorIndex=accessors.length;accessors.push({bufferView:bufferViews.length-1,byteOffset:0,componentType:5126,count:normalBuffer.length/3,type:'VEC3'});}
    let indexAccessorIndex=-1;
    if(indexBuffer){bufferViews.push({buffer:0,byteOffset:indexOffset,byteLength:indexBuffer.byteLength,target:34963});indexAccessorIndex=accessors.length;accessors.push({bufferView:bufferViews.length-1,byteOffset:0,componentType:indexComponentType,count:indexBuffer.length,type:'SCALAR'});}
    const primitive={attributes:{POSITION:0},mode:4};
    if(normalAccessorIndex>=0)primitive.attributes.NORMAL=normalAccessorIndex;
    if(indexAccessorIndex>=0)primitive.indices=indexAccessorIndex;
    const gltf={asset:{version:'2.0',generator:'DigiTrace'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[primitive]}],accessors,bufferViews,buffers:[{byteLength:totalLength,uri:dataUri}]};
    return new Blob([JSON.stringify(gltf,null,2)],{type:'model/gltf+json'});
}

function triggerDownload(blob, filename) {
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=filename; a.style.display='none'; document.body.appendChild(a); a.click();
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},100);
}

function downloadCombinedModel() {
    try {
        const geometry=getCombinedGeometry();
        if(!geometry){showToast('אין מודלים גלויים להורדה', 'error');return;}
        if(geometry.attributes.position.array.length/3===0){showToast('המודל ריק', 'error');return;}
        const format=document.getElementById('exportFormat').value;
        let blob,filename;
        switch(format){
            case 'stl': blob=exportToSTL(geometry); filename='combined_model.stl'; break;
            case 'obj': blob=exportToOBJ(geometry); filename='combined_model.obj'; break;
            case 'glb': blob=exportToGLTF(geometry,true); filename='combined_model.glb'; break;
            case 'gltf': blob=exportToGLTF(geometry,false); filename='combined_model.gltf'; break;
        }
        triggerDownload(blob, filename);
    } catch(error) { showToast('שגיאה בהורדה: '+error.message, 'error'); }
}

function downloadSingleModel(id) {
    const model=models.find(m=>m.id===id); if(!model)return;
    const format=document.getElementById('exportFormat').value;
    const baseName=model.name.replace(/\.[^.]+$/,'');
    const geo=getSingleModelGeometry(model);
    let blob,ext;
    switch(format){
        case 'stl':blob=exportToSTL(geo);ext='stl';break;
        case 'obj':blob=exportToOBJ(geo);ext='obj';break;
        case 'glb':blob=exportToGLTF(geo,true);ext='glb';break;
        case 'gltf':blob=exportToGLTF(geo,false);ext='gltf';break;
        default:blob=exportToGLTF(geo,true);ext='glb';
    }
    triggerDownload(blob,`aligned_${baseName}.${ext}`);
}

async function downloadAllSeparate() {
    const visibleModels=models.filter(m=>m.visible);
    if(!visibleModels.length){showToast('אין מודלים גלויים', 'error');return;}
    const format=document.getElementById('exportFormat').value;
    const files=[];
    for(const model of visibleModels){
        const geo=getSingleModelGeometry(model); const baseName=model.name.replace(/\.[^.]+$/,'');
        let blob,ext;
        switch(format){
            case 'stl':blob=exportToSTL(geo);ext='stl';break;
            case 'obj':blob=exportToOBJ(geo);ext='obj';break;
            case 'glb':blob=exportToGLTF(geo,true);ext='glb';break;
            case 'gltf':blob=exportToGLTF(geo,false);ext='gltf';break;
        }
        files.push({blob,filename:`aligned_${baseName}.${ext}`});
    }
    if(files.length>3){
        if(typeof JSZip==='undefined'){showToast('שגיאה: JSZip לא נטענה', 'error');return;}
        const zip=new JSZip();
        for(const f of files){zip.file(f.filename,await f.blob.arrayBuffer());}
        const zipBlob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
        triggerDownload(zipBlob,`digitage_models_${files.length}.zip`);
    } else {
        for(const f of files){triggerDownload(f.blob,f.filename);await new Promise(r=>setTimeout(r,300));}
    }
}
