// Global state
let currentImageId = null;
const API_BASE = '/api';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initUploadForm();
    initFilePreview();
    loadStats();
    loadImages();
});

// Tab Navigation
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const targetId = tab.dataset.tab;
            document.getElementById(targetId).classList.add('active');
            
            // Refresh data when switching tabs
            if (targetId === 'gallery') loadImages();
            if (targetId === 'database') loadRawData();
        });
    });
}

// File Preview
function initFilePreview() {
    const fileInput = document.getElementById('imageInput');
    const preview = document.getElementById('filePreview');
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Upload Form
function initUploadForm() {
    const form = document.getElementById('uploadForm');
    const result = document.getElementById('uploadResult');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        
        try {
            result.className = 'upload-result';
            result.style.display = 'block';
            result.innerHTML = '<div class="loading">Uploading...</div>';
            
            const response = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                result.className = 'upload-result success';
                result.innerHTML = `
                    <strong>✅ Upload Successful!</strong><br>
                    <small>Filename: ${data.image.filename}</small><br>
                    <small>Auto Tags: ${formatAutoTags(data.image.autoTags)}</small>
                `;
                form.reset();
                document.getElementById('filePreview').innerHTML = '<span>📷 Click or drag image here</span>';
                loadStats();
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error) {
            result.className = 'upload-result error';
            result.innerHTML = `<strong>❌ Error:</strong> ${error.message}`;
        }
    });
}

// Format auto tags for display
function formatAutoTags(autoTags) {
    const parts = [];
    if (autoTags.person_id) parts.push(`Person: ${autoTags.person_id}`);
    if (autoTags.nature) parts.push('Nature');
    if (autoTags.pets) parts.push('Pets');
    if (autoTags.objects.length) parts.push(`Objects: ${autoTags.objects.join(', ')}`);
    return parts.length ? parts.join(' | ') : 'None detected';
}

