// ─── Global State ───────────────────────────────────────────────
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

// ─── Constants ──────────────────────────────────────────────────
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
