// ─── Sidebar Controller ─────────────────────────────────────────
// Wraps all sidebar logic with custom DOM events for 3D scene decoupling

class SidebarController {
    constructor() {
        this.activeTab = 'models'; // 'models', 'align', 'export'
        this.panelOpen = true;
        this.rail = document.getElementById('sidebarRail');
        this.panel = document.getElementById('sidebarPanel');
        this.tabs = {
            models: document.getElementById('sidebarContentModels'),
            align: document.getElementById('sidebarContentAlign'),
            export: document.getElementById('sidebarContentExport')
        };
        this.init();
    }

    init() {
        // Event listeners for tab icons
        this.rail.querySelectorAll('[data-tab]').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.openTab(tab);
            });
        });

        // Collapse panel when clicking active tab again
        this.rail.querySelectorAll('[data-tab]').forEach(icon => {
            icon.addEventListener('dblclick', () => {
                if (this.panelOpen) this.closePanel();
            });
        });

        // Initialize upload zone for Models tab
        this.initUploadZone();
        this.setupUploadDragDrop();

        // Load persisted state
        this.loadState();
    }

    openTab(tabName) {
        if (!this.tabs[tabName]) return;

        // Update active tab
        this.activeTab = tabName;
        
        // Update rail icon active state
        this.rail.querySelectorAll('[data-tab]').forEach(icon => {
            icon.classList.toggle('active', icon.dataset.tab === tabName);
        });

        // Update panel content visibility
        Object.keys(this.tabs).forEach(tab => {
            this.tabs[tab].style.display = tab === tabName ? 'flex' : 'none';
        });

        // Open panel if not already open
        if (!this.panelOpen) this.openPanel();

        // Emit event for 3D scene
        this.emitEvent('sidebar:tabChanged', { tab: tabName });
        this.saveState();
    }

    openPanel() {
        this.panelOpen = true;
        this.panel.classList.add('open');
        this.emitEvent('sidebar:panelOpened');
    }

    closePanel() {
        this.panelOpen = false;
        this.panel.classList.remove('open');
        this.emitEvent('sidebar:panelClosed');
    }

    togglePanel() {
        this.panelOpen ? this.closePanel() : this.openPanel();
    }

    // ─── Upload Zone ────────────────────────────────────────────
    initUploadZone() {
        const uploadZone = document.getElementById('sidebarUploadZone');
        const fileInput = document.getElementById('sidebarFileInput');
        const uploadIcon = document.getElementById('sidebarUploadIcon');

        if (!uploadZone) return;

        uploadZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            this.handleFilesSelected(Array.from(e.target.files));
            fileInput.value = ''; // Reset for re-selection
        });

        // Keyboard accessibility
        uploadZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput.click();
            }
        });
    }

    setupUploadDragDrop() {
        const uploadZone = document.getElementById('sidebarUploadZone');
        if (!uploadZone) return;

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files).filter(f =>
                /\.(obj|stl|glb|gltf)$/i.test(f.name)
            );
            if (files.length) this.handleFilesSelected(files);
        });
    }

    handleFilesSelected(files) {
        if (!files.length) return;

        // Emit event for file handler (models.js)
        this.emitEvent('sidebar:filesSelected', { files });
    }

    // ─── Model List ─────────────────────────────────────────────
    addModelToList(modelData) {
        const list = document.getElementById('sidebarModelList');
        if (!list) return;

        const item = this.createModelListItem(modelData);
        list.appendChild(item);
        this.updateUploadZoneVisibility();
        this.emitEvent('sidebar:modelAdded', { modelData });
    }

    createModelListItem(modelData) {
        const item = document.createElement('div');
        item.className = 'sidebar-model-item';
        item.dataset.modelId = modelData.id;

        const colorInfo = getColorInfo(modelData.color);

        item.innerHTML = `
            <div class="sidebar-model-content">
                <div class="sidebar-model-dot" style="background-color: ${colorInfo.hex};" title="${colorInfo.name}"></div>
                <div class="sidebar-model-name">${modelData.name}</div>
                <span class="sidebar-model-badge">${modelData.format || 'GLB'}</span>
                <button class="sidebar-model-eye" data-model-id="${modelData.id}" title="Toggle visibility">👁️</button>
                <button class="sidebar-model-menu" data-model-id="${modelData.id}" title="Options">⋮</button>
            </div>
        `;

        // Eye icon toggle
        item.querySelector('.sidebar-model-eye').addEventListener('click', () => {
            this.emitEvent('sidebar:toggleModelVisibility', { modelId: modelData.id });
        });

        // Menu button
        item.querySelector('.sidebar-model-menu').addEventListener('click', (e) => {
            this.showModelMenu(e, modelData.id);
        });

        return item;
    }

    updateModelListItem(modelData) {
        const item = document.querySelector(`[data-model-id="${modelData.id}"]`);
        if (!item) return;

        const colorInfo = getColorInfo(modelData.color);
        item.querySelector('.sidebar-model-dot').style.backgroundColor = colorInfo.hex;
        item.querySelector('.sidebar-model-name').textContent = modelData.name;
    }

    removeModelFromList(modelId) {
        const item = document.querySelector(`[data-model-id="${modelId}"]`);
        if (item) item.remove();
        this.updateUploadZoneVisibility();
    }

    updateUploadZoneVisibility() {
        const list = document.getElementById('sidebarModelList');
        const zone = document.getElementById('sidebarUploadZone');
        if (!list || !zone) return;

        const hasModels = list.children.length > 0;
        zone.classList.toggle('collapsed', hasModels);
    }

    showModelMenu(event, modelId) {
        const menu = document.createElement('div');
        menu.className = 'sidebar-context-menu';
        menu.innerHTML = `
            <button data-action="setBase" data-model-id="${modelId}">📌 Set as Base</button>
            <button data-action="download" data-model-id="${modelId}">📥 Download</button>
            <button data-action="remove" data-model-id="${modelId}" style="color: #ff6b6b;">🗑️ Remove</button>
        `;

        menu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const mId = e.target.dataset.modelId;
            
            if (action === 'setBase') this.emitEvent('sidebar:setAsBase', { modelId: mId });
            else if (action === 'download') this.emitEvent('sidebar:downloadModel', { modelId: mId });
            else if (action === 'remove') this.emitEvent('sidebar:removeModel', { modelId: mId });
            
            menu.remove();
        });

        document.body.appendChild(menu);
        const rect = event.target.getBoundingClientRect();
        menu.style.top = (rect.bottom + 4) + 'px';
        menu.style.left = rect.left + 'px';

        // Close menu on click outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (menu.contains(e.target)) return;
                menu.remove();
                document.removeEventListener('click', closeMenu);
            });
        });
    }

    // ─── Alignment Tab ──────────────────────────────────────────
    updateAlignmentUI(state) {
        // Update stepper badges
        const badges = document.querySelectorAll('.sidebar-align-badge');
        badges.forEach(b => b.classList.remove('active', 'done'));
        
        if (state.step > 1) badges[0]?.classList.add('done');
        if (state.step >= 1) badges[state.step - 1]?.classList.add('active');

        // Update summary bar
        const summary = document.getElementById('sidebarAlignSummary');
        if (summary && state.baseModel && state.targetModel) {
            summary.textContent = `Base: ${state.baseModel.name} → Target: ${state.targetModel.name}`;
        }

        // Update point counters
        if (state.points1 !== undefined) {
            const badge1 = document.getElementById('sidebarPointsBadge1');
            if (badge1) badge1.textContent = `${state.points1} / ${state.minPoints}`;
        }
        if (state.points2 !== undefined) {
            const badge2 = document.getElementById('sidebarPointsBadge2');
            if (badge2) badge2.textContent = `${state.points2} / ${state.minPoints}`;
        }
    }

    // ─── Export Tab ─────────────────────────────────────────────
    setExportOptions(options) {
        // Update format buttons, file sizes, etc.
        const formatBtns = document.querySelectorAll('.sidebar-format-btn');
        formatBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.format === options.selectedFormat) {
                btn.classList.add('active');
            }
            btn.addEventListener('click', () => {
                this.emitEvent('sidebar:formatSelected', { format: btn.dataset.format });
            });
        });
    }

    // ─── Events ─────────────────────────────────────────────────
    emitEvent(eventName, detail) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    saveState() {
        localStorage.setItem('sidebarState', JSON.stringify({
            activeTab: this.activeTab,
            panelOpen: this.panelOpen
        }));
    }

    loadState() {
        const saved = localStorage.getItem('sidebarState');
        if (saved) {
            const state = JSON.parse(saved);
            this.activeTab = state.activeTab || 'models';
            // Open the default tab
            this.openTab(this.activeTab);
        }
    }
}

// Initialize sidebar when DOM is ready
let sidebarController;
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Wait for all scripts to load
        setTimeout(() => {
            sidebarController = new SidebarController();
        }, 100);
    } catch (error) {
        console.error('Failed to initialize sidebar:', error);
    }
});
