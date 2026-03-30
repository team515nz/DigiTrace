// ─── Geometry Collection ─────────────────────────────────────────
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

// ─── Format Exporters ────────────────────────────────────────────
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

// ─── Download Triggers ────────────────────────────────────────────
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