// Load Statistics
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const stats = await response.json();
        
        document.getElementById('totalImages').textContent = stats.total;
        document.getElementById('organizedImages').textContent = stats.organized;
        document.getElementById('peopleImages').textContent = stats.categories.people;
        document.getElementById('petsImages').textContent = stats.categories.pets;
        document.getElementById('natureImages').textContent = stats.categories.nature;
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Load Images
async function loadImages() {
    const grid = document.getElementById('galleryGrid');
    const filter = document.getElementById('filterSelect').value;
    
    grid.innerHTML = '<div class="loading">Loading images...</div>';
    
    try {
        let url = `${API_BASE}/images`;
        
        // Apply filters
        if (filter === 'people') url += '?person_id=true';
        else if (filter === 'pets') url += '?pets=true';
        else if (filter === 'nature') url += '?nature=true';
        else if (filter === 'vehicles') url += '?vehicle=true';
        else if (filter === 'organized') url += '?organized=true';
        else if (filter === 'unorganized') url += '?organized=false';
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.images.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <span>📷</span>
                    <p>No images found. Upload some images to get started!</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = data.images.map(image => `
            <div class="gallery-item" onclick="openModal('${image.id}')">
                <img src="${image.url}" alt="${image.originalName}" loading="lazy">
                <div class="gallery-item-info">
                    <h4>${image.originalName}</h4>
                    <div class="gallery-item-tags">
                        ${image.autoTags.person_id ? `<span class="tag person">👤 ${image.autoTags.person_id}</span>` : ''}
                        ${image.autoTags.pets ? '<span class="tag pet">🐾 Pet</span>' : ''}
                        ${image.autoTags.nature ? '<span class="tag nature">🌿 Nature</span>' : ''}
                        ${image.autoTags.vehicle ? '<span class="tag vehicle">🚗 Vehicle</span>' : ''}
                        ${image.organized ? '<span class="tag organized">📁 Organized</span>' : ''}
                        ${image.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        grid.innerHTML = `<div class="empty-state"><p>Error loading images: ${error.message}</p></div>`;
    }
}

// Filter change handler
document.getElementById('filterSelect').addEventListener('change', loadImages);

// Open Modal
async function openModal(imageId) {
    currentImageId = imageId;
    const modal = document.getElementById('imageModal');
    
    try {
        const response = await fetch(`${API_BASE}/images/${imageId}`);
        const image = await response.json();
        
        document.getElementById('modalImage').src = image.url;
        document.getElementById('modalTitle').textContent = image.originalName;
        document.getElementById('modalId').textContent = image.id;
        document.getElementById('modalFilename').textContent = image.filename;
        document.getElementById('modalDate').textContent = new Date(image.uploadDate).toLocaleString();
        document.getElementById('modalTagsInput').value = image.tags.join(', ');
        
        // Auto tags display
        const autoTagsDiv = document.getElementById('modalAutoTags');
        autoTagsDiv.innerHTML = `
            ${image.autoTags.person_id ? `<span class="tag person">👤 ${image.autoTags.person_id}</span>` : ''}
            ${image.autoTags.pets ? '<span class="tag pet">🐾 Pet</span>' : ''}
            ${image.autoTags.nature ? '<span class="tag nature">🌿 Nature</span>' : ''}
            ${image.autoTags.vehicle ? '<span class="tag vehicle">🚗 Vehicle</span>' : ''}
            ${image.autoTags.objects ? image.autoTags.objects.map(o => `<span class="tag">${o}</span>`).join('') : ''}
        `;
        
        // Embedding preview
        document.getElementById('modalEmbedding').textContent = 
            image.embedding ? `[${image.embedding.slice(0, 5).join(', ')}... ] (${image.embedding.length} dimensions)` : 'No embedding';
        
        modal.classList.add('show');
    } catch (error) {
        alert('Error loading image details: ' + error.message);
    }
}

// Close Modal
function closeModal() {
    document.getElementById('imageModal').classList.remove('show');
    currentImageId = null;
}

// Close modal on outside click
document.getElementById('imageModal').addEventListener('click', (e) => {
    if (e.target.id === 'imageModal') closeModal();
});

// Set category for an image (quick tag)
async function setCategory(category) {
    if (!currentImageId) return;
    
    try {
        // Build autoTags based on category
        const autoTags = {
            person_id: null,
            nature: false,
            pets: false,
            vehicle: false,
            objects: []
        };
        
        switch(category) {
            case 'person':
                autoTags.person_id = 'person_0001';
                autoTags.objects.push('portrait');
                break;
            case 'pet':
                autoTags.pets = true;
                autoTags.objects.push('animal');
                break;
            case 'nature':
                autoTags.nature = true;
                autoTags.objects.push('outdoor');
                break;
            case 'vehicle':
                autoTags.vehicle = true;
                autoTags.objects.push('vehicle');
                break;
        }
        
        const response = await fetch(`${API_BASE}/images/${currentImageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ autoTags })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`✅ Image categorized as ${category}!`);
            // Refresh modal to show new tags
            openModal(currentImageId);
            loadImages();
            loadStats();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert('❌ Error setting category: ' + error.message);
    }
}

// Update Image Tags
async function updateImage() {
    if (!currentImageId) return;
    
    const tags = document.getElementById('modalTagsInput').value;
    
    try {
        const response = await fetch(`${API_BASE}/images/${currentImageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('✅ Tags updated successfully!');
            loadImages();
            loadStats();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert('❌ Error updating tags: ' + error.message);
    }
}

// Delete Image
async function deleteImage() {
    if (!currentImageId) return;
    
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/images/${currentImageId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('✅ Image deleted successfully!');
            closeModal();
            loadImages();
            loadStats();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert('❌ Error deleting image: ' + error.message);
    }
}

// Organize Single Image
async function organizeImage() {
    if (!currentImageId) return;
    
    try {
        const response = await fetch(`${API_BASE}/organize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageId: currentImageId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`✅ Image organized to: ${data.results[0].organizedTo}`);
            closeModal();
            loadImages();
            loadStats();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert('❌ Error organizing image: ' + error.message);
    }
}

