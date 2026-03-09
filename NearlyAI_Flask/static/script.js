// ═══════════════════════════════════════════════════════
//  NearlyAI — Client-Side JavaScript (v2 — Enhanced)
// ═══════════════════════════════════════════════════════

// ═══ CATEGORY ICON COLOURS ═══
const CATEGORY_STYLES = {
    '🧵': { bg: 'linear-gradient(135deg,#a855f7,#7c3aed)', label: 'Tailor' },
    '🍰': { bg: 'linear-gradient(135deg,#f97316,#ea580c)', label: 'Bakery' },
    '📚': { bg: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', label: 'Education' },
    '🔧': { bg: 'linear-gradient(135deg,#6b7280,#374151)', label: 'Repair' },
    '✂️': { bg: 'linear-gradient(135deg,#ec4899,#be185d)', label: 'Salon' },
    '📱': { bg: 'linear-gradient(135deg,#06b6d4,#0e7490)', label: 'Electronics' },
    '🛒': { bg: 'linear-gradient(135deg,#22c55e,#15803d)', label: 'Grocery' },
    '💊': { bg: 'linear-gradient(135deg,#ef4444,#b91c1c)', label: 'Pharmacy' },
    '🏋️': { bg: 'linear-gradient(135deg,#f59e0b,#b45309)', label: 'Gym' },
    '🚗': { bg: 'linear-gradient(135deg,#64748b,#334155)', label: 'Auto' },
    '🏡': { bg: 'linear-gradient(135deg,#84cc16,#4d7c0f)', label: 'Real Estate' },
    '🎉': { bg: 'linear-gradient(135deg,#f43f5e,#be123c)', label: 'Events' },
    '🍲': { bg: 'linear-gradient(135deg,#fb923c,#c2410c)', label: 'Restaurant' },
    '✈️': { bg: 'linear-gradient(135deg,#38bdf8,#0369a1)', label: 'Travel' },
    '🎀': { bg: 'linear-gradient(135deg,#f472b6,#be185d)', label: 'Accessories' },
    '🏪': { bg: 'linear-gradient(135deg,#667eea,#764ba2)', label: 'Business' },
};

function getCategoryStyle(icon) {
    return CATEGORY_STYLES[icon] || CATEGORY_STYLES['🏪'];
}

function applyRichCategoryIcons() {
    // Category cards on homepage
    document.querySelectorAll('.category-card').forEach(card => {
        const iconEl = card.querySelector('.icon');
        if (!iconEl) return;
        const icon = iconEl.textContent.trim();
        const style = getCategoryStyle(icon);
        const iconCircle = document.createElement('div');
        iconCircle.className = 'cat-icon-circle';
        iconCircle.style.cssText = `background:${style.bg}; width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.8rem; margin:0 auto 0.5rem; box-shadow:0 4px 15px rgba(0,0,0,0.3);`;
        iconCircle.textContent = icon;
        iconEl.replaceWith(iconCircle);
    });

    // Business card images (emoji placeholder)
    document.querySelectorAll('.biz-card-img').forEach(img => {
        const icon = img.textContent.trim();
        if (icon && CATEGORY_STYLES[icon]) {
            const style = getCategoryStyle(icon);
            img.style.background = style.bg;
            img.style.fontSize = '4rem';
        }
    });

    // Detail page large icon
    document.querySelectorAll('.cat-icon-lg').forEach(el => {
        const icon = el.textContent.trim();
        const style = getCategoryStyle(icon);
        el.style.cssText = `background:${style.bg}; padding:0.3rem 0.5rem; border-radius:12px; font-size:2rem; box-shadow:0 4px 15px rgba(0,0,0,0.3);`;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Auto-dismiss flash messages
    document.querySelectorAll('.flash').forEach(el => {
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-10px)';
            setTimeout(() => el.remove(), 300);
        }, 4000);
    });

    // Mobile hamburger toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
    }

    // Role selector on registration page
    document.querySelectorAll('.role-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.role-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            opt.querySelector('input').checked = true;
        });
    });

    // Apply rich category icons
    applyRichCategoryIcons();

    // Initialize location pickers if present
    initLocationPicker('location-picker-map', 'lat', 'lng');
    initDetailMap();

    // Inject modals into DOM
    injectModals();
});


