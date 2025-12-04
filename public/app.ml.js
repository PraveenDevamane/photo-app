// Global state
let currentImageFilename = null;
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
            if (targetId === 'organize') loadCollections();
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

// Upload Form with ML tagging
function initUploadForm() {
    const form = document.getElementById('uploadForm');
    const result = document.getElementById('uploadResult');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        
        try {
            result.className = 'upload-result';
            result.style.display = 'block';
            result.innerHTML = '<div class="loading">🤖 Uploading and analyzing with ML...</div>';
            
            const response = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                result.className = 'upload-result success';
                const categories = data.image.categories || [];
                const mlTags = data.image.mlTags || [];
                
                result.innerHTML = `
                    <strong>✅ Upload Successful!</strong><br>
                    <small>Filename: ${data.image.filename}</small><br>
                    <small>🤖 ML Categories: ${categories.join(', ') || 'Uncategorized'}</small><br>
                    <small>Top ML Tags: ${mlTags.map(t => `${t.label} (${(t.confidence * 100).toFixed(0)}%)`).join(', ') || 'None'}</small><br>
                    <small>Added to: ${data.image.addedTo.map(a => a.collection).join(', ')}</small>
                `;
                form.reset();
                document.getElementById('filePreview').innerHTML = '<span>📷 Click or drag image here</span>';
                loadStats();
                loadImages();
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error) {
            result.className = 'upload-result error';
            result.innerHTML = `<strong>❌ Error:</strong> ${error.message}`;
        }
    });
}

// Format ML tags for display
function formatMLTags(mlTags) {
    if (!mlTags || mlTags.length === 0) return 'No ML tags';
    return mlTags.slice(0, 3).map(t => `${t.label} (${(t.confidence * 100).toFixed(0)}%)`).join(', ');
}

