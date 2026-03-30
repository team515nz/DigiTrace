/* ────────────────────────────────────────────────────────────────────────── */
/* app.js - Application Utilities & Infrastructure                            */
/* Merged from: loaders.js, storage.js, ui.js, i18n.js, translations.js       */
/* ────────────────────────────────────────────────────────────────────────── */

// ────────────────────────────────────────────────────────────────────────── 
// ─── FILE LOADERS ───────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────── 

// ─── OBJ Loader ─────────────────────────────────────────────────────────
function loadOBJFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            try {
                const isAligned = text.startsWith('# DIGIALIGNED');
                const geometry = parseOBJ(text);
                if (geometry && geometry.attributes.position.count > 0) {
                    geometry.userData = { isAligned };
                    resolve([geometry]);
                } else reject(new Error('הקובץ ריק או לא תקין'));
            } catch (err) { reject(new Error('שגיאה בניתוח הקובץ: ' + err.message)); }
        };
        reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
        reader.readAsText(file);
    });
}

function parseOBJ(text) {
    const vertices = [];
    const faces = [];
    const lines = text.split('\n');
    let vertexCount = 0;
    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('v ')) {
            const parts = line.split(/\s+/);
            if (parts.length >= 4) {
                const x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3]);
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) { vertices.push(x, y, z); vertexCount++; }
            }
        }
    }
    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('f ')) {
            const parts = line.split(/\s+/).slice(1);
            if (parts.length < 3) continue;
            const faceIndices = [];
            let valid = true;
            for (let part of parts) {
                const idx = parseInt(part.split('/')[0]);
                let realIdx = idx > 0 ? idx - 1 : vertexCount + idx;
                if (realIdx < 0 || realIdx >= vertexCount) { valid = false; break; }
                faceIndices.push(realIdx);
            }
            if (valid && faceIndices.length >= 3) {
                for (let i = 1; i < faceIndices.length - 1; i++) faces.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
            }
        }
    }
    if (vertices.length === 0) throw new Error('לא נמצאו vertices בקובץ');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    if (faces.length > 0) geometry.setIndex(faces);
    geometry.computeVertexNormals();
    return geometry;
}

// ─── STL Loader ─────────────────────────────────────────────────────────
function loadSTLFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const headerBytes = new Uint8Array(e.target.result, 0, 80);
                const headerText = new TextDecoder().decode(headerBytes);
                const isAligned = headerText.includes('DIGIALIGNED');
                const geometry = parseSTL(e.target.result);
                if (geometry) { geometry.userData = { isAligned }; resolve([geometry]); }
                else reject(new Error('Failed to parse STL'));
            } catch (err) { reject(new Error('שגיאה בניתוח STL: ' + err.message)); }
        };
        reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
        reader.readAsArrayBuffer(file);
    });
}

function parseSTL(buffer) {
    const view = new DataView(buffer);
    const header = new Uint8Array(buffer, 0, 5);
    const headerText = String.fromCharCode.apply(null, header);
    if (headerText === 'solid') return parseSTLASCII(new TextDecoder().decode(buffer));
    return parseSTLBinary(view);
}

function parseSTLBinary(view) {
    if (view.byteLength < 84) throw new Error('קובץ STL קצר מדי');
    const triangles = view.getUint32(80, true);
    if (view.byteLength < 84 + triangles * 50) throw new Error('גודל קובץ STL לא תואם');
    const vertices = [];
    for (let i = 0; i < triangles; i++) {
        const offset = 84 + i * 50;
        for (let j = 0; j < 3; j++) {
            const x = view.getFloat32(offset + 12 + j * 12, true);
            const y = view.getFloat32(offset + 16 + j * 12, true);
            const z = view.getFloat32(offset + 20 + j * 12, true);
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) vertices.push(x, y, z);
        }
    }
    if (vertices.length === 0) throw new Error('לא נמצאו vertices תקינים');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
}

function parseSTLASCII(text) {
    const vertices = [];
    for (let line of text.split('\n')) {
        line = line.trim();
        if (line.startsWith('vertex')) {
            const parts = line.split(/\s+/);
            if (parts.length >= 4) {
                const x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3]);
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) vertices.push(x, y, z);
            }
        }
    }
    if (vertices.length === 0) throw new Error('לא נמצאו vertices בקובץ');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
}

