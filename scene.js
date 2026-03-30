// ─── Scene Setup ────────────────────────────────────────────────
function initThreeJS() {
    const container = document.getElementById('canvas-container');
    const instruction = container.querySelector('.instruction');
    if (instruction) instruction.remove();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    updateCameraPosition();
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);
    rulerScene = new THREE.Scene();
    raycaster = new THREE.Raycaster();
    setupMouseControls();
    animate();
}

function updateCameraPosition() {
    const horizontalAngle = (cameraRotation.horizontal * Math.PI) / 180;
    const verticalAngle = (cameraRotation.vertical * Math.PI) / 180;
    camera.position.x = Math.sin(horizontalAngle) * Math.cos(verticalAngle) * cameraDistance;
    camera.position.y = Math.sin(verticalAngle) * cameraDistance;
    camera.position.z = Math.cos(horizontalAngle) * Math.cos(verticalAngle) * cameraDistance;
    camera.lookAt(0, 0, 0);
}

function setupMouseControls() {
    const container = document.getElementById('canvas-container');
    container.addEventListener('contextmenu', (e) => e.preventDefault());
    container.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
            return;
        }
        if (e.button !== 0) return;
        if (anchorState.picking) { pickAnchorPoint(e.clientX, e.clientY); return; }
        if (rulerState.active) { pickRulerPoint(e.clientX, e.clientY); return; }
        if (alignState.active && alignState.mode === 'points' && alignState.selectingModel !== null) {
            const rect = container.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const currentModel = models.find(m => m.id === alignState.selectingModel);
            if (currentModel) {
                const meshes = currentModel.meshes || [];
                const intersects = raycaster.intersectObjects(meshes, true);
                if (intersects.length > 0) {
                    selectAlignmentPoint(e.clientX, e.clientY);
                } else {
                    isDragging = true;
                    previousMousePosition = { x: e.clientX, y: e.clientY };
                }
            }
            return;
        }
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        cameraRotation.horizontal -= deltaX * 0.5;
        cameraRotation.vertical += deltaY * 0.5;
        cameraRotation.vertical = Math.max(-89, Math.min(89, cameraRotation.vertical));
        updateCameraPosition();
        previousMousePosition = { x: e.clientX, y: e.clientY };
        clearTimeout(window._camSaveTimer);
        window._camSaveTimer = setTimeout(saveSession, 1000);
    });
    container.addEventListener('mouseup', () => { isDragging = false; });
    container.addEventListener('mouseleave', () => { isDragging = false; });
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        cameraDistance += e.deltaY * 0.001 * cameraDistance;
        cameraDistance = Math.max(1, Math.min(50, cameraDistance));
        updateCameraPosition();
    }, { passive: false });
}

function animate() {
    requestAnimationFrame(animate);
    if (renderer && scene && camera) {
        renderer.autoClear = true;
        renderer.render(scene, camera);
        if (rulerScene) {
            renderer.autoClear = false;
            renderer.clearDepth();
            renderer.render(rulerScene, camera);
            renderer.autoClear = true;
        }
    }
}

function adjustCameraToModel() {
    if (!models.length) return;
    calculateGlobalBoundingBox();
    const size = new THREE.Vector3();
    globalBoundingBox.getSize(size);
    cameraDistance = Math.max(size.x, size.y, size.z) * 2;
    updateCameraPosition();
}

window.addEventListener('resize', () => {
    if (renderer && camera) {
        const container = document.getElementById('canvas-container');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
});
