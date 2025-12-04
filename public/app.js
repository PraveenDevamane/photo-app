// Photo App Frontend - Uses filename-based API (no Images collection)
document.addEventListener('DOMContentLoaded', () => {
    loadImages();
    loadStats();
    
    // Set up form submission
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', uploadImage);
    }
    
    // Set up search input - search on Enter key
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchPhotos();
            }
        });
    }
    
    // Set up tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all tabs and contents
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Add active to clicked tab and corresponding content
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.classList.add('active');
            }
        });
    });
    
    // Set up filter select
    const filterSelect = document.getElementById('filterSelect');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value === 'organized') {
                loadImages({ organized: 'true' });
            } else if (value === 'unorganized') {
                loadImages({ organized: 'false' });
            } else if (value === 'people' || value === 'pets' || value === 'nature' || value === 'vehicles') {
                loadImages({ category: value === 'people' ? 'person' : value.slice(0, -1) });
            } else {
                loadImages();
            }
        });
    }
    
    // Set up collection tabs
    document.querySelectorAll('.collection-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.collection-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Set up file input preview
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById('filePreview');
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width:100%;max-height:200px;">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

// Search photos by tags
async function searchPhotos() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput ? searchInput.value.trim() : '';
    
    if (!query) {
        showMessage('Please enter search terms', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (response.ok) {
            if (data.count === 0) {
                showMessage(`No images found for "${query}"`, 'info');
            } else {
                showMessage(`Found ${data.count} image(s) matching "${query}"`, 'success');
            }
            displayImages(data.images);
        } else {
            showMessage(data.error || 'Search failed', 'error');
        }
    } catch (error) {
        showMessage('Search failed: ' + error.message, 'error');
    }
}

// Clear search and show all images
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    loadImages();
}

// Upload image
async function uploadImage(event) {
    event.preventDefault();
    
    const formData = new FormData();
    const fileInput = document.getElementById('imageInput');
    const tagsInput = document.getElementById('tagsInput');
    
    if (!fileInput || !fileInput.files[0]) {
        showMessage('Please select an image', 'error');
        return;
    }
    
    formData.append('image', fileInput.files[0]);
    if (tagsInput && tagsInput.value) {
        formData.append('tags', tagsInput.value);
    }
    
    const submitBtn = document.querySelector('#uploadForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Uploading...</span>';
    }
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            const tags = result.image.autoTags || [];
            showMessage(`Image uploaded! Auto-tags: ${tags.join(', ')}`, 'success');
            fileInput.value = '';
            if (tagsInput) tagsInput.value = '';
            const preview = document.getElementById('filePreview');
            if (preview) preview.innerHTML = '<span>📷 Click or drag image here</span>';
            loadImages();
            loadStats();
        } else {
            showMessage(result.error || 'Upload failed', 'error');
        }
    } catch (error) {
        showMessage('Upload failed: ' + error.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Upload Image</span>';
        }
    }
}