// ═══ INJECT MODALS (Category + City add) ═══
function injectModals() {
    // Category modal
    if (!document.getElementById('add-category-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
<div id="add-category-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:9999; align-items:center; justify-content:center;">
  <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:2rem; width:90%; max-width:420px; box-shadow:var(--shadow-lg);">
    <h3 style="margin-bottom:1rem; font-size:1.2rem;">➕ Add New Category</h3>
    <div class="form-group">
      <label style="font-size:0.85rem; color:var(--text-secondary);">Category Name *</label>
      <input id="new-cat-name" class="form-control" placeholder="e.g. Pet Shop" style="margin-top:0.3rem;">
    </div>
    <div class="form-group">
      <label style="font-size:0.85rem; color:var(--text-secondary);">Emoji Icon *</label>
      <input id="new-cat-icon" class="form-control" placeholder="e.g. 🐾" maxlength="4" style="margin-top:0.3rem; font-size:1.5rem; text-align:center;">
    </div>
    <div class="form-group">
      <label style="font-size:0.85rem; color:var(--text-secondary);">Description</label>
      <input id="new-cat-desc" class="form-control" placeholder="Short description (optional)" style="margin-top:0.3rem;">
    </div>
    <div style="display:flex; gap:0.75rem; margin-top:1.25rem;">
      <button class="btn btn-primary" style="flex:1;" onclick="submitNewCategory()">✅ Add Category</button>
      <button class="btn btn-outline" onclick="closeModal('add-category-modal')">Cancel</button>
    </div>
  </div>
</div>`);
    }
    // City modal
    if (!document.getElementById('add-city-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
<div id="add-city-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:9999; align-items:center; justify-content:center;">
  <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:2rem; width:90%; max-width:380px; box-shadow:var(--shadow-lg);">
    <h3 style="margin-bottom:1rem; font-size:1.2rem;">🏙️ Add New City</h3>
    <div class="form-group">
      <label style="font-size:0.85rem; color:var(--text-secondary);">City Name *</label>
      <input id="new-city-name" class="form-control" placeholder="e.g. Sialkot" style="margin-top:0.3rem;">
    </div>
    <div style="display:flex; gap:0.75rem; margin-top:1.25rem;">
      <button class="btn btn-primary" style="flex:1;" onclick="submitNewCity()">✅ Add City</button>
      <button class="btn btn-outline" onclick="closeModal('add-city-modal')">Cancel</button>
    </div>
  </div>
</div>`);
    }
}

function openModal(id) {
    const m = document.getElementById(id);
    if (m) { m.style.display = 'flex'; }
}
function closeModal(id) {
    const m = document.getElementById(id);
    if (m) { m.style.display = 'none'; }
}

// ═══ ADD NEW CATEGORY (Modal version) ═══
function addNewCategory() {
    openModal('add-category-modal');
    setTimeout(() => document.getElementById('new-cat-name')?.focus(), 100);
}

function submitNewCategory() {
    const name = document.getElementById('new-cat-name')?.value.trim();
    const icon = document.getElementById('new-cat-icon')?.value.trim() || '📦';
    const desc = document.getElementById('new-cat-desc')?.value.trim() || '';

    if (!name) { alert('Please enter a category name.'); return; }

    fetch('/api/add-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, description: desc })
    })
        .then(r => r.json())
        .then(data => {
            if (data.error) { alert(data.error); return; }
            const select = document.getElementById('category-select');
            if (select) {
                if (!data.exists) {
                    const opt = new Option(`${data.icon} ${data.name}`, data.id);
                    select.add(opt);
                }
                select.value = data.id;
            }
            closeModal('add-category-modal');
            // Clear inputs
            document.getElementById('new-cat-name').value = '';
            document.getElementById('new-cat-icon').value = '';
            document.getElementById('new-cat-desc').value = '';
            showToast(data.exists ? `"${data.name}" selected!` : `"${data.name}" added successfully!`, 'success');
        })
        .catch(() => alert('Failed to add category. Please try again.'));
}

// ═══ ADD NEW CITY (Modal) ═══
function addNewCity() {
    openModal('add-city-modal');
    setTimeout(() => document.getElementById('new-city-name')?.focus(), 100);
}

