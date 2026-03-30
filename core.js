/* ────────────────────────────────────────────────────────────────────────── */
/* core.js - Three.js Engine & Global State                                   */
/* Merged from: constants.js, scene.js                                        */
/* ────────────────────────────────────────────────────────────────────────── */

// ─── Global State ───────────────────────────────────────────────────────── 
let scene, camera, renderer;
let rulerScene;
let models = [];
let modelCounter = 0;
let globalBoundingBox = null;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraRotation = { horizontal: 45, vertical: 30 };
let cameraDistance = 8;
let baseModelId = null;

let alignState = {
    active: false,
    mode: 'points',
    phase: 'base',
    model1: null,
    model2: null,
    selectingModel: null,
    points1: [],
    points2: [],
    markers: [],
    minPoints: 3,
    manualBasePos: null,
    manualBaseRot: null,
    manualBaseScale: null,
    hiddenModels: []
};

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

let anchorState = { picking: false, points: [], markers: [] };
let rulerState = { active: false, finished: false, points: [], markers: [], line: null, modelUnit: 'm' };

let pendingFiles = [], pendingColors = [];

// ─── Constants ──────────────────────────────────────────────────────────── 
const MODEL_COLORS = [
    { hex: 0xFF6B6B, css: '#FF6B6B', name: 'אדום' },
    { hex: 0x4ECDC4, css: '#4ECDC4', name: 'טורקיז' },
    { hex: 0x45B7D1, css: '#45B7D1', name: 'כחול' },
    { hex: 0xFFA07A, css: '#FFA07A', name: 'כתום' },
    { hex: 0x98D8C8, css: '#98D8C8', name: 'ירוק' },
    { hex: 0xF7DC6F, css: '#F7DC6F', name: 'צהוב' },
    { hex: 0xBB8FCE, css: '#BB8FCE', name: 'סגול' },
    { hex: 0xF0B27A, css: '#F0B27A', name: 'אפרסק' },
    { hex: 0x82E0AA, css: '#82E0AA', name: 'ירוק בהיר' },
    { hex: 0x85C1E9, css: '#85C1E9', name: 'תכלת' },
    { hex: 0xF1948A, css: '#F1948A', name: 'ורוד' },
    { hex: 0xF9E79F, css: '#F9E79F', name: 'שמנת' },
];

const UNIT_TO_METERS = { mm: 0.001, cm: 0.01, m: 1, inch: 0.0254, ft: 0.3048 };
const STORAGE_KEY = 'digitrace_session';
const IDB_NAME = 'DigiTraceDB';
const IDB_STORE = 'models';

const _FORBIDDEN = String(66 + 1);
const _FORBIDDEN_RE = new RegExp(_FORBIDDEN, 'g');
function censor(text) { return String(text).replace(_FORBIDDEN_RE, '🚫'); }
function censorNumber(str) { return censor(str); }
function setTextCensored(el, text) { if (el) el.textContent = censor(text); }

function getColorInfo(hexNum) {
    const found = MODEL_COLORS.find(c => c.hex === hexNum);
    if (found) return { name: found.name, hex: found.css };
    return { name: 'מותאם', hex: '#' + ('000000' + hexNum.toString(16)).slice(-6) };
}

// ─── Scene Setup ────────────────────────────────────────────────────────── 
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
