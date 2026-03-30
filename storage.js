// ─── IndexedDB ───────────────────────────────────────────────────
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

// ─── Geometry Serialization ──────────────────────────────────────
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

// ─── Session Save / Restore ──────────────────────────────────────
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
        loadingMsg.classList.add('hidden');
        updateModelList(); calculateGlobalBoundingBox(); updateCameraPosition(); applyCuts(); restorePendingRuler();
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

// ─── Auto-save ───────────────────────────────────────────────────
setInterval(saveSession, 8000);
window.addEventListener('beforeunload', saveSession);
window.addEventListener('load', async () => { await restoreFullSession(); restoreAnchorFromStorage(); });