function submitNewCity() {
    const city = document.getElementById('new-city-name')?.value.trim();
    if (!city) { alert('Please enter a city name.'); return; }

    fetch('/api/add-city', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city })
    })
        .then(r => r.json())
        .then(data => {
            if (data.error) { alert(data.error); return; }
            // Add to city input datalist
            const cityInput = document.getElementById('city');
            const cityList = document.getElementById('city-list');
            if (cityInput) {
                cityInput.value = data.city;
                if (cityList) {
                    const opt = document.createElement('option');
                    opt.value = data.city;
                    cityList.appendChild(opt);
                }
            }
            closeModal('add-city-modal');
            document.getElementById('new-city-name').value = '';
            showToast(`City "${data.city}" added!`, 'success');
        })
        .catch(() => alert('Failed to add city.'));
}

// ═══ TOAST NOTIFICATION ═══
function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    const colors = { success: '#10b981', danger: '#ef4444', info: '#3b82f6' };
    t.style.cssText = `position:fixed; bottom:2rem; right:2rem; background:${colors[type] || colors.success}; color:#fff; padding:0.8rem 1.4rem; border-radius:10px; font-size:0.9rem; font-weight:600; box-shadow:0 4px 20px rgba(0,0,0,0.3); z-index:99999; animation:slideDown 0.3s ease;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}


// ═══ LEAFLET MAP LOCATION PICKER ═══
let _watchId = null;

function initLocationPicker(mapDivId, latInputId, lngInputId) {
    const mapDiv = document.getElementById(mapDivId);
    if (!mapDiv) return;

    const latInput = document.getElementById(latInputId);
    const lngInput = document.getElementById(lngInputId);

    let defaultLat = parseFloat(latInput?.value) || 31.5497;
    let defaultLng = parseFloat(lngInput?.value) || 74.3436;

    const map = L.map(mapDivId).setView([defaultLat, defaultLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
    }).addTo(map);

    // Pulsing user location circle
    let userCircle = null;

    let marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);
    marker.bindPopup('<strong>📍 Your Business Location</strong><br>Drag to reposition').openPopup();

    marker.on('dragend', function () {
        const pos = marker.getLatLng();
        latInput.value = pos.lat.toFixed(6);
        lngInput.value = pos.lng.toFixed(6);
        updateLocationLabel(pos.lat, pos.lng);
    });

    map.on('click', function (e) {
        marker.setLatLng(e.latlng);
        latInput.value = e.latlng.lat.toFixed(6);
        lngInput.value = e.latlng.lng.toFixed(6);
        updateLocationLabel(e.latlng.lat, e.latlng.lng);
        marker.openPopup();
    });

    if (latInput.value && lngInput.value) {
        marker.setLatLng([parseFloat(latInput.value), parseFloat(lngInput.value)]);
        map.setView([parseFloat(latInput.value), parseFloat(lngInput.value)], 15);
    }

    window._nearlyaiMap = map;
    window._nearlyaiMarker = marker;
    window._nearlyaiUserCircle = null;
}


// ═══ USE MY LOCATION (GPS) ═══
function useMyLocation() {
    const btn = document.getElementById('use-location-btn');
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');

    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.', 'danger');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Getting GPS...';

    navigator.geolocation.getCurrentPosition(
        function (position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            latInput.value = lat.toFixed(6);
            lngInput.value = lng.toFixed(6);

            if (window._nearlyaiMap && window._nearlyaiMarker) {
                window._nearlyaiMarker.setLatLng([lat, lng]);
                window._nearlyaiMap.setView([lat, lng], 16);

                // Show accuracy circle
                if (window._nearlyaiUserCircle) window._nearlyaiMap.removeLayer(window._nearlyaiUserCircle);
                window._nearlyaiUserCircle = L.circle([lat, lng], {
                    radius: position.coords.accuracy || 50,
                    color: '#667eea', fillColor: '#667eea', fillOpacity: 0.15, weight: 2
                }).addTo(window._nearlyaiMap);
            }

            updateLocationLabel(lat, lng);
            btn.disabled = false;
            btn.innerHTML = '✅ Location Set';
            setTimeout(() => { btn.innerHTML = '📍 Use My Location'; }, 3000);
        },
        function () {
            showToast('Location access denied. Please enable location services or enter coordinates manually.', 'danger');
            btn.disabled = false;
            btn.innerHTML = '📍 Use My Location';
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// Live tracking (watchPosition) — called on long press or toggle
function startLiveTracking() {
    const btn = document.getElementById('use-location-btn');
    if (_watchId !== null) {
        stopLiveTracking();
        return;
    }
    if (!navigator.geolocation) return;
    btn.innerHTML = '🔴 Live Tracking...';
    btn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)';
    _watchId = navigator.geolocation.watchPosition(
        function (pos) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            document.getElementById('lat').value = lat.toFixed(6);
            document.getElementById('lng').value = lng.toFixed(6);
            if (window._nearlyaiMap && window._nearlyaiMarker) {
                window._nearlyaiMarker.setLatLng([lat, lng]);
                window._nearlyaiMap.panTo([lat, lng]);
            }
            updateLocationLabel(lat, lng);
        },
        function () { stopLiveTracking(); },
        { enableHighAccuracy: true }
    );
}

function stopLiveTracking() {
    if (_watchId !== null) {
        navigator.geolocation.clearWatch(_watchId);
        _watchId = null;
    }
    const btn = document.getElementById('use-location-btn');
    if (btn) {
        btn.innerHTML = '📍 Use My Location';
        btn.style.background = '';
    }
}


// Update location label with reverse geocode + auto-fill city/area
function updateLocationLabel(lat, lng) {
    const label = document.getElementById('location-label');
    if (label) {
        label.textContent = `📍 Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
        label.style.color = 'var(--success)';
    }

    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
        .then(r => r.json())
        .then(data => {
            if (data.display_name && label) {
                const parts = data.display_name.split(',').slice(0, 3);
                label.textContent = '📍 ' + parts.join(', ');
            }
            // Auto-fill city and area fields
            const addr = data.address || {};
            const cityVal = addr.city || addr.town || addr.county || addr.state_district || '';
            const areaVal = addr.suburb || addr.neighbourhood || addr.village || addr.road || '';
            const cityInput = document.getElementById('city');
            const areaInput = document.getElementById('area');
            if (cityInput && !cityInput.value && cityVal) cityInput.value = cityVal;
            if (areaInput && !areaInput.value && areaVal) areaInput.value = areaVal;
        })
        .catch(() => { });
}


