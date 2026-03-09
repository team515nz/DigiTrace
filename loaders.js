// ─── OBJ Loader ─────────────────────────────────────────────────
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

// ─── STL Loader ─────────────────────────────────────────────────
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

// ─── GLTF/GLB Loader ────────────────────────────────────────────
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