// Format categories for display
function formatCategories(categories) {
    if (!categories || categories.length === 0) return 'Uncategorized';
    return categories.map(c => {
        switch(c) {
            case 'person': return '👤 Person';
            case 'pet': return '🐾 Pet';
            case 'nature': return '🌿 Nature';
            case 'vehicle': return '🚗 Vehicle';
            default: return c;
        }
    }).join(' | ');
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
        
        // Update vehicles count if element exists
        const vehiclesEl = document.getElementById('vehiclesImages');
        if (vehiclesEl) vehiclesEl.textContent = stats.categories.vehicles;
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Load Images from category collections
async function loadImages() {
    const grid = document.getElementById('galleryGrid');
    const filter = document.getElementById('filterSelect').value;
    
    grid.innerHTML = '<div class="loading">Loading images...</div>';
    
    try {
        let url = `${API_BASE}/images`;
        
        // Apply filters
        if (filter === 'people') url += '?category=person';
        else if (filter === 'pets') url += '?category=pet';
        else if (filter === 'nature') url += '?category=nature';
        else if (filter === 'vehicles') url += '?category=vehicle';
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
            <div class="gallery-item" onclick="openModal('${image.filename}')">
                <img src="${image.url}" alt="${image.originalName}" loading="lazy">
                <div class="gallery-item-info">
                    <h4>${image.originalName}</h4>
                    <div class="gallery-item-tags">
                        ${(image.categories || []).map(cat => {
                            switch(cat) {
                                case 'person': return `<span class="tag person">👤 ${image.personId || 'Person'}</span>`;
                                case 'pet': return `<span class="tag pet">🐾 ${image.petType || 'Pet'}</span>`;
                                case 'nature': return `<span class="tag nature">🌿 ${image.sceneType || 'Nature'}</span>`;
                                case 'vehicle': return `<span class="tag vehicle">🚗 ${image.vehicleType || 'Vehicle'}</span>`;
                                default: return `<span class="tag">${cat}</span>`;
                            }
                        }).join('')}
                        ${image.organized ? '<span class="tag organized">📁 Organized</span>' : ''}
                    </div>
                    <div class="ml-tags" style="font-size: 0.7em; color: #666; margin-top: 4px;">
                        ${image.mlTags && image.mlTags.length > 0 ? 
                            '🤖 ' + image.mlTags.slice(0, 2).map(t => t.label).join(', ') : ''}
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
async function openModal(filename) {
    currentImageFilename = filename;
    const modal = document.getElementById('imageModal');
    
    try {
        const response = await fetch(`${API_BASE}/images/${filename}`);
        const image = await response.json();
        
        document.getElementById('modalImage').src = image.url;
        document.getElementById('modalTitle').textContent = image.originalName;
        document.getElementById('modalId').textContent = image.id || 'N/A';
        document.getElementById('modalFilename').textContent = image.filename;
        document.getElementById('modalDate').textContent = new Date(image.uploadedAt).toLocaleString();
        document.getElementById('modalTagsInput').value = (image.tags || []).join(', ');
        
        // Categories and ML tags display
        const autoTagsDiv = document.getElementById('modalAutoTags');
        autoTagsDiv.innerHTML = `
            <div style="margin-bottom: 8px;">
                <strong>Collection:</strong> ${image.collection || 'Unknown'}
            </div>
            <div style="margin-bottom: 8px;">
                <strong>🤖 ML Tags:</strong><br>
                ${image.mlTags && image.mlTags.length > 0 ? 
                    image.mlTags.slice(0, 5).map(t => 
                        `<span class="tag">${t.label} (${(t.confidence * 100).toFixed(0)}%)</span>`
                    ).join(' ') : 
                    '<span class="tag">No ML tags</span>'}
            </div>
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
    currentImageFilename = null;
}

// Close modal on outside click
document.getElementById('imageModal').addEventListener('click', (e) => {
    if (e.target.id === 'imageModal') closeModal();
});

// Set category for an image (quick tag) - adds to additional collection
async function setCategory(category) {
    if (!currentImageFilename) return;
    
    try {
        const response = await fetch(`${API_BASE}/images/${currentImageFilename}/category`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`✅ Image added to ${category} collection!`);
            // Refresh modal to show new tags
            openModal(currentImageFilename);
            loadImages();
            loadStats();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert('❌ Error setting category: ' + error.message);
    }
}

// Delete Image
async function deleteImage() {
    if (!currentImageFilename) return;
    
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/images/${currentImageFilename}`, {
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
    if (!currentImageFilename) return;
    
    try {
        const response = await fetch(`${API_BASE}/organize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: currentImageFilename })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const result = data.results[0];
            alert(`✅ Image organized to:\n${result.organizedTo.join('\n')}`);
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
                        ${data.results.map(r => `
                            <li>
                                <strong>${r.filename}</strong><br>
                                → ${r.organizedTo.join(', ')}
                            </li>
                        `).join('')}
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

// Re-process all images with ML tagging
async function reprocessAllImages() {
    const resultDiv = document.getElementById('organizeResult');
    
    if (!confirm('This will re-analyze all images using ML and update their categories. This may take a while. Continue?')) {
        return;
    }
    
    try {
        resultDiv.className = 'organize-result show';
        resultDiv.innerHTML = '<div class="loading">🤖 Re-processing all images with ML tagging...</div>';
        
        const response = await fetch(`${API_BASE}/reprocess`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            resultDiv.innerHTML = `
                <h4>✅ ${data.message}</h4>
                <p>Images have been re-tagged with ML. You can now organize them.</p>
                <ul>
                    ${data.results.map(r => `
                        <li>
                            <strong>${r.filename}</strong><br>
                            ${r.error ? 
                                `<span style="color: red;">Error: ${r.error}</span>` :
                                `Categories: ${r.categories.join(', ')}<br>
                                 🤖 ML: ${r.topMLTags ? r.topMLTags.join(', ') : 'N/A'}`
                            }
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

// Reorganize all images (reset and organize fresh with ML)
async function reorganizeAllImages() {
    const resultDiv = document.getElementById('organizeResult');
    
    if (!confirm('This will reset all organization and re-organize all images with ML tagging. This may take a while. Continue?')) {
        return;
    }
    
    try {
        resultDiv.className = 'organize-result show';
        resultDiv.innerHTML = '<div class="loading">🤖 Reorganizing all images with ML (this may take a moment)...</div>';
        
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
                            <strong>${r.filename}</strong><br>
                            ${r.error ? 
                                `<span style="color: red;">Error: ${r.error}</span>` :
                                `Categories: ${r.categories.join(', ')}<br>
                                 📁 Organized to: ${r.organizedTo.join(', ')}`
                            }
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

// Load Collections Summary
async function loadCollections() {
    const resultDiv = document.getElementById('organizeResult');
    
    try {
        const response = await fetch(`${API_BASE}/collections`);
        const data = await response.json();
        
        resultDiv.className = 'organize-result show';
        resultDiv.innerHTML = `
            <h4>📊 Collections Summary</h4>
            
            <h5>👥 Persons (${data.persons.length} groups)</h5>
            <ul>
                ${data.persons.map(p => `
                    <li>
                        <strong>${p.personId}</strong>: ${p.imageCount} images
                        ${p.images.map(img => `<br>&nbsp;&nbsp;- ${img.originalName}`).join('')}
                    </li>
                `).join('') || '<li>No person images</li>'}
            </ul>
            
            <h5>🐾 Pets (${data.pets.length} types)</h5>
            <ul>
                ${data.pets.map(p => `
                    <li>
                        <strong>${p.petType || 'unknown'}</strong>: ${p.imageCount} images
                        ${p.images.map(img => `<br>&nbsp;&nbsp;- ${img.originalName}`).join('')}
                    </li>
                `).join('') || '<li>No pet images</li>'}
            </ul>
            
            <h5>🌿 Nature (${data.nature.length} scenes)</h5>
            <ul>
                ${data.nature.map(n => `
                    <li>
                        <strong>${n.sceneType || 'outdoor'}</strong>: ${n.imageCount} images
                        ${n.images.map(img => `<br>&nbsp;&nbsp;- ${img.originalName}`).join('')}
                    </li>
                `).join('') || '<li>No nature images</li>'}
            </ul>
            
            <h5>🚗 Vehicles (${data.vehicles.length} types)</h5>
            <ul>
                ${data.vehicles.map(v => `
                    <li>
                        <strong>${v.vehicleType || 'unknown'}</strong>: ${v.imageCount} images
                        ${v.images.map(img => `<br>&nbsp;&nbsp;- ${img.originalName}`).join('')}
                    </li>
                `).join('') || '<li>No vehicle images</li>'}
            </ul>
        `;
    } catch (error) {
        resultDiv.innerHTML = `<p>❌ Error loading collections: ${error.message}</p>`;
    }
}

// Load Raw Database Data (from collections)
async function loadRawData() {
    const display = document.getElementById('rawDataDisplay');
    
    try {
        display.textContent = 'Loading collections data...';
        
        const response = await fetch(`${API_BASE}/collections`);
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