// ═══ BUSINESS DETAIL MAP ═══
function initDetailMap() {
    const mapDiv = document.getElementById('detail-map');
    if (!mapDiv) return;

    const lat = parseFloat(mapDiv.dataset.lat);
    const lng = parseFloat(mapDiv.dataset.lng);
    const name = mapDiv.dataset.name || 'Business';
    const markerImage = mapDiv.dataset.markerImage || '';

    if (!lat || !lng) {
        mapDiv.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:2rem;">Location not available</p>';
        return;
    }

    const map = L.map(mapDiv).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
    }).addTo(map);

    // Business marker
    let bizIcon;
    if (markerImage) {
        bizIcon = L.divIcon({
            html: `<div style="background:#fff;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.5);overflow:hidden;border:2px solid var(--primary);"><img src="/static/uploads/${markerImage}" style="width:100%;height:100%;object-fit:cover;"></div>`,
            className: '', iconSize: [44, 44], iconAnchor: [22, 44]
        });
    } else {
        bizIcon = L.divIcon({
            html: `<div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;box-shadow:0 4px 12px rgba(102,126,234,0.5);">📍</div>`,
            className: '', iconSize: [36, 36], iconAnchor: [18, 36]
        });
    }
    L.marker([lat, lng], { icon: bizIcon }).addTo(map).bindPopup(`<strong>${name}</strong>`).openPopup();

    // Try to show user location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const userLat = pos.coords.latitude;
            const userLng = pos.coords.longitude;
            const userIcon = L.divIcon({
                html: `<div style="background:#3b82f6;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:0.9rem;box-shadow:0 2px 8px rgba(59,130,246,0.6);">👤</div>`,
                className: '', iconSize: [28, 28], iconAnchor: [14, 14]
            });
            L.marker([userLat, userLng], { icon: userIcon }).addTo(map).bindPopup('📍 Your Location');
        }, () => { }, { timeout: 5000 });
    }
}