// Load all images
async function loadImages(filter = null) {
    try {
        let url = '/api/images';
        if (filter) {
            const params = new URLSearchParams(filter);
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        displayImages(data.images);
    } catch (error) {
        showMessage('Failed to load images: ' + error.message, 'error');
    }
}

// Display images
function displayImages(images) {
    const gallery = document.getElementById('galleryGrid') || document.getElementById('imageGallery');
    
    if (!gallery) {
        console.error('Gallery element not found');
        return;
    }
    
    if (!images || images.length === 0) {
        gallery.innerHTML = '<p class="no-images">No images found. Upload some photos!</p>';
        return;
    }
    
    gallery.innerHTML = images.map(image => {
        const autoTags = Array.isArray(image.autoTags) ? image.autoTags : [];
        const tags = Array.isArray(image.tags) ? image.tags : [];
        const categories = Array.isArray(image.categories) ? image.categories : [];
        
        return `
        <div class="image-card" data-filename="${image.filename}">
            <div class="image-container">
                <img src="${image.url}" alt="${image.originalName}" loading="lazy" onclick="viewImage('${image.filename}')">
                <div class="image-overlay">
                    <span class="organized-badge ${image.organized ? 'organized' : 'not-organized'}">
                        ${image.organized ? '✓ Organized' : '○ Not Organized'}
                    </span>
                </div>
            </div>
            <div class="image-info">
                <p class="image-name" title="${image.originalName}">${image.originalName}</p>
                <div class="tags-section">
                    <div class="auto-tags">
                        ${autoTags.map(tag => `<span class="tag auto-tag">${tag}</span>`).join('')}
                    </div>
                    ${tags.length > 0 ? `
                        <div class="custom-tags">
                            ${tags.map(tag => `<span class="tag custom-tag">${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                ${categories.length > 0 ? `
                    <div class="categories">
                        Categories: ${categories.join(', ')}
                    </div>
                ` : ''}
                ${image.personId ? `<p class="person-id">Person: ${image.personId}</p>` : ''}
                <div class="image-actions">
                    <button onclick="organizeImage('${image.filename}')" class="btn-organize" ${image.organized ? 'disabled' : ''}>
                        📁 Organize
                    </button>
                    <button onclick="deleteImage('${image.filename}')" class="btn-delete">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
}

// View single image
async function viewImage(filename) {
    try {
        const response = await fetch(`/api/images/${filename}`);
        const image = await response.json();
        
        if (response.status === 404 || image.error) {
            showMessage('Image not found', 'error');
            return;
        }
        
        const autoTags = Array.isArray(image.autoTags) ? image.autoTags : [];
        const tags = Array.isArray(image.tags) ? image.tags : [];
        const organizedPaths = Array.isArray(image.organizedPaths) ? image.organizedPaths : [];
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <img src="${image.url}" alt="${image.originalName}" class="modal-image">
                <div class="modal-info">
                    <h3>${image.originalName}</h3>
                    <p><strong>Filename:</strong> ${image.filename}</p>
                    <p><strong>Collection:</strong> ${image.collection || 'Unknown'}</p>
                    <p><strong>Auto-tags:</strong> ${autoTags.join(', ') || 'None'}</p>
                    <p><strong>Custom tags:</strong> ${tags.length > 0 ? tags.join(', ') : 'None'}</p>
                    <p><strong>Organized:</strong> ${image.organized ? 'Yes' : 'No'}</p>
                    ${organizedPaths.length > 0 ? 
                        `<p><strong>Paths:</strong><br>${organizedPaths.map(p => p.split('/organized/')[1] || p).join('<br>')}</p>` : ''}
                </div>
            </div>
        `;
        
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        document.body.appendChild(modal);
    } catch (error) {
        showMessage('Failed to load image details', 'error');
    }
}

// Organize single image
async function organizeImage(filename) {
    try {
        const response = await fetch('/api/organize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage(`Organized to: ${result.results[0].organizedTo.join(', ')}`, 'success');
            loadImages();
            loadStats();
        } else {
            showMessage(result.error || 'Organization failed', 'error');
        }
    } catch (error) {
        showMessage('Organization failed: ' + error.message, 'error');
    }
}

// Delete image
async function deleteImage(filename) {
    if (!confirm('Are you sure you want to delete this image?')) return;
    
    try {
        const response = await fetch(`/api/images/${filename}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showMessage('Image deleted successfully', 'success');
            loadImages();
            loadStats();
        } else {
            const result = await response.json();
            showMessage(result.error || 'Delete failed', 'error');
        }
    } catch (error) {
        showMessage('Delete failed: ' + error.message, 'error');
    }
}

// Organize all images
async function organizeAll() {
    if (!confirm('Organize all unorganized images?')) return;
    
    try {
        showMessage('Organizing...', 'info');
        const response = await fetch('/api/organize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const result = await response.json();
        showMessage(result.message, 'success');
        loadImages();
        loadStats();
    } catch (error) {
        showMessage('Organization failed: ' + error.message, 'error');
    }
}

// Reprocess all images
async function reprocessAll() {
    if (!confirm('Re-analyze all images? This will update auto-tags.')) return;
    
    try {
        showMessage('Reprocessing...', 'info');
        const response = await fetch('/api/reprocess', { method: 'POST' });
        const result = await response.json();
        showMessage(result.message, 'success');
        loadImages();
        loadStats();
    } catch (error) {
        showMessage('Reprocessing failed: ' + error.message, 'error');
    }
}

// Reorganize all images
async function reorganizeAll() {
    if (!confirm('This will clear organized folder and reorganize all images. Continue?')) return;
    
    try {
        showMessage('Reorganizing...', 'info');
        const response = await fetch('/api/reorganize', { method: 'POST' });
        const result = await response.json();
        showMessage(result.message, 'success');
        loadImages();
        loadStats();
    } catch (error) {
        showMessage('Reorganization failed: ' + error.message, 'error');
    }
}

// Filter by category
function filterByCategory(category) {
    if (category) {
        loadImages({ category });
    } else {
        loadImages();
    }
}

// Filter by organized status
function filterByOrganized(organized) {
    if (organized !== '') {
        loadImages({ organized });
    } else {
        loadImages();
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        // Update individual stat elements (matching index.html IDs)
        const totalEl = document.getElementById('totalImages');
        const organizedEl = document.getElementById('organizedImages');
        const peopleEl = document.getElementById('peopleImages');
        const petsEl = document.getElementById('petsImages');
        const natureEl = document.getElementById('natureImages');
        const vehiclesEl = document.getElementById('vehiclesImages');
        
        if (totalEl) totalEl.textContent = stats.total || 0;
        if (organizedEl) organizedEl.textContent = stats.organized || 0;
        if (peopleEl) peopleEl.textContent = stats.categories?.people || 0;
        if (petsEl) petsEl.textContent = stats.categories?.pets || 0;
        if (natureEl) natureEl.textContent = stats.categories?.nature || 0;
        if (vehiclesEl) vehiclesEl.textContent = stats.categories?.vehicles || 0;
        
        // Also update if there's a stats div (fallback)
        const statsDiv = document.getElementById('stats');
        if (statsDiv) {
            statsDiv.innerHTML = `
                <div class="stat-card">
                    <h3>📷 Total</h3>
                    <p>${stats.total || 0}</p>
                </div>
                <div class="stat-card">
                    <h3>✅ Organized</h3>
                    <p>${stats.organized || 0}</p>
                </div>
                <div class="stat-card">
                    <h3>📤 Pending</h3>
                    <p>${stats.unorganized || 0}</p>
                </div>
                <div class="stat-card">
                    <h3>👤 People</h3>
                    <p>${stats.categories?.people || 0}</p>
                </div>
                <div class="stat-card">
                    <h3>🐾 Pets</h3>
                    <p>${stats.categories?.pets || 0}</p>
                </div>
                <div class="stat-card">
                    <h3>🌿 Nature</h3>
                    <p>${stats.categories?.nature || 0}</p>
                </div>
                <div class="stat-card">
                    <h3>🚗 Vehicles</h3>
                    <p>${stats.categories?.vehicles || 0}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// View collections summary
async function viewCollections() {
    try {
        const response = await fetch('/api/collections');
        const data = await response.json();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content collections-modal">
                <span class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2>📊 Collections Summary (Full Image Data Stored)</h2>
                
                <div class="collection-section">
                    <h3>👤 Persons (${data.persons.length} tracked)</h3>
                    <div class="collection-items">
                        ${data.persons.map(p => `
                            <div class="collection-item">
                                <strong>${p.personId}</strong>: ${p.images.length} image(s)
                                <br><small>${p.images.map(img => img.filename).slice(0, 3).join(', ')}${p.images.length > 3 ? '...' : ''}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="collection-section">
                    <h3>🐾 Pets (${data.pets.length} categories)</h3>
                    <div class="collection-items">
                        ${data.pets.map(p => `
                            <div class="collection-item">
                                <strong>${p.category}</strong>: ${p.images.length} image(s)
                                <br><small>${p.images.map(img => img.filename).slice(0, 3).join(', ')}${p.images.length > 3 ? '...' : ''}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="collection-section">
                    <h3>🌿 Nature (${data.nature.length} categories)</h3>
                    <div class="collection-items">
                        ${data.nature.map(n => `
                            <div class="collection-item">
                                <strong>${n.category}</strong>: ${n.images.length} image(s)
                                <br><small>${n.images.map(img => img.filename).slice(0, 3).join(', ')}${n.images.length > 3 ? '...' : ''}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="collection-section">
                    <h3>🚗 Vehicles (${data.vehicles.length} categories)</h3>
                    <div class="collection-items">
                        ${data.vehicles.map(v => `
                            <div class="collection-item">
                                <strong>${v.category}</strong>: ${v.images.length} image(s)
                                <br><small>${v.images.map(img => img.filename).slice(0, 3).join(', ')}${v.images.length > 3 ? '...' : ''}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        document.body.appendChild(modal);
    } catch (error) {
        showMessage('Failed to load collections: ' + error.message, 'error');
    }
}

// Show message
function showMessage(message, type = 'info') {
    const container = document.getElementById('messages') || createMessagesContainer();
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.textContent = message;
    
    container.appendChild(msgDiv);
    
    setTimeout(() => msgDiv.remove(), 4000);
}

function createMessagesContainer() {
    const container = document.createElement('div');
    container.id = 'messages';
    container.className = 'messages-container';
    document.body.appendChild(container);
    return container;
}

// Function aliases - HTML uses different names
function reprocessAllImages() { return reprocessAll(); }
function reorganizeAllImages() { return reorganizeAll(); }
function organizeAllImages() { return organizeAll(); }

// Load collections data for database tab
async function loadCollections() {
    try {
        showMessage('Loading collections data...', 'info');
        const response = await fetch('/api/collections');
        const data = await response.json();
        
        const display = document.getElementById('collectionsDisplay');
        if (display) {
            display.innerHTML = `
                <div class="collection-data">
                    <h4>👤 Persons: ${data.persons?.length || 0} tracked</h4>
                    <pre>${JSON.stringify(data.persons?.slice(0, 3), null, 2)}${data.persons?.length > 3 ? '\n...' : ''}</pre>
                    
                    <h4>🐾 Pets: ${data.pets?.length || 0} categories</h4>
                    <pre>${JSON.stringify(data.pets?.slice(0, 3), null, 2)}${data.pets?.length > 3 ? '\n...' : ''}</pre>
                    
                    <h4>🌿 Nature: ${data.nature?.length || 0} categories</h4>
                    <pre>${JSON.stringify(data.nature?.slice(0, 3), null, 2)}${data.nature?.length > 3 ? '\n...' : ''}</pre>
                    
                    <h4>🚗 Vehicles: ${data.vehicles?.length || 0} categories</h4>
                    <pre>${JSON.stringify(data.vehicles?.slice(0, 3), null, 2)}${data.vehicles?.length > 3 ? '\n...' : ''}</pre>
                </div>
            `;
        }
        showMessage('Collections data loaded!', 'success');
    } catch (error) {
        showMessage('Failed to load collections: ' + error.message, 'error');
    }
}

// Load raw data for database tab
async function loadRawData() {
    try {
        showMessage('Loading raw data...', 'info');
        const response = await fetch('/api/images');
        const data = await response.json();
        
        const display = document.getElementById('rawDataDisplay');
        if (display) {
            display.textContent = JSON.stringify(data, null, 2);
        }
        showMessage('Raw data loaded!', 'success');
    } catch (error) {
        showMessage('Failed to load raw data: ' + error.message, 'error');
    }
}
