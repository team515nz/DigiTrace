// ─── Alignment Panel ─────────────────────────────────────────────
function openAlignPanel() {
    if (models.length < 2) { showToast('נדרשים לפחות 2 מודלים ליישור', 'error'); return; }
    const sel1 = document.getElementById('alignModel1Select');
    const sel2 = document.getElementById('alignModel2Select');
    sel1.innerHTML = models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    sel2.innerHTML = models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    if (baseModelId !== null) sel1.value = baseModelId;
    const ids = models.map(m => m.id);
    const cur1 = parseInt(sel1.value);
    let cur2 = parseInt(sel2.value);
    if (cur2 === cur1) { const other = ids.find(id => id !== cur1); if (other !== undefined) sel2.value = other; }
    document.getElementById('alignSection').classList.remove('hidden');
    alignSetStep(1);
    updateModelList();
}

function alignSetStep(n) {
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById('stepDot'+i);
        dot.classList.remove('active','done');
        if (i < n) dot.classList.add('done');
        else if (i === n) dot.classList.add('active');
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
    document.getElementById('alignPhaseLabelBase').textContent = `לחץ על "${m1.name}" (בסיס)`;
    applyIsolation(id1, id2);
    m2.group.visible = false;
    tintAlignModels(id1, id2);
    document.getElementById('canvas-container').classList.add('align-mode');
    alignSetStep(2);
    showAlignBanner(m1.name, m2.name);
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
    banner.textContent = `🎯 יישור: 🔒 ${name1} ← ➡️ ${name2}`;
    banner.classList.add('visible');
}

function hideAlignBanner() { document.getElementById('alignIsolationBanner').classList.remove('visible'); }

function setAlignMode(mode) {
    alignState.mode = mode;
    document.getElementById('tabPoints').classList.toggle('active', mode === 'points');
    document.getElementById('tabManual').classList.toggle('active', mode === 'manual');
    if (alignState.phase === 'base') {
        document.getElementById('subpanelPoints').classList.toggle('active', mode === 'points');
        document.getElementById('subpanelManualBase').classList.toggle('active', mode === 'manual');
    }
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
    document.getElementById('alignPhaseLabelTarget').textContent =
        alignState.mode === 'points'
            ? `לחץ על "${m2?m2.name:'מטרה'}" לסימון ${alignState.points1.length} נקודות`
            : `הזז את "${m2?m2.name:'מטרה'}" למיקום הרצוי`;
    document.getElementById('subpanelPointsTarget').classList.toggle('active', alignState.mode === 'points');
    document.getElementById('subpanelManualTransform').classList.toggle('active', alignState.mode === 'manual');
    if (alignState.mode === 'manual') { initManualTransform(); document.getElementById('canvas-container').classList.remove('align-mode'); }
    if (m1) m1.group.visible = false;
    if (m2) m2.group.visible = true;
    document.getElementById('requiredPointsLabel').textContent = alignState.points1.length;
    document.getElementById('btnExecuteAlign').disabled = true;
    alignSetStep(3);
    updateAlignCounters();
}

function alignBackToStep2() {
    alignState.phase = 'base';
    alignState.selectingModel = alignState.model1;
    const m1 = models.find(m => m.id === alignState.model1);
    const m2 = models.find(m => m.id === alignState.model2);
    if (m1) m1.group.visible = true;
    if (m2) m2.group.visible = false;
    document.getElementById('canvas-container').classList.add('align-mode');
    alignSetStep(2);
    updateAlignCounters();
}