// ═══ AI PROFILE GENERATOR ═══
function generateAIProfile() {
    const btn = document.getElementById('ai-generate-btn');
    const textarea = document.getElementById('description');
    const bizName = document.getElementById('biz-name')?.value || '';
    const category = document.getElementById('category-select')?.selectedOptions[0]?.text || '';
    const services = document.getElementById('services')?.value || '';
    const city = document.getElementById('city')?.value || '';
    const area = document.getElementById('area')?.value || '';

    if (!bizName) { showToast('Please enter a business name first.', 'danger'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generating...';

    fetch('/api/ai/generate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name: bizName, category, services, city, area })
    })
        .then(r => r.json())
        .then(data => {
            textarea.value = data.description;
            btn.disabled = false;
            btn.innerHTML = '🤖 Generate with AI';
        })
        .catch(() => {
            showToast('AI generation failed. Please try again.', 'danger');
            btn.disabled = false;
            btn.innerHTML = '🤖 Generate with AI';
        });
}


// ═══ AI CUSTOMER QUERY ═══
function askAIQuery(businessId) {
    const input = document.getElementById('ai-question');
    const responseDiv = document.getElementById('ai-response');
    const btn = document.getElementById('ai-ask-btn');
    const question = input.value.trim();

    if (!question) { showToast('Please enter a question.', 'danger'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    responseDiv.classList.add('active');
    responseDiv.innerHTML = '<em>Thinking...</em>';

    fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, question })
    })
        .then(r => r.json())
        .then(data => {
            responseDiv.innerHTML = data.answer || data.error;
            btn.disabled = false;
            btn.innerHTML = 'Ask';
            input.value = '';
        })
        .catch(() => {
            responseDiv.innerHTML = 'Sorry, could not reach the AI right now.';
            btn.disabled = false;
            btn.innerHTML = 'Ask';
        });
}


// ═══ FAVOURITE TOGGLE (AJAX) ═══
function toggleFavourite(bizId, btn) {
    fetch(`/favourite/${bizId}`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'added') {
                btn.classList.add('active');
                btn.innerHTML = '❤️ Saved';
            } else {
                btn.classList.remove('active');
                btn.innerHTML = '🤍 Save';
            }
        })
        .catch(() => { window.location.href = '/login'; });
}


// ═══ GOOGLE MAPS DIRECTIONS ═══
function openDirections(lat, lng, name) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
}


// ═══ AI NEAR ME (with map + cards) ═══
let _nearMeMap = null;

