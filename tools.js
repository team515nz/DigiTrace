// ─── Ruler Tool ───────────────────────────────────────────────────
function setRulerBtnStyle(active, finished) {
    const color = finished ? '#5a7a5a' : active ? '#8a5a5a' : '#5a5a8a';
    ['rulerBtn','rulerBtnFS'].forEach(id => { const el=document.getElementById(id); if(el) el.style.background=color; });
}

function toggleRuler() {
    if (rulerState.active || rulerState.finished) { cancelRuler(); return; }
    if (!scene) { showToast('העלה מודל תחילה', 'error'); return; }
    rulerState.active=true; rulerState.finished=false; rulerState.points=[]; clearRulerObjects();
    setRulerBtnStyle(true, false);
    document.getElementById('canvas-container').style.cursor='crosshair';
    showRulerOverlay('📏 לחץ על נקודה ראשונה במודל');
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
    if(rulerState.points.length===1){rulerState.modelUnit=hitUnit;showRulerOverlay('📏 לחץ על נקודה שנייה');}
    else if(rulerState.points.length===2){
        const lineGeo=new THREE.BufferGeometry().setFromPoints(rulerState.points);
        const lineMat=new THREE.LineBasicMaterial({color:0xFFFF00,linewidth:2,depthTest:false,depthWrite:false});
        rulerState.line=new THREE.Line(lineGeo,lineMat); rulerScene.add(rulerState.line);
        const distScene=rulerState.points[0].distanceTo(rulerState.points[1]);
        const hitModel=allMeshes[0]?._modelRef;
        let distReal=distScene; let unitLabel=rulerState.modelUnit;
        if(hitModel&&hitModel.group){const sc=hitModel.group.scale.x;if(sc&&sc!==1)distReal=distScene/sc;}
        showRulerOverlay(`📏 מרחק: ${formatDistance(distReal,unitLabel)}   (לחץ 📏 לסגירה)`);
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

// ─── Anchor Points ────────────────────────────────────────────────
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
