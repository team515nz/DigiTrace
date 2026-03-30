// ─── Toast Notifications ─────────────────────────────────────────
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

// ─── Fullscreen ───────────────────────────────────────────────────
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

// ─── Help Modal ───────────────────────────────────────────────────
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

// ─── Keyboard Shortcuts ───────────────────────────────────────────
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

// ─── Sidebar Integration Events ──────────────────────────────────
document.addEventListener('sidebar:filesSelected', async (e) => {
    const files = e.detail.files;
    if (!files.length) return;
    
    for (const file of files) {
        try {
            let color = MODEL_COLORS[models.length % MODEL_COLORS.length].hex;
            await addModelFromFile(file, color);
            showToast(`✓ Loaded: ${file.name}`);
        } catch (error) {
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

// ─── Floating Clipping Controls Sync ─────────────────────────────
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