function updateAlignCounters() {
    const c1 = document.getElementById('base1Counter');
    const c2 = document.getElementById('targetCounter');
    if (c1) { c1.textContent = alignState.points1.length; c1.classList.toggle('has-points', alignState.points1.length > 0); }
    if (c2) { c2.textContent = alignState.points2.length; c2.classList.toggle('has-points', alignState.points2.length > 0); }
    const btnToStep3 = document.getElementById('btnToStep3');
    if (btnToStep3) btnToStep3.disabled = alignState.points1.length < alignState.minPoints;
    const btnExec = document.getElementById('btnExecuteAlign');
    if (btnExec) btnExec.disabled = alignState.points2.length < alignState.minPoints || alignState.points2.length < alignState.points1.length;
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

// ─── Manual Transform ────────────────────────────────────────────
function initManualTransform() {
    const model = models.find(m => m.id === alignState.model2);
    if (!model) return;
    alignState.manualBasePos = model.group.position.clone();
    alignState.manualBaseRot = model.group.rotation.clone();
    alignState.manualBaseScale = model.group.scale.clone();
    ['tx','ty','tz'].forEach(id => { document.getElementById(id+'Slider').value=0; document.getElementById(id+'Val').value='0.00'; });
    ['rx','ry','rz'].forEach(id => { document.getElementById(id+'Slider').value=0; document.getElementById(id+'Val').value='0'; });
}

function applyManualTransform() {
    const model = models.find(m => m.id === alignState.model2);
    if (!model || !alignState.manualBasePos) return;
    const tx=parseFloat(document.getElementById('txSlider').value)||0;
    const ty=parseFloat(document.getElementById('tySlider').value)||0;
    const tz=parseFloat(document.getElementById('tzSlider').value)||0;
    const rx=parseFloat(document.getElementById('rxSlider').value)||0;
    const ry=parseFloat(document.getElementById('rySlider').value)||0;
    const rz=parseFloat(document.getElementById('rzSlider').value)||0;
    document.getElementById('txVal').value=tx.toFixed(2); document.getElementById('tyVal').value=ty.toFixed(2); document.getElementById('tzVal').value=tz.toFixed(2);
    document.getElementById('rxVal').value=rx.toFixed(0); document.getElementById('ryVal').value=ry.toFixed(0); document.getElementById('rzVal').value=rz.toFixed(0);
    model.group.position.set(alignState.manualBasePos.x+tx, alignState.manualBasePos.y+ty, alignState.manualBasePos.z+tz);
    model.group.rotation.set(alignState.manualBaseRot.x+rx*Math.PI/180, alignState.manualBaseRot.y+ry*Math.PI/180, alignState.manualBaseRot.z+rz*Math.PI/180);
    calculateGlobalBoundingBox();
}

function syncSliderFromInput(axis) {
    const val = parseFloat(document.getElementById(axis+'Val').value)||0;
    document.getElementById(axis+'Slider').value = val;
    applyManualTransform();
}

function resetManualTransform() {
    const model = models.find(m => m.id === alignState.model2);
    if (!model || !alignState.manualBasePos) return;
    model.group.position.copy(alignState.manualBasePos);
    model.group.rotation.copy(alignState.manualBaseRot);
    model.group.scale.copy(alignState.manualBaseScale);
    ['tx','ty','tz'].forEach(id => { document.getElementById(id+'Slider').value=0; document.getElementById(id+'Val').value='0.00'; });
    ['rx','ry','rz'].forEach(id => { document.getElementById(id+'Slider').value=0; document.getElementById(id+'Val').value='0'; });
    calculateGlobalBoundingBox();
}

function confirmManualAlignment() { alignFinish(`מודל הוזזה ידנית הושלמה ✓`); }

// ─── Point Alignment Execution ───────────────────────────────────
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
    alignState = { active:false, mode:'points', phase:'base', model1:null, model2:null, selectingModel:null, points1:[], points2:[], markers:[], minPoints:3, manualBasePos:null, manualBaseRot:null, manualBaseScale:null, hiddenModels:[] };
    document.getElementById('alignSection').classList.add('hidden');
    document.getElementById('canvas-container').classList.remove('align-mode', 'move-mode');
    hideAlignBanner(); updateModelList();
}

function cancelAlignment() {
    const model = alignState.model2 !== null ? models.find(m => m.id === alignState.model2) : null;
    if (model && alignState.manualBasePos) {
        model.group.position.copy(alignState.manualBasePos);
        model.group.rotation.copy(alignState.manualBaseRot);
        model.group.scale.copy(alignState.manualBaseScale);
    }
    cleanupAlignState();
}

// ─── Math: Kabsch / SVD ──────────────────────────────────────────
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

// ─── ICP Auto-Alignment ──────────────────────────────────────────
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