function findNearMeAI() {
    const btn = document.getElementById('ai-near-me-btn');
    const reqInput = document.getElementById('ai-near-me-req');
    const responseDiv = document.getElementById('ai-near-me-response');

    if (!navigator.geolocation) {
        responseDiv.classList.add('active');
        responseDiv.innerHTML = '<span style="color:var(--danger)">Geolocation is not supported by your browser.</span>';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Locating...';
    responseDiv.classList.remove('active');
    responseDiv.innerHTML = '';

    navigator.geolocation.getCurrentPosition(
        function (position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const req = reqInput.value.trim();

            btn.innerHTML = '<span class="spinner"></span> Asking AI...';

            fetch('/api/ai/near-me', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat, lng, requirement: req })
            })
                .then(r => r.json())
                .then(data => {
                    responseDiv.classList.add('active');

                    if (data.error) {
                        responseDiv.innerHTML = `<span style="color:var(--danger)">${data.error}</span>`;
                        btn.disabled = false;
                        btn.innerHTML = '📍 Search Near Me';
                        return;
                    }

                    // AI text recommendation
                    let html = `<div style="margin-bottom:1rem; line-height:1.7; color:var(--text-secondary);">🤖 ${data.recommendation}</div>`;

                    // Business result cards
                    const businesses = data.businesses || [];
                    if (businesses.length > 0) {
                        html += `<div style="display:grid; gap:0.75rem; margin-bottom:1rem;">`;
                        businesses.forEach(biz => {
                            const stars = '★'.repeat(Math.round(biz.avg_rating)) + '☆'.repeat(5 - Math.round(biz.avg_rating));
                            const style = getCategoryStyle(biz.category_icon);
                            html += `
<div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); padding:1rem; display:flex; align-items:center; gap:1rem;">
  <div style="background:${style.bg}; min-width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.5rem; flex-shrink:0;">${biz.category_icon}</div>
  <div style="flex:1; min-width:0;">
    <div style="font-weight:700; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${biz.name}</div>
    <div style="color:var(--text-muted); font-size:0.78rem; margin:0.2rem 0;">📍 ${biz.area}${biz.city ? ', ' + biz.city : ''} · <span style="color:var(--star)">${stars}</span> · 🚶 ${biz.distance_km} km</div>
  </div>
  <div style="display:flex; flex-direction:column; gap:0.4rem; flex-shrink:0;">
    <a href="${biz.url}" class="btn btn-outline btn-sm" style="font-size:0.75rem;">View</a>
    <button class="btn btn-primary btn-sm" style="font-size:0.75rem;" onclick="openDirections(${biz.lat},${biz.lng},'${biz.name.replace(/'/g, "\\'")}')">🗺️ Go</button>
  </div>
</div>`;
                        });
                        html += `</div>`;

                        // Mini map with pins
                        html += `<div id="near-me-map" style="height:220px; border-radius:var(--radius); border:1px solid var(--border); z-index:1; margin-top:0.5rem;"></div>`;
                    }

                    responseDiv.innerHTML = html;
                    btn.disabled = false;
                    btn.innerHTML = '📍 Search Near Me';

                    // Init mini map after DOM update
                    if (businesses.length > 0) {
                        setTimeout(() => initNearMeMap(lat, lng, businesses), 100);
                    }
                })
                .catch(() => {
                    responseDiv.classList.add('active');
                    responseDiv.innerHTML = '<span style="color:var(--danger)">Failed to connect to AI server. Try again later.</span>';
                    btn.disabled = false;
                    btn.innerHTML = '📍 Search Near Me';
                });
        },
        function () {
            responseDiv.classList.add('active');
            responseDiv.innerHTML = '<span style="color:var(--danger)">Location access denied. Please allow location access to find nearby places.</span>';
            btn.disabled = false;
            btn.innerHTML = '📍 Search Near Me';
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function initNearMeMap(userLat, userLng, businesses) {
    const mapDiv = document.getElementById('near-me-map');
    if (!mapDiv) return;
    if (_nearMeMap) { _nearMeMap.remove(); _nearMeMap = null; }

    _nearMeMap = L.map('near-me-map').setView([userLat, userLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap', maxZoom: 19
    }).addTo(_nearMeMap);

    // User marker
    const userIcon = L.divIcon({
        html: `<div style="background:#3b82f6;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:1rem;box-shadow:0 2px 8px rgba(59,130,246,0.5);">👤</div>`,
        className: '', iconSize: [32, 32], iconAnchor: [16, 16]
    });
    L.marker([userLat, userLng], { icon: userIcon }).addTo(_nearMeMap).bindPopup('📍 You are here');

    // Business markers
    const bounds = [[userLat, userLng]];
    businesses.forEach(biz => {
        let bizIcon;
        if (biz.marker_image) {
            bizIcon = L.divIcon({
                html: `<div style="background:#fff;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.5);overflow:hidden;border:2px solid var(--primary);"><img src="/static/uploads/${biz.marker_image}" style="width:100%;height:100%;object-fit:cover;"></div>`,
                className: '', iconSize: [44, 44], iconAnchor: [22, 44]
            });
        } else {
            const style = getCategoryStyle(biz.category_icon);
            bizIcon = L.divIcon({
                html: `<div style="background:${style.bg};color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;box-shadow:0 3px 10px rgba(0,0,0,0.4);">${biz.category_icon}</div>`,
                className: '', iconSize: [36, 36], iconAnchor: [18, 36]
            });
        }
        L.marker([biz.lat, biz.lng], { icon: bizIcon }).addTo(_nearMeMap)
            .bindPopup(`<strong>${biz.name}</strong><br>${biz.distance_km} km away<br><a href="${biz.url}" target="_blank">View Details</a>`);
        bounds.push([biz.lat, biz.lng]);
    });

    if (bounds.length > 1) _nearMeMap.fitBounds(bounds, { padding: [30, 30] });
}