// Organize All Images
async function organizeAllImages() {
    const resultDiv = document.getElementById('organizeResult');
    
    try {
        resultDiv.className = 'organize-result show';
        resultDiv.innerHTML = '<div class="loading">Organizing images...</div>';
        
        const response = await fetch(`${API_BASE}/organize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.results.length === 0) {
                resultDiv.innerHTML = '<p>✅ All images are already organized!</p>';
            } else {
                resultDiv.innerHTML = `
                    <h4>✅ ${data.message}</h4>
                    <ul>
                        ${data.results.map(r => `<li>${r.filename} → ${r.organizedTo}</li>`).join('')}
                    </ul>
                `;
            }
            loadStats();
            loadImages();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        resultDiv.innerHTML = `<p>❌ Error: ${error.message}</p>`;
    }
}

// Re-process all images with updated tagging logic
async function reprocessAllImages() {
    const resultDiv = document.getElementById('organizeResult');
    
    if (!confirm('This will re-analyze all images and update their tags. Continue?')) {
        return;
    }
    
    try {
        resultDiv.className = 'organize-result show';
        resultDiv.innerHTML = '<div class="loading">Re-processing all images...</div>';
        
        const response = await fetch(`${API_BASE}/reprocess`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            resultDiv.innerHTML = `
                <h4>✅ ${data.message}</h4>
                <p>Images have been re-tagged. You can now organize them.</p>
                <ul>
                    ${data.results.map(r => `
                        <li>
                            ${r.filename} → 
                            ${r.newTags.person_id ? `<span class="tag person">👤 ${r.newTags.person_id}</span>` : ''}
                            ${r.newTags.pets ? '<span class="tag pet">🐾 Pet</span>' : ''}
                            ${r.newTags.nature ? '<span class="tag nature">🌿 Nature</span>' : ''}
                        </li>
                    `).join('')}
                </ul>
            `;
            loadStats();
            loadImages();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        resultDiv.innerHTML = `<p>❌ Error: ${error.message}</p>`;
    }
}

// Reorganize all images (reset and organize fresh)
async function reorganizeAllImages() {
    const resultDiv = document.getElementById('organizeResult');
    
    if (!confirm('This will reset all organization and re-organize all images with fresh tagging. Continue?')) {
        return;
    }
    
    try {
        resultDiv.className = 'organize-result show';
        resultDiv.innerHTML = '<div class="loading">Reorganizing all images (this may take a moment)...</div>';
        
        const response = await fetch(`${API_BASE}/reorganize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            resultDiv.innerHTML = `
                <h4>✅ ${data.message}</h4>
                <p><strong>Tracked Persons:</strong> ${data.trackedPersons.join(', ') || 'None'}</p>
                <ul>
                    ${data.results.map(r => `
                        <li>
                            ${r.filename} → <strong>${r.organizedTo}</strong>
                            ${r.autoTags.person_id ? `<span class="tag person">👤 ${r.autoTags.person_id}</span>` : ''}
                            ${r.autoTags.pets ? '<span class="tag pet">🐾 Pet</span>' : ''}
                            ${r.autoTags.nature ? '<span class="tag nature">🌿 Nature</span>' : ''}
                        </li>
                    `).join('')}
                </ul>
            `;
            loadStats();
            loadImages();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        resultDiv.innerHTML = `<p>❌ Error: ${error.message}</p>`;
    }
}

// Load Raw Database Data
async function loadRawData() {
    const display = document.getElementById('rawDataDisplay');
    
    try {
        display.textContent = 'Loading...';
        
        const response = await fetch(`${API_BASE}/images`);
        const data = await response.json();
        
        display.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        display.textContent = `Error loading data: ${error.message}\n\nMake sure the server is running!`;
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});