// ─── GLTF/GLB Loader ────────────────────────────────────────────────────
function loadGLTFFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const ext = file.name.split('.').pop().toLowerCase();
                let gltfData;
                if (ext === 'gltf') { gltfData = JSON.parse(new TextDecoder().decode(e.target.result)); }
                else if (ext === 'glb') { gltfData = parseGLB(e.target.result); }
                const geometries = parseGLTF(gltfData);
                if (geometries && geometries.length > 0) resolve(geometries);
                else reject(new Error('לא נמצאו geometries בקובץ GLTF/GLB'));
            } catch (err) { reject(new Error('שגיאה בניתוח GLTF/GLB: ' + err.message)); }
        };
        reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
        reader.readAsArrayBuffer(file);
    });
}

function parseGLB(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    if (view.getUint32(0, true) !== (0x46546C60 + 7)) throw new Error('זה לא קובץ GLB תקין');
    const length = view.getUint32(8, true);
    const jsonChunkLength = view.getUint32(12, true);
    if (view.getUint32(16, true) !== 0x4E4F534A) throw new Error('פורמט GLB לא תקין');
    const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(arrayBuffer, 20, jsonChunkLength)));
    if (20 + jsonChunkLength + 8 <= length) {
        const binLen = view.getUint32(20 + jsonChunkLength, true);
        if (view.getUint32(20 + jsonChunkLength + 4, true) === 0x004E4942)
            gltf.binaryData = arrayBuffer.slice(20 + jsonChunkLength + 8, 20 + jsonChunkLength + 8 + binLen);
    }
    return gltf;
}

function parseGLTF(gltf) {
    const geometries = [];
    if (!gltf.meshes || !gltf.meshes.length) throw new Error('לא נמצאו meshes');
    gltf.meshes.forEach(mesh => {
        mesh.primitives.forEach(primitive => {
            try { const g = parsePrimitive(primitive, gltf); if (g) geometries.push(g); } catch(e) {}
        });
    });
    return geometries;
}

function parsePrimitive(primitive, gltf) {
    const geometry = new THREE.BufferGeometry();
    if (primitive.attributes.POSITION === undefined) throw new Error('לא נמצא POSITION');
    const positions = getAccessorData(gltf.accessors[primitive.attributes.POSITION], gltf);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (primitive.attributes.NORMAL !== undefined) {
        const normals = getAccessorData(gltf.accessors[primitive.attributes.NORMAL], gltf);
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    }
    if (primitive.indices !== undefined) {
        const indices = getAccessorData(gltf.accessors[primitive.indices], gltf);
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    }
    if (primitive.attributes.NORMAL === undefined) geometry.computeVertexNormals();
    return geometry;
}

function getAccessorData(accessor, gltf) {
    const bufferView = gltf.bufferViews[accessor.bufferView];
    if (!gltf.binaryData) throw new Error('רק GLB נתמך כרגע');
    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    const componentType = accessor.componentType;
    const count = accessor.count;
    const type = accessor.type;
    let TypedArray, componentSize;
    switch(componentType) {
        case 5120: TypedArray=Int8Array; componentSize=1; break;
        case 5121: TypedArray=Uint8Array; componentSize=1; break;
        case 5122: TypedArray=Int16Array; componentSize=2; break;
        case 5123: TypedArray=Uint16Array; componentSize=2; break;
        case 5125: TypedArray=Uint32Array; componentSize=4; break;
        case 5126: TypedArray=Float32Array; componentSize=4; break;
        default: throw new Error('Component type לא נתמך');
    }
    let numComponents;
    switch(type) {
        case 'SCALAR': numComponents=1; break; case 'VEC2': numComponents=2; break;
        case 'VEC3': numComponents=3; break; case 'VEC4': numComponents=4; break;
        case 'MAT2': numComponents=4; break; case 'MAT3': numComponents=9; break;
        case 'MAT4': numComponents=16; break;
        default: throw new Error('Type לא נתמך');
    }
    const elementSize = numComponents * componentSize;
    const stride = bufferView.byteStride || elementSize;
    const data = new TypedArray(count * numComponents);
    if (stride === elementSize) {
        data.set(new TypedArray(gltf.binaryData, byteOffset, count * numComponents));
    } else {
        const srcView = new DataView(gltf.binaryData, byteOffset);
        for (let i = 0; i < count; i++) {
            for (let j = 0; j < numComponents; j++) {
                const o = i * stride + j * componentSize;
                if (TypedArray === Float32Array) data[i*numComponents+j] = srcView.getFloat32(o, true);
                else if (TypedArray === Uint32Array) data[i*numComponents+j] = srcView.getUint32(o, true);
                else if (TypedArray === Uint16Array) data[i*numComponents+j] = srcView.getUint16(o, true);
                else if (TypedArray === Int16Array) data[i*numComponents+j] = srcView.getInt16(o, true);
                else if (TypedArray === Uint8Array) data[i*numComponents+j] = srcView.getUint8(o);
                else if (TypedArray === Int8Array) data[i*numComponents+j] = srcView.getInt8(o);
            }
        }
    }
    return data;
}

// ────────────────────────────────────────────────────────────────────────── 
// ─── PERSISTENCE & STORAGE ──────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────── 

// ─── IndexedDB ────────────────────────────────────────────────────────────
let _idb = null;

function openIDB() {
    return new Promise((resolve, reject) => {
        if (_idb) return resolve(_idb);
        const req = indexedDB.open(IDB_NAME, 2);
        req.onupgradeneeded = e => { const db=e.target.result; if(!db.objectStoreNames.contains(IDB_STORE))db.createObjectStore(IDB_STORE,{keyPath:'name'}); };
        req.onsuccess = e => { _idb=e.target.result; resolve(_idb); };
        req.onerror = () => reject(req.error);
    });
}

async function idbPut(record) {
    const db = await openIDB();
    return new Promise((resolve,reject)=>{const tx=db.transaction(IDB_STORE,'readwrite');tx.objectStore(IDB_STORE).put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}

async function idbGetAll() {
    const db = await openIDB();
    return new Promise((resolve,reject)=>{const tx=db.transaction(IDB_STORE,'readonly');const req=tx.objectStore(IDB_STORE).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
}

async function idbDelete(name) {
    const db = await openIDB();
    return new Promise((resolve,reject)=>{const tx=db.transaction(IDB_STORE,'readwrite');tx.objectStore(IDB_STORE).delete(name);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}

// ─── Geometry Serialization ────────────────────────────────────────────────
function geometryToArrayBuffer(geometry) {
    const positions=geometry.attributes.position.array;
    const normals=geometry.attributes.normal?geometry.attributes.normal.array:null;
    const indices=geometry.index?geometry.index.array:null;
    const posLen=positions.length,normLen=normals?normals.length:0,idxLen=indices?indices.length:0;
    const idxIsU32=!!(indices&&idxLen>65535);
    const HEADER=16;
    const posBytes=new Float32Array(positions),normBytes=normals?new Float32Array(normals):new Float32Array(0);
    const idxBytes=idxLen>0?(idxIsU32?new Uint32Array(indices):new Uint16Array(indices)):new Uint16Array(0);
    const totalBytes=HEADER+posBytes.byteLength+normBytes.byteLength+idxBytes.byteLength;
    const buf=new ArrayBuffer(totalBytes); const view=new Uint8Array(buf);
    new Int32Array(buf,0,3).set([posLen,normLen,idxLen]); new Uint8Array(buf,12,1)[0]=idxIsU32?1:0;
    let offset=HEADER;
    view.set(new Uint8Array(posBytes.buffer),offset);offset+=posBytes.byteLength;
    if(normBytes.byteLength){view.set(new Uint8Array(normBytes.buffer),offset);offset+=normBytes.byteLength;}
    if(idxBytes.byteLength)view.set(new Uint8Array(idxBytes.buffer),offset);
    return buf;
}

function arrayBufferToGeometry(buf) {
    const posLen=new Int32Array(buf,0,1)[0],normLen=new Int32Array(buf,4,1)[0],idxLen=new Int32Array(buf,8,1)[0];
    const flag=new Uint8Array(buf,12,1)[0];
    const expectedOld=13+posLen*4+normLen*4+idxLen*(flag?4:2);
    const HEADER=(buf.byteLength===expectedOld)?13:16;
    let offset=HEADER;
    const posData=new Float32Array(buf.slice(offset,offset+posLen*4));offset+=posLen*4;
    let normData=null;
    if(normLen>0){normData=new Float32Array(buf.slice(offset,offset+normLen*4));offset+=normLen*4;}
    let idxData=null;
    if(idxLen>0){const bytes=idxLen*(flag?4:2);idxData=flag?new Uint32Array(buf.slice(offset,offset+bytes)):new Uint16Array(buf.slice(offset,offset+bytes));}
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(posData,3));
    if(normData)geo.setAttribute('normal',new THREE.Float32BufferAttribute(normData,3));
    if(idxData)geo.setIndex(new THREE.BufferAttribute(idxData,1));
    return geo;
}

async function saveModelToIDB(model) {
    try {
        const geoBuffers=model.originalGeometries.filter(g=>g&&g.attributes&&g.attributes.position).map(g=>geometryToArrayBuffer(g));
        await idbPut({name:model.name,color:model.color,unit:model.unit||'m',geoBuffers});
    } catch(e) { console.warn('saveModelToIDB error:',e); }
}

// ─── Session Save / Restore ────────────────────────────────────────────────
async function saveSession() {
    try {
        const cutYEl = document.getElementById('cutY');
        const cutXEl = document.getElementById('cutX');
        const cutZEl = document.getElementById('cutZ');
        const exportEl = document.getElementById('exportFormat');
        const rulerEl = document.getElementById('rulerOverlay');
        
        const session={
            camera:{horizontal:cameraRotation.horizontal,vertical:cameraRotation.vertical,distance:cameraDistance},
            sliders:{cutY:cutYEl?.value||'0',cutX:cutXEl?.value||'0',cutZ:cutZEl?.value||'0'},
            exportFormat:exportEl?.value||'stl',
            baseModelId,
            ruler:rulerState.finished?{points:rulerState.points.map(p=>({x:p.x,y:p.y,z:p.z})),modelUnit:rulerState.modelUnit,displayText:rulerEl?.textContent||''}:null,
            models:models.map(m=>({
                name:m.name,date:m.date,unit:m.unit||'m',color:m.color,visible:m.visible,
                position:{x:m.group.position.x,y:m.group.position.y,z:m.group.position.z},
                rotation:{x:m.group.rotation.x,y:m.group.rotation.y,z:m.group.rotation.z},
                scale:{x:m.group.scale.x,y:m.group.scale.y,z:m.group.scale.z}
            }))
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        const expires=new Date(Date.now()+30*24*60*60*1000).toUTCString();
        const mini={cutY:session.sliders.cutY,cutX:session.sliders.cutX,cutZ:session.sliders.cutZ};
        document.cookie=`digitrace=${encodeURIComponent(JSON.stringify(mini))};expires=${expires};path=/;SameSite=Lax`;
    } catch(e) { console.warn('saveSession error:',e); }
}

async function restoreFullSession() {
    try {
        const raw=localStorage.getItem(STORAGE_KEY); if(!raw)return false;
        const session=JSON.parse(raw);
        if(session.camera){cameraRotation.horizontal=session.camera.horizontal??45;cameraRotation.vertical=session.camera.vertical??30;cameraDistance=session.camera.distance??8;}
        if(session.sliders){
            ['cutY','cutX','cutZ'].forEach(id=>{
                const el = document.getElementById(id);
                if(el) el.value=session.sliders[id];
            });
            const cutYVal = document.getElementById('cutYValue');
            const cutXVal = document.getElementById('cutXValue');
            const cutZVal = document.getElementById('cutZValue');
            if(cutYVal) setTextCensored(cutYVal,`חיתוך אנכי: ${session.sliders.cutY}%`);
            if(cutXVal) setTextCensored(cutXVal,`חיתוך רוחב: ${session.sliders.cutX}%`);
            if(cutZVal) setTextCensored(cutZVal,`חיתוך עומק: ${session.sliders.cutZ}%`);
        }
        const exportEl = document.getElementById('exportFormat');
        if(session.exportFormat && exportEl) exportEl.value=session.exportFormat;
        if(session.baseModelId!==undefined)baseModelId=session.baseModelId;
        if(session.ruler&&session.ruler.points&&session.ruler.points.length===2)window._pendingRulerRestore=session.ruler;
        if(!session.models||!session.models.length){restorePendingRuler();return true;}
        const idbRecords=await idbGetAll();
        const idbMap={}; idbRecords.forEach(r=>idbMap[r.name]=r);
        if(!scene)initThreeJS();
        const loadingMsg=document.getElementById('loadingMessage'); if(loadingMsg) loadingMsg.classList.remove('hidden');
        for(const meta of session.models){
            const idbRec=idbMap[meta.name]; if(!idbRec)continue;
            if(loadingMsg) loadingMsg.textContent=censor(`משחזר ${meta.name}...`);
            try {
                const mainGroup=new THREE.Group();
                const color=meta.color||MODEL_COLORS[models.length%MODEL_COLORS.length].hex;
                idbRec.geoBuffers.forEach(buf=>{
                    const geometry=arrayBufferToGeometry(buf);
                    const material=new THREE.MeshStandardMaterial({color,transparent:true,opacity:0.85,side:THREE.DoubleSide,flatShading:false});
                    mainGroup.add(new THREE.Mesh(geometry,material));
                });
                if(!mainGroup.children.length)continue;
                mainGroup.position.set(meta.position.x,meta.position.y,meta.position.z);
                mainGroup.rotation.set(meta.rotation.x,meta.rotation.y,meta.rotation.z);
                mainGroup.scale.set(meta.scale.x,meta.scale.y,meta.scale.z);
                mainGroup.visible=meta.visible;
                scene.add(mainGroup);
                models.push({id:modelCounter++,name:meta.name,date:meta.date,group:mainGroup,meshes:mainGroup.children,visible:meta.visible,originalGeometries:mainGroup.children.map(m=>m.geometry.clone()),color,unit:meta.unit||'m'});
            } catch(e) { console.warn('restore model error:',meta.name,e); }
        }
        if(loadingMsg) loadingMsg.classList.add('hidden');
        // Wait for sidebarController to be ready (it initializes with a 100ms delay)
        const _doRestore = () => {
            updateModelList(); calculateGlobalBoundingBox(); updateCameraPosition(); applyCuts(); restorePendingRuler();
        };
        if (typeof sidebarController !== 'undefined' && sidebarController) {
            _doRestore();
        } else {
            setTimeout(_doRestore, 200);
        }
        return true;
    } catch(e) { console.warn('restoreFullSession error:',e); return false; }
}

function restoreModelTransform(modelData) {
    const raw=localStorage.getItem(STORAGE_KEY); if(!raw)return;
    try {
        const session=JSON.parse(raw);
        const meta=session.models&&session.models.find(m=>m.name===modelData.name);
        if(!meta)return;
        modelData.group.position.set(meta.position.x,meta.position.y,meta.position.z);
        modelData.group.rotation.set(meta.rotation.x,meta.rotation.y,meta.rotation.z);
        modelData.group.scale.set(meta.scale.x,meta.scale.y,meta.scale.z);
        modelData.visible=meta.visible; modelData.group.visible=meta.visible;
        if(meta.unit)modelData.unit=meta.unit;
    } catch(e) {}
}

// ─── Censoring Helpers ──────────────────────────────────────────────────────
function censor(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/B/g, '🚫');
}

function censorNumber(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/B/g, '🚫');
}

function setTextCensored(el, text) {
    if (el) el.textContent = censor(text);
}

// ─── Auto-save Timer ───────────────────────────────────────────────────────
setInterval(saveSession, 8000);
window.addEventListener('beforeunload', saveSession);
window.addEventListener('load', async () => { await restoreFullSession(); restoreAnchorFromStorage(); });

// ────────────────────────────────────────────────────────────────────────── 
// ─── USER INTERFACE ──────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────── 

// ─── Toast Notifications ───────────────────────────────────────────────────
function showToast(msg, type='success') {
    let toast=document.getElementById('_toast');
    if(!toast){
        toast=document.createElement('div'); toast.id='_toast';
        toast.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 22px;border-radius:8px;font-size:0.92em;color:#fff;z-index:99999;pointer-events:none;transition:opacity 0.4s;white-space:nowrap;max-width:90vw;text-align:center;';
        document.body.appendChild(toast);
    }
    toast.style.background = type==='error' ? '#a33' : '#2a7a4a';
    toast.textContent = msg; toast.style.opacity = '1';
    clearTimeout(toast._timer); toast._timer = setTimeout(() => { toast.style.opacity='0'; }, 4000);
}

// ─── Fullscreen ────────────────────────────────────────────────────────────
function toggleFullscreen() {
    const body=document.body;
    const controls=document.getElementById('fullscreenControls');
    const closeBtn=document.querySelector('.close-fullscreen');
    body.classList.toggle('fullscreen-mode');
    controls.classList.toggle('active');
    closeBtn.classList.toggle('active');
    if(body.classList.contains('fullscreen-mode')){
        document.getElementById('cutYFS').value=document.getElementById('cutY').value;
        document.getElementById('cutXFS').value=document.getElementById('cutX').value;
        document.getElementById('cutZFS').value=document.getElementById('cutZ').value;
        document.getElementById('cutYValueFS').textContent=document.getElementById('cutYValue').textContent;
        document.getElementById('cutXValueFS').textContent=document.getElementById('cutXValue').textContent;
        document.getElementById('cutZValueFS').textContent=document.getElementById('cutZValue').textContent;
    }
    setTimeout(()=>{
        if(renderer&&camera){const container=document.getElementById('canvas-container');camera.aspect=container.clientWidth/container.clientHeight;camera.updateProjectionMatrix();renderer.setSize(container.clientWidth,container.clientHeight);}
    },100);
}

// ─── Help Modal ────────────────────────────────────────────────────────────
function toggleHelp() {
    const modal=document.getElementById('helpModal');
    if(modal.style.display==='block'){modal.style.display='none';}
    else{modal.style.display='block'; if(document.querySelector('.loading-help'))loadReadme();}
}

async function loadReadme() {
    try {
        const response=await fetch('README.md');
        if(!response.ok)throw new Error();
        const html=marked.parse(await response.text());
        document.getElementById('helpContent').innerHTML=`<div class="readme-content">${html}</div>`;
    } catch(error) {
        try{const t=document.getElementById('readmeTemplate').textContent;document.getElementById('helpContent').innerHTML=`<div class="readme-content">${marked.parse(t)}</div>`;}
        catch(e){document.getElementById('helpContent').innerHTML='<div class="error-message"><h3>⚠️ שגיאה</h3></div>';}
    }
}

// ─── Keyboard Shortcuts ────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
    if(e.key==='Escape'){
        if(anchorState.picking){anchorState.picking=false;document.getElementById('canvas-container').style.cursor='';updateAnchorStatus();saveAnchorToStorage();}
        if(alignState.active)cancelAlignment();
    }
});

window.addEventListener('click', (event) => {
    const modal=document.getElementById('helpModal');
    if(event.target===modal)modal.style.display='none';
});

// ─── Sidebar Integration Events ────────────────────────────────────────────
document.addEventListener('sidebar:filesSelected', async (e) => {
    const files = e.detail.files;
    if (!files.length) return;

    // ── DEBUG ──────────────────────────────────────────────────────────────
    console.log('[DigiTrace] sidebar:filesSelected fired', {
        fileCount: files.length,
        sceneExists: typeof scene !== 'undefined' && !!scene,
        rendererExists: typeof renderer !== 'undefined' && !!renderer,
        canvasContainer: !!document.getElementById('canvas-container'),
        THREE_loaded: typeof THREE !== 'undefined',
    });
    // ──────────────────────────────────────────────────────────────────────

    // Ensure the 3D scene is initialized before loading any model
    if (!scene) {
        console.warn('[DigiTrace] scene not ready — calling initThreeJS() now');
        try {
            initThreeJS();
            console.log('[DigiTrace] initThreeJS() completed. scene:', !!scene, 'renderer:', !!renderer);
        } catch (initErr) {
            console.error('[DigiTrace] initThreeJS() threw an error:', initErr);
        }
    }

    for (const file of files) {
        try {
            let color = MODEL_COLORS[models.length % MODEL_COLORS.length].hex;
            console.log('[DigiTrace] Loading file:', file.name, '| scene:', !!scene);
            await addModelFromFile(file, color);
            showToast(`✓ Loaded: ${file.name}`);
        } catch (error) {
            console.error('[DigiTrace] addModelFromFile failed for', file.name, error);
            showToast(`✗ Error loading ${file.name}`, 'error');
        }
    }
});

document.addEventListener('sidebar:toggleModelVisibility', (e) => {
    toggleVisibility(e.detail.modelId);
});

document.addEventListener('sidebar:setAsBase', (e) => {
    setBaseModel(parseInt(e.detail.modelId));
});

document.addEventListener('sidebar:downloadModel', (e) => {
    downloadSingleModel(parseInt(e.detail.modelId));
});

document.addEventListener('sidebar:removeModel', (e) => {
    if (confirm('Remove this model?')) {
        deleteModel(parseInt(e.detail.modelId));
    }
});

document.addEventListener('sidebar:formatSelected', (e) => {
    document.getElementById('exportFormat').value = e.detail.format;
});

// ─── Floating Clipping Controls Sync ───────────────────────────────────────
document.addEventListener('sidebar:panelOpened', () => {
    document.getElementById('floatingClippingToolbar').classList.remove('visible');
});

document.addEventListener('sidebar:panelClosed', () => {
    if (models.length > 0) {
        document.getElementById('floatingClippingToolbar').classList.add('visible');
    }
});

// Initialize floating toolbar controls
window.addEventListener('load', () => {
    const syncToFloating = () => {
        const cutY = document.getElementById('cutY')?.value || 0;
        const cutX = document.getElementById('cutX')?.value || 0;
        const cutZ = document.getElementById('cutZ')?.value || 0;
        
        if (document.getElementById('cutYFloat')) document.getElementById('cutYFloat').value = cutY;
        if (document.getElementById('cutXFloat')) document.getElementById('cutXFloat').value = cutX;
        if (document.getElementById('cutZFloat')) document.getElementById('cutZFloat').value = cutZ;
        
        if (document.getElementById('cutYValueFloat')) document.getElementById('cutYValueFloat').textContent = cutY + '%';
        if (document.getElementById('cutXValueFloat')) document.getElementById('cutXValueFloat').textContent = cutX + '%';
        if (document.getElementById('cutZValueFloat')) document.getElementById('cutZValueFloat').textContent = cutZ + '%';
    };
    
    const syncToMain = (id, floatId, valueId) => {
        const floatVal = document.getElementById(floatId)?.value;
        if (floatVal !== undefined && document.getElementById(id)) {
            document.getElementById(id).value = floatVal;
            if (document.getElementById(valueId)) {
                document.getElementById(valueId).textContent = floatVal + '%';
            }
            applyCuts();
        }
    };
    
    // Sync floating controls
    if (document.getElementById('cutYFloat')) {
        document.getElementById('cutYFloat').addEventListener('input', () => syncToMain('cutY', 'cutYFloat', 'cutYValue'));
    }
    if (document.getElementById('cutXFloat')) {
        document.getElementById('cutXFloat').addEventListener('input', () => syncToMain('cutX', 'cutXFloat', 'cutXValue'));
    }
    if (document.getElementById('cutZFloat')) {
        document.getElementById('cutZFloat').addEventListener('input', () => syncToMain('cutZ', 'cutZFloat', 'cutZValue'));
    }
    
    // Sync main controls to floating
    if (document.getElementById('cutY')) {
        document.getElementById('cutY').addEventListener('input', syncToFloating);
    }
    if (document.getElementById('cutX')) {
        document.getElementById('cutX').addEventListener('input', syncToFloating);
    }
    if (document.getElementById('cutZ')) {
        document.getElementById('cutZ').addEventListener('input', syncToFloating);
    }
});

// ────────────────────────────────────────────────────────────────────────── 
// ─── INTERNATIONALIZATION & TRANSLATIONS ─────────────────────────────────
// ────────────────────────────────────────────────────────────────────────── 

// ─── Translation Dictionary ────────────────────────────────────────────────
window.TRANSLATIONS = {
  "en": {
    "nativeName": "English",
    "siteTitle": "DigiTrace - 🏺 3D Archaeological Excavation Analysis",
    "siteSubtitle": "Upload 3D models and analyze excavation layers • Flexible alignment with multiple points",
    "uploadTitle": "📁 Upload Models",
    "uploadHint": "Click to upload a 3D file",
    "fileFormats": "OBJ, STL, GLB, GLTF",
    "uploadedModels": "📋 Uploaded Models",
    "downloadModel": "📥 Download Combined Model",
    "exportFormat": "Export Format",
    "alignTitle": "🎯 Flexible Model Alignment",
    "alignInfo": "Click the 📍 next to a model and choose points on it",
    "pointCounter": "Model 1: 0 points | Model 2: 0 points",
    "finishModelBtn": "Finish Current Model →",
    "undoPointBtn": "↶ Undo Last Point",
    "executeAlignBtn": "Align Models",
    "cancelBtn": "Cancel",
    "fullscreenBtn": "🖵 Fullscreen",
    "helpBtn": "❓ Help",
    "cutYValue": "Vertical cut: 0%",
    "cutXValue": "Horizontal cut: 0%",
    "cutZValue": "Depth cut: 0%",
    "cutYLabel": "Vertical cut (top → bottom)",
    "cutXLabel": "Horizontal cut (left → right)",
    "cutZLabel": "Depth cut (back → front)",
    "closeFullscreen": "✕ Close Fullscreen",
    "colorLabel": "Color"
  },
  "he": {
    "nativeName": "עברית",
    "siteTitle": "DigiTrace - 🏺 מערכת ניתוח חפירות ארכיאולוגיות 3D",
    "siteSubtitle": "העלאת מודלים תלת-ממדיים וניתוח שכבות חפירה • יישור גמיש עם מספר נקודות",
    "uploadTitle": "📁 העלאת מודלים",
    "uploadHint": "לחץ להעלאת קובץ 3D",
    "fileFormats": "OBJ, STL, GLB, GLTF",
    "uploadedModels": "📋 מודלים שהועלו",
    "downloadModel": "📥 הורדת מודל משולב",
    "exportFormat": "פורמט יצוא",
    "alignTitle": "🎯 יישור מודלים גמיש",
    "alignInfo": "לחץ על 📍 ליד מודל ובחר נקודות עליו",
    "pointCounter": "מודל 1: 0 נקודות | מודל 2: 0 נקודות",
    "finishModelBtn": "סיים מודל נוכחי →",
    "undoPointBtn": "↶ מחק נקודה אחרונה",
    "executeAlignBtn": "יישר מודלים",
    "cancelBtn": "ביטול",
    "fullscreenBtn": "🖵 מסך מלא",
    "helpBtn": "❓ עזרה",
    "cutYValue": "חיתוך אנכי: 0%",
    "cutXValue": "חיתוך רוחב: 0%",
    "cutZValue": "חיתוך עומק: 0%",
    "cutYLabel": "חיתוך מלמעלה למטה",
    "cutXLabel": "חיתוך משמאל לימין",
    "cutZLabel": "חיתוך מאחורה לקדימה",
    "closeFullscreen": "✕ סגור מסך מלא",
    "colorLabel": "צבע"
  }
};

// ─── i18n Initialization ───────────────────────────────────────────────────
(function () {
    function initI18n() {
        const langSelect = document.getElementById('langSelect');
        const translations = window.TRANSLATIONS || {};
        const languages = Object.keys(translations);

        function populateLangs() {
            languages.forEach(code => {
                const opt = document.createElement('option');
                opt.value = code;
                opt.text = translations[code].nativeName || code;
                langSelect.appendChild(opt);
            });
        }

        function applyTranslations(lang) {
            const dict = translations[lang] || translations['en'] || {};
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n'); if (!key) return;
                const text = dict[key];
                if (text !== undefined) {
                    if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea')
                        el.placeholder = text;
                    else
                        el.innerHTML = text;
                }
            });
            document.documentElement.lang = lang;
            if (lang === 'he' || lang === 'ar') {
                document.documentElement.dir = 'rtl';
                document.body.style.textAlign = 'right';
                document.body.classList.add('rtl');
            } else {
                document.documentElement.dir = 'ltr';
                document.body.style.textAlign = 'left';
                document.body.classList.remove('rtl');
            }
        }

        langSelect.addEventListener('change', e => {
            const v = e.target.value;
            localStorage.setItem('siteLang', v);
            applyTranslations(v);
        });

        populateLangs();
        const browserLang = (navigator.language || 'en').split('-')[0];
        const saved = localStorage.getItem('siteLang') || browserLang;
        langSelect.value = languages.includes(saved) ? saved
            : (languages.includes(browserLang) ? browserLang
            : (languages.includes('en') ? 'en'
            : (languages.includes('he') ? 'he' : languages[0])));
        applyTranslations(langSelect.value);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initI18n);
    } else {
        initI18n();
    }
})();