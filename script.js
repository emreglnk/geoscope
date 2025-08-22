// API Configuration
const API_BASE_URL = (typeof window !== 'undefined' && window.location && window.location.origin)
  ? `${window.location.origin}/api`
  : 'http://localhost:800/api';

// Data storage
let districtData = []; // District summaries for map coloring
let tendersData = []; // All tenders data

// Map state
let currentMapLevel = 'district'; // 'district' | 'province'

/**
 * Fetch tenders data from backend API
 */
async function fetchTendersData() {
    try {
        console.log('Fetching tenders data from API...');
        const response = await fetch(`${API_BASE_URL}/tenders`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            tendersData = result.data;
            console.log(`✅ Loaded ${tendersData.length} tenders from API`);
            return tendersData;
        } else {
            throw new Error(result.message || 'API returned error');
        }
    } catch (error) {
        console.error('❌ Error fetching tenders data:', error);
        // Return empty array as fallback
        return [];
    }
}

/**
 * Fetch districts summary data from backend API (for map coloring)
 */
async function fetchDistrictsData() {
    try {
        console.log('Fetching districts summary from API...');
        const response = await fetch(`${API_BASE_URL}/districts`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            districtData = result.data;
            console.log(`✅ Loaded ${districtData.length} districts summary from API`);
            return districtData;
        } else {
            throw new Error(result.message || 'API returned error');
        }
    } catch (error) {
        console.error('❌ Error fetching districts data:', error);
        
        // Fallback to mock data if API is not available
        districtData = getFallbackData();
        console.log('⚠️ Using fallback mock data');
        return districtData;
    }
}

/**
 * Fallback mock data in case API is not available
 */
function getFallbackData() {
    return [
        {
            districtId: "1971",
            status: "won",
            details: {
                province: "İstanbul",
                district: "Kadıköy",
                tender_duration: "36 ay",
                cabin_count_total: 25,
                cabin_count_full: 18,
                rental_fee: "₺15,000/ay",
                last_meeting_date: "2024-07-15",
                meeting_notes: "Sözleşme imzalandı, kurulum başlatıldı."
            }
        },
        {
            districtId: "1972",
            status: "negotiating",
            details: {
                province: "İstanbul",
                district: "Üsküdar",
                tender_duration: "24 ay",
                cabin_count_total: 20,
                cabin_count_full: 0,
                rental_fee: "₺12,000/ay",
                last_meeting_date: "2024-07-25",
                meeting_notes: "Fiyat görüşmeleri devam ediyor. Rakip firma teklifleri değerlendiriliyor."
            }
        },
        {
            districtId: "798",
            status: "won",
            details: {
                province: "Ankara",
                district: "Çankaya",
                tender_duration: "48 ay",
                cabin_count_total: 40,
                cabin_count_full: 35,
                rental_fee: "₺22,000/ay",
                last_meeting_date: "2024-06-10",
                meeting_notes: "Başarılı proje, ek lokasyonlar için görüşme planlanıyor."
            }
        },
        {
            districtId: "1158",
            status: "won",
            details: {
                province: "İzmir",
                district: "Konak",
                tender_duration: "42 ay",
                cabin_count_total: 32,
                cabin_count_full: 28,
                rental_fee: "₺19,000/ay",
                last_meeting_date: "2024-05-20",
                meeting_notes: "Mükemmel performans, yenileme sözleşmesi görüşülüyor."
            }
        }
    ];
}

// Global variables
let svgElement = null;
let currentFilter = 'all';
let currentZoom = 1;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let labelUpdateTimeout = null;
let currentPan = { x: 0, y: 0 };

// Status color mapping
const statusColors = {
    won: '#10b981',      // green-500
    negotiating: '#fbbf24', // yellow-400
    upcoming: '#fb923c',    // orange-400
    lost: '#ef4444',        // red-500
    competitor: '#8b5cf6',  // violet-500
    terminated: '#111827'   // gray-900 (blackish)
};

// Normalize Turkish strings for robust matching (province/district names)
function normalizeName(input) {
    if (!input) return '';
    return input
        .toString()
        .trim()
        .toLowerCase()
        .replace(/ı/g, 'i').replace(/İ/g, 'i')
        .replace(/ş/g, 's').replace(/Ş/g, 's')
        .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
        .replace(/ü/g, 'u').replace(/Ü/g, 'u')
        .replace(/ö/g, 'o').replace(/Ö/g, 'o')
        .replace(/ç/g, 'c').replace(/Ç/g, 'c')
        .replace(/[^a-z0-9\-\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

// Find district data by SVG groupId using province code and district name
function findDistrictByGroupId(groupId) {
    if (!groupId || !Array.isArray(districtData)) return undefined;
    const provinceFromCode = extractProvinceFromGroupId(groupId);
    const normalizedProvince = normalizeName(provinceFromCode);
    const normalizedGroupDistrict = normalizeName(groupId.split('-').slice(1).join('-'));

    // Prefer strict province match + district name containment
    let match = districtData.find(d =>
        normalizeName(d.details?.province) === normalizedProvince &&
        (normalizedGroupDistrict.includes(normalizeName(d.details?.district)) ||
         normalizeName(d.details?.district).includes(normalizedGroupDistrict))
    );

    if (match) return match;

    // Fallback: try only district containment if province map could not resolve
    match = districtData.find(d =>
        normalizedGroupDistrict.includes(normalizeName(d.details?.district)) ||
        normalizeName(d.details?.district).includes(normalizedGroupDistrict)
    );

    return match;
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 GeoScope Application Starting...');
    
    // First, fetch both tenders and districts data from API
    await fetchTendersData();
    await fetchDistrictsData();
    
    // Then load SVG map and initialize
    await loadSVGMap();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('✅ GeoScope Application Initialized');
});

/**
 * Load SVG map for current level
 */
async function loadSVGMap() {
    const loading = document.getElementById('loading');
    const mapContainer = document.getElementById('map-container');
    
    try {
        loading.classList.remove('hidden');
        
        console.log(`Loading SVG for level: ${currentMapLevel}`);
        
        // Fetch proper SVG file
        const svgPath = currentMapLevel === 'province' ? './map-il.svg' : './map.svg';
        const response = await fetch(svgPath);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch ${svgPath}: ${response.status}`);
        }
        
        const svgText = await response.text();
        
        // Insert SVG into the container
        mapContainer.innerHTML = svgText;
        svgElement = mapContainer.querySelector('svg');
        
        if (!svgElement) {
            throw new Error('SVG element not found in loaded SVG');
        }
        
        // Ensure the SVG is responsive and properly sized
        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.setAttribute('class', 'border rounded max-h-screen');
        
        // Setup zoom and pan functionality
        setupZoomAndPan();

        if (currentMapLevel === 'district') {
            // Prepare district paths
            const districtGroups = svgElement.querySelectorAll('g[id]');
            const districtPaths = [];
            districtGroups.forEach(group => {
                const groupId = group.getAttribute('id');
                if (groupId && groupId.includes('-')) {
                    const pathElement = group.querySelector('path');
                    if (pathElement) {
                        pathElement.classList.add('district-path');
                        pathElement.setAttribute('data-district-group-id', groupId);
                        districtPaths.push(pathElement);
                    }
                }
            });
            console.log(`✅ District map loaded with ${districtPaths.length} paths`);
            
            // Add province border overlay
            await addProvinceBordersOverlay();

            // Initialize map after a short delay
            setTimeout(() => {
                try {
                    initializeMap();
                    setupMapInteractions();
                    console.log('District map initialization completed');
                } catch (error) {
                    console.error('Error during district map initialization:', error);
                }
            }, 200);
        } else {
            // Province map
            prepareProvinceGroups();
            setTimeout(() => {
                try {
                    initializeProvinceMap();
                    addProvinceOutlineTopLayer();
                    setupProvinceInteractions();
                    console.log('Province map initialization completed');
                } catch (error) {
                    console.error('Error during province map initialization:', error);
                }
            }, 200);
        }
        
    } catch (error) {
        console.error('Error loading SVG map:', error);
        mapContainer.innerHTML = `
            <div class="text-center p-8">
                <div class="text-red-500 mb-4">Harita yüklenirken hata oluştu.</div>
                <div class="text-sm text-gray-600">Hata: ${error.message}</div>
                <button onclick="loadSVGMap()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Tekrar Dene
                </button>
            </div>
        `;
    } finally {
        loading.classList.add('hidden');
    }
}

/**
 * Overlay province borders on top of district map
 */
async function addProvinceBordersOverlay() {
    try {
        const response = await fetch('./map-il.svg');
        if (!response.ok) return;
        const svgText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');

        // Create overlay group
        const existing = svgElement.querySelector('#province-borders-overlay');
        if (existing) existing.remove();
        const overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        overlayGroup.setAttribute('id', 'province-borders-overlay');
        overlayGroup.setAttribute('pointer-events', 'none');
        overlayGroup.setAttribute('opacity', '1');

        // Append to zoom-group if exists, otherwise to root svg
        const zoomGroup = svgElement.querySelector('#zoom-group') || svgElement;

        // Clone each province path into overlay
        const provinceGroups = doc.querySelectorAll('g[title]');
        provinceGroups.forEach(g => {
            const provinceName = g.getAttribute('title') || g.getAttribute('id') || '';
            const status = getProvinceAggregatedStatus(provinceName);
            const color = status ? statusColors[status] : '#6b7280';

        // 1) Outer "eraser" stroke to create inset look (fully transparent fill)
            const eraser = g.cloneNode(true);
            eraser.querySelectorAll('path').forEach(p => {
                p.setAttribute('fill', 'none');
                p.setAttribute('stroke', '#e5e7eb'); // page bg-ish (gray-200)
            p.setAttribute('stroke-width', '3');
                p.setAttribute('stroke-linejoin', 'round');
                p.setAttribute('stroke-linecap', 'round');
                p.setAttribute('vector-effect', 'non-scaling-stroke');
            });
            overlayGroup.appendChild(eraser);

            // 2) Inner colored stroke (actual border)
            const inner = g.cloneNode(true);
            inner.querySelectorAll('path').forEach(p => {
                p.setAttribute('fill', 'none');
                p.setAttribute('stroke', color);
                p.setAttribute('stroke-width', '1.6');
                p.setAttribute('stroke-linejoin', 'round');
                p.setAttribute('stroke-linecap', 'round');
                p.setAttribute('vector-effect', 'non-scaling-stroke');
                p.setAttribute('stroke-opacity', status ? '0.95' : '0.7');
            });
            overlayGroup.appendChild(inner);
        });

        zoomGroup.appendChild(overlayGroup);
        console.log('🧭 Province borders overlay added');
    } catch (e) {
        console.warn('Could not add province borders overlay:', e);
    }
}

/**
 * Prepare province groups with helper attributes
 */
function prepareProvinceGroups() {
    if (!svgElement) return;
    const provinceGroups = svgElement.querySelectorAll('g[title], g[iso2], g[id]');
    provinceGroups.forEach(group => {
        const title = group.getAttribute('title');
        const idName = group.getAttribute('id');
        const name = (title && title.trim()) ? title : (idName || '').trim();
        group.setAttribute('data-province-name', name);
        group.classList.add('province-group');
        // Cursor and base styles
        group.style.cursor = 'pointer';
        group.querySelectorAll('path').forEach(p => {
            p.style.stroke = '#9ca3af';
            p.style.strokeWidth = '1.2';
            p.style.vectorEffect = 'non-scaling-stroke';
            p.style.strokeLinejoin = 'round';
            p.style.strokeLinecap = 'round';
        });
    });
}

/**
 * Determine aggregated province status from district data
 */
function getProvinceAggregatedStatus(provinceName) {
    const items = districtData.filter(d => normalizeName(d.details?.province) === normalizeName(provinceName));
    if (items.length === 0) return undefined;
    // Priority: won > negotiating > upcoming > competitor > lost > terminated
    if (items.some(i => i.status === 'won')) return 'won';
    if (items.some(i => i.status === 'negotiating')) return 'negotiating';
    if (items.some(i => i.status === 'upcoming')) return 'upcoming';
    if (items.some(i => i.status === 'competitor')) return 'competitor';
    if (items.some(i => i.status === 'lost')) return 'lost';
    if (items.some(i => i.status === 'terminated')) return 'terminated';
    return undefined;
}

/**
 * Get counts per status for a province
 */
function getProvinceStatusCounts(provinceName) {
    const items = districtData.filter(d => normalizeName(d.details?.province) === normalizeName(provinceName));
    const counts = { won: 0, negotiating: 0, upcoming: 0, lost: 0 };
    items.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return { counts, total: items.length };
}

/**
 * Color provinces based on aggregated status
 */
function initializeProvinceMap() {
    if (!svgElement) return;
    const groups = svgElement.querySelectorAll('g.province-group');
    let colored = 0;
    groups.forEach(group => {
        const provinceName = group.getAttribute('data-province-name') || group.getAttribute('title') || group.getAttribute('id');
        const status = getProvinceAggregatedStatus(provinceName);
        const color = status ? statusColors[status] : '#e5e7eb';
        group.querySelectorAll('path').forEach(p => {
            p.style.fill = color;
            // Hide per-province stroke; we'll draw a separate top outline layer for full borders
            p.style.stroke = 'none';
            p.style.strokeWidth = '0';
        });
        if (status) colored++;
        // Hover effects
        group.addEventListener('mouseenter', function() {
            group.querySelectorAll('path').forEach(p => {
                p.style.stroke = '#000';
                p.style.strokeWidth = '1.2';
                p.style.filter = 'brightness(1.05)';
            });
        });
        group.addEventListener('mouseleave', function() {
            group.querySelectorAll('path').forEach(p => {
                p.style.stroke = 'none';
                p.style.strokeWidth = '0';
                p.style.filter = 'none';
            });
        });
    });
    console.log(`🗺️ Provinces colored: ${colored}/${groups.length}`);
}

/**
 * Add a top outline for all provinces so borders are fully visible regardless of fill
 */
function addProvinceOutlineTopLayer() {
    if (!svgElement) return;
    const existing = svgElement.querySelector('#province-outline-top');
    if (existing) existing.remove();
    const outline = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    outline.setAttribute('id', 'province-outline-top');
    outline.setAttribute('pointer-events', 'none');
    const groups = svgElement.querySelectorAll('g[title]');
    groups.forEach(g => {
        const clone = g.cloneNode(true);
        clone.querySelectorAll('path').forEach(p => {
            p.setAttribute('fill', 'none');
            p.setAttribute('stroke', '#4b5563'); // gray-600
            p.setAttribute('stroke-width', '1.4');
            p.setAttribute('vector-effect', 'non-scaling-stroke');
            p.setAttribute('stroke-linejoin', 'round');
            p.setAttribute('stroke-linecap', 'round');
        });
        outline.appendChild(clone);
    });
    const zoomGroup = svgElement.querySelector('#zoom-group') || svgElement;
    zoomGroup.appendChild(outline);
}

/**
 * Province interactions: tooltip and click menu
 */
function setupProvinceInteractions() {
    if (!svgElement) return;
    const tooltip = document.getElementById('tooltip');
    const groups = svgElement.querySelectorAll('g.province-group');
    groups.forEach(group => {
        const provinceName = group.getAttribute('data-province-name') || group.getAttribute('title') || group.getAttribute('id');
        group.addEventListener('mouseenter', function(e) {
            showProvinceTooltip(e, provinceName);
        });
        group.addEventListener('mousemove', function(e) {
            updateTooltipPosition(e);
        });
        group.addEventListener('mouseleave', function() {
            tooltip.classList.add('hidden');
        });
        group.addEventListener('click', function(e) {
            e.stopPropagation();
            showProvinceClickMenu(e, provinceName);
        });
    });
}

function showProvinceTooltip(event, provinceName) {
    const tooltip = document.getElementById('tooltip');
    const { counts, total } = getProvinceStatusCounts(provinceName);
    const status = getProvinceAggregatedStatus(provinceName);
    const content = `
        <strong>${provinceName}</strong><br>
        <span class="inline-block px-2 py-0.5 rounded text-white text-xs" style="background-color: ${status ? statusColors[status] : '#9ca3af'}">${status ? getStatusText(status) : 'Veri yok'}</span><br>
        Alınan: ${counts.won} • Görüşme: ${counts.negotiating} • İhale: ${counts.upcoming} • Olumsuz: ${counts.lost}
    `;
    tooltip.innerHTML = content;
    tooltip.classList.remove('hidden');
    updateTooltipPosition(event);
}

function showProvinceClickMenu(event, provinceName) {
    const existingMenu = document.getElementById('district-click-menu');
    if (existingMenu) existingMenu.remove();
    const menu = document.createElement('div');
    menu.id = 'district-click-menu';
    menu.className = 'fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-48';
    menu.style.left = (event.pageX + 10) + 'px';
    menu.style.top = (event.pageY + 10) + 'px';
    const { counts, total } = getProvinceStatusCounts(provinceName);
    const status = getProvinceAggregatedStatus(provinceName);
    menu.innerHTML = `
        <div class="p-3 border-b border-gray-100">
            <h3 class="font-semibold text-gray-900">${provinceName}</h3>
            <p class="text-sm text-gray-600">${total} ilçe kaydı</p>
        </div>
        <div class="py-2">
            <div class="px-4 py-2 text-sm text-gray-700 flex items-center">
                <span class="inline-block w-3 h-3 rounded mr-2" style="background:${status ? statusColors[status] : '#9ca3af'}"></span>
                ${status ? getStatusText(status) : 'Veri yok'}
            </div>
            <button onclick="openEditTenderForProvince('${provinceName}')" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4h2m-1 1v14m7-7H5"></path>
                </svg>
                İl Düzeyinde Düzenle
            </button>
            <button onclick="addTenderForDistrict('${provinceName}', '')" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Yeni İhale Ekle (İl)
            </button>
        </div>
    `;
    document.body.appendChild(menu);
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

/**
 * Initialize map by coloring districts based on their status
 */
function initializeMap() {
    if (!svgElement) return;
    
    // Look for path elements with district group IDs (real map)
    const districtPaths = svgElement.querySelectorAll('path[data-district-group-id]');
    console.log(`🔍 Found ${districtPaths.length} SVG district paths with group IDs`);
    
    // Debug: Log district IDs from SVG
    const svgDistrictIds = [];
    districtPaths.forEach((path, index) => {
        const groupId = path.getAttribute('data-district-group-id');
        console.log(`SVG District ${index + 1}: Group ID=${groupId}`);
        svgDistrictIds.push(groupId);
    });
    
    // Debug: Log API district IDs
    console.log('API District IDs:', districtData.map(d => d.districtId));
    
    let coloredCount = 0;
    
    districtPaths.forEach(path => {
        // Add CSS class for styling (already added in loadSVGMap, but ensure it's there)
        path.classList.add('district-path');
        
        // Get the district group ID
        const groupId = path.getAttribute('data-district-group-id');
        
        // Try to match with district data - for now, try to match with districtId
        // In the future, we may need to create a mapping between SVG IDs and district IDs
        const district = findDistrictByGroupId(groupId);
        
        if (district) {
            // Apply status-based coloring
            path.style.fill = statusColors[district.status];
            coloredCount++;
            console.log(`✅ Colored district: ${district.details.province}/${district.details.district} (Group ID: ${groupId})`);
        } else {
            // Default color for districts without data
            path.style.fill = '#e5e7eb'; // gray-200
            console.log(`⚠️  No data found for district group: ${groupId}`);
        }
        
        // Softer borders
        path.style.stroke = '#9ca3af'; // gray-400
        path.style.strokeWidth = '0.8';
        path.style.cursor = 'pointer';
        
        // Add hover effects
        path.addEventListener('mouseenter', function() {
            this.style.stroke = '#6b7280'; // gray-500
            this.style.strokeWidth = '1.2';
            this.style.filter = 'brightness(1.04)';
        });
        
        path.addEventListener('mouseleave', function() {
            this.style.stroke = '#9ca3af';
            this.style.strokeWidth = '0.5';
            this.style.filter = 'none';
        });
    });
    
    console.log(`🎯 Successfully colored ${coloredCount} districts out of ${districtPaths.length} total districts`);
}

/**
 * Setup zoom and pan functionality for the SVG map
 */
function setupZoomAndPan() {
    if (!svgElement) return;
    
    const mapContainer = svgElement.parentElement;
    
    // Create a group element for zoom/pan transformations
    const zoomGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    zoomGroup.setAttribute('id', 'zoom-group');
    
    // Move all existing content into the zoom group
    while (svgElement.firstChild) {
        zoomGroup.appendChild(svgElement.firstChild);
    }
    svgElement.appendChild(zoomGroup);
    
    // Mouse wheel zoom
    svgElement.addEventListener('wheel', function(e) {
        e.preventDefault();
        
        const rect = svgElement.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Get current viewBox or create one
        let viewBox = svgElement.viewBox.baseVal;
        if (!viewBox || (viewBox.width === 0 && viewBox.height === 0)) {
            const bbox = svgElement.getBBox();
            svgElement.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
            viewBox = svgElement.viewBox.baseVal;
        }
        
        // Calculate zoom (faster zoom)
        const zoomFactor = e.deltaY < 0 ? 0.8 : 1.25;
        const newWidth = viewBox.width * zoomFactor;
        const newHeight = viewBox.height * zoomFactor;
        
        // Calculate new position to zoom towards mouse cursor
        const mouseRatioX = mouseX / rect.width;
        const mouseRatioY = mouseY / rect.height;
        
        const deltaWidth = viewBox.width - newWidth;
        const deltaHeight = viewBox.height - newHeight;
        
        const newX = viewBox.x + deltaWidth * mouseRatioX;
        const newY = viewBox.y + deltaHeight * mouseRatioY;
        
        svgElement.setAttribute('viewBox', `${newX} ${newY} ${newWidth} ${newHeight}`);
        
        // Update current zoom level
        currentZoom = 1000 / newWidth; // Approximate zoom level
        
        // Show/hide district labels based on zoom level
        updateDistrictLabels();
        
        console.log(`🔍 Zoom level: ${currentZoom.toFixed(2)}`);
    });
    
    // Mouse drag pan
    svgElement.addEventListener('mousedown', function(e) {
        if (e.button === 0) { // Left mouse button
            isPanning = true;
            panStart.x = e.clientX;
            panStart.y = e.clientY;
            svgElement.style.cursor = 'grabbing';
        }
    });
    
    svgElement.addEventListener('mousemove', function(e) {
        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            
            const viewBox = svgElement.viewBox.baseVal;
            const rect = svgElement.getBoundingClientRect();
            
            // Calculate pan delta in SVG coordinates
            const panDx = -(dx / rect.width) * viewBox.width;
            const panDy = -(dy / rect.height) * viewBox.height;
            
            const newX = viewBox.x + panDx;
            const newY = viewBox.y + panDy;
            
            svgElement.setAttribute('viewBox', `${newX} ${newY} ${viewBox.width} ${viewBox.height}`);
            
            // Update label positions in real-time during pan
            updateAllLabelPositions();
            
            // Throttled label refresh for newly visible areas
            if (labelUpdateTimeout) {
                clearTimeout(labelUpdateTimeout);
            }
            labelUpdateTimeout = setTimeout(() => {
                updateDistrictLabels();
            }, 100); // Refresh labels after 100ms of no movement
            
            panStart.x = e.clientX;
            panStart.y = e.clientY;
        }
    });
    
    svgElement.addEventListener('mouseup', function() {
        isPanning = false;
        svgElement.style.cursor = 'default';
    });
    
    svgElement.addEventListener('mouseleave', function() {
        isPanning = false;
        svgElement.style.cursor = 'default';
    });
    
    console.log('🎯 Zoom and pan functionality enabled');
}

// Global variable to store active labels
let activeLabels = [];

/**
 * Update district labels visibility based on zoom level
 * Labels are now HTML elements that maintain constant size and track SVG transformations
 */
function updateDistrictLabels() {
    if (!svgElement) return;
    
    // Remove existing HTML labels
    clearDistrictLabels();
    
    // Show labels only when zoomed in (zoom > 3.0) with collision detection
    if (currentZoom > 3.0) {
        const districtPaths = svgElement.querySelectorAll('path[data-district-group-id]');
        const labelPositions = []; // Track label positions to avoid collisions
        const mapContainer = svgElement.parentElement;
        
        // First pass: collect all potential labels with their data
        const potentialLabels = [];
        districtPaths.forEach(path => {
            const groupId = path.getAttribute('data-district-group-id');
            const district = districtData.find(d => 
                d.districtId === groupId || 
                groupId.includes(d.districtId) ||
                d.districtId.includes(groupId)
            );
            
            const bbox = path.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            
            // Only include districts that are large enough and visible in current viewport
            const minSize = Math.min(bbox.width, bbox.height);
            if (minSize > 2) { // Lower threshold since we're using HTML elements
                potentialLabels.push({
                    path,
                    groupId,
                    district,
                    centerX, // SVG coordinates
                    centerY, // SVG coordinates
                    size: minSize,
                    bbox
                });
            }
        });
        
        // Sort by district size (larger districts get priority)
        potentialLabels.sort((a, b) => b.size - a.size);
        
        // Second pass: place labels with collision detection
        potentialLabels.forEach(labelInfo => {
            const { path, groupId, district, centerX, centerY, size, bbox } = labelInfo;
            
            // Convert SVG coordinates to current screen coordinates
            const screenCoords = svgToScreenCoordinates(centerX, centerY);
            const screenX = screenCoords.x;
            const screenY = screenCoords.y;
            
            // Skip labels that are not visible in current viewport
            if (!screenCoords.visible) {
                return; // Skip this label
            }
            
            // Check for collisions with existing labels (in screen coordinates)
            const labelWidth = 80; // Fixed width for HTML labels
            const labelHeight = 20; // Fixed height for HTML labels
            
            const hasCollision = labelPositions.some(pos => {
                const dx = Math.abs(screenX - pos.x);
                const dy = Math.abs(screenY - pos.y);
                return dx < (labelWidth + pos.width) / 2 + 10 && dy < (labelHeight + pos.height) / 2 + 5;
            });
            
            if (!hasCollision) {
                // Create HTML label element
                const labelDiv = document.createElement('div');
                labelDiv.className = 'district-label-html';
                labelDiv.setAttribute('data-svg-x', centerX);
                labelDiv.setAttribute('data-svg-y', centerY);
                labelDiv.setAttribute('data-group-id', groupId);
                
                labelDiv.style.position = 'absolute';
                labelDiv.style.width = `${labelWidth}px`;
                labelDiv.style.height = `${labelHeight}px`;
                labelDiv.style.display = 'flex';
                labelDiv.style.alignItems = 'center';
                labelDiv.style.justifyContent = 'center';
                labelDiv.style.pointerEvents = 'none';
                labelDiv.style.textAlign = 'center';
                labelDiv.style.zIndex = '1000';
                labelDiv.style.borderRadius = '4px';
                labelDiv.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
                
                if (district) {
                    labelDiv.style.fontSize = '11px';
                    labelDiv.style.fontWeight = 'bold';
                    labelDiv.style.color = '#1f2937';
                    labelDiv.style.backgroundColor = 'rgba(255,255,255,0.9)';
                    labelDiv.style.border = '1px solid #d1d5db';
                    labelDiv.textContent = district.details.district;
                } else {
                    labelDiv.style.fontSize = '10px';
                    labelDiv.style.fontWeight = 'normal';
                    labelDiv.style.color = '#6b7280';
                    labelDiv.style.backgroundColor = 'rgba(255,255,255,0.7)';
                    labelDiv.style.border = '1px solid #e5e7eb';
                    labelDiv.textContent = groupId.split('-')[1] || groupId;
                }
                
                // Position the label
                updateLabelPosition(labelDiv);
                
                mapContainer.appendChild(labelDiv);
                activeLabels.push(labelDiv);
                
                // Record this label's position
                labelPositions.push({
                    x: screenX,
                    y: screenY,
                    width: labelWidth,
                    height: labelHeight
                });
            }
        });
        
        console.log(`🏷️ District labels shown (zoom: ${currentZoom.toFixed(2)})`);
    } else {
        console.log(`🏷️ District labels hidden (zoom: ${currentZoom.toFixed(2)})`);
    }
}

/**
 * Convert SVG coordinates to screen coordinates using SVG's built-in transformation matrix
 */
function svgToScreenCoordinates(svgX, svgY) {
    if (!svgElement) return { x: 0, y: 0, visible: false };
    
    try {
        // Create an SVG point
        const svgPoint = svgElement.createSVGPoint();
        svgPoint.x = svgX;
        svgPoint.y = svgY;
        
        // Transform to screen coordinates using SVG's transformation matrix
        const screenCTM = svgElement.getScreenCTM();
        if (!screenCTM) {
            // Fallback to simple calculation if getScreenCTM fails
            const viewBox = svgElement.viewBox.baseVal;
            const svgRect = svgElement.getBoundingClientRect();
            const scaleX = svgRect.width / viewBox.width;
            const scaleY = svgRect.height / viewBox.height;
            
            const screenX = (svgX - viewBox.x) * scaleX;
            const screenY = (svgY - viewBox.y) * scaleY;
            
            const isVisible = screenX >= -50 && screenX <= svgRect.width + 50 &&
                             screenY >= -50 && screenY <= svgRect.height + 50;
            
            return { x: screenX, y: screenY, visible: isVisible };
        }
        
        const transformedPoint = svgPoint.matrixTransform(screenCTM);
        
        // Get container position for relative positioning
        const containerRect = svgElement.parentElement.getBoundingClientRect();
        
        // Calculate screen coordinates relative to the container
        const screenX = transformedPoint.x - containerRect.left;
        const screenY = transformedPoint.y - containerRect.top;
        
        // Check visibility
        const padding = 50;
        const isVisible = screenX >= -padding && screenX <= containerRect.width + padding &&
                         screenY >= -padding && screenY <= containerRect.height + padding;
        
        return { 
            x: screenX, 
            y: screenY, 
            visible: isVisible 
        };
    } catch (error) {
        console.warn('SVG coordinate transformation failed, using fallback:', error);
        
        // Fallback method
        const viewBox = svgElement.viewBox.baseVal;
        const svgRect = svgElement.getBoundingClientRect();
        const scaleX = svgRect.width / viewBox.width;
        const scaleY = svgRect.height / viewBox.height;
        
        const screenX = (svgX - viewBox.x) * scaleX;
        const screenY = (svgY - viewBox.y) * scaleY;
        
        const isVisible = screenX >= -50 && screenX <= svgRect.width + 50 &&
                         screenY >= -50 && screenY <= svgRect.height + 50;
        
        return { x: screenX, y: screenY, visible: isVisible };
    }
}

/**
 * Update position of a single label based on its stored SVG coordinates
 */
function updateLabelPosition(labelElement) {
    const svgX = parseFloat(labelElement.getAttribute('data-svg-x'));
    const svgY = parseFloat(labelElement.getAttribute('data-svg-y'));
    
    const screenCoords = svgToScreenCoordinates(svgX, svgY);
    const labelWidth = parseInt(labelElement.style.width);
    const labelHeight = parseInt(labelElement.style.height);
    
    if (screenCoords.visible) {
        // Show and position the label
        labelElement.style.display = 'flex';
        labelElement.style.left = `${screenCoords.x - labelWidth/2}px`;
        labelElement.style.top = `${screenCoords.y - labelHeight/2}px`;
    } else {
        // Hide labels that are off-screen
        labelElement.style.display = 'none';
    }
}

/**
 * Update all active label positions (called during pan/zoom)
 */
function updateAllLabelPositions() {
    activeLabels.forEach(labelElement => {
        if (labelElement.parentElement) { // Check if still in DOM
            updateLabelPosition(labelElement);
        }
    });
}

/**
 * Clear all district labels
 */
function clearDistrictLabels() {
    const existingLabels = document.querySelectorAll('.district-label-html');
    existingLabels.forEach(label => label.remove());
    activeLabels = [];
}

/**
 * Setup event listeners for map interactions (hover, click)
 */
function setupMapInteractions() {
    if (!svgElement) return;
    
    const paths = svgElement.querySelectorAll('path[data-district-group-id]');
    const tooltip = document.getElementById('tooltip');
    
    paths.forEach(path => {
        const groupId = path.getAttribute('data-district-group-id');
        // Try to match with district data using the same logic as initializeMap
        const district = findDistrictByGroupId(groupId);
        
        if (district) {
            // Mouse enter - show tooltip
            path.addEventListener('mouseenter', function(e) {
                showTooltip(e, district);
            });
            
            // Mouse move - update tooltip position
            path.addEventListener('mousemove', function(e) {
                updateTooltipPosition(e);
            });
            
            // Mouse leave - hide tooltip
            path.addEventListener('mouseleave', function() {
                tooltip.classList.add('hidden');
            });
            
            // Click - show modal or add new tender option
            path.addEventListener('click', function(e) {
                e.stopPropagation();
                showDistrictClickMenu(e, district, groupId);
            });
        } else {
            // Handle empty districts (no backend data)
            // Mouse enter - show basic tooltip
            path.addEventListener('mouseenter', function(e) {
                showEmptyDistrictTooltip(e, groupId);
            });
            
            // Mouse move - update tooltip position
            path.addEventListener('mousemove', function(e) {
                updateTooltipPosition(e);
            });
            
            // Mouse leave - hide tooltip
            path.addEventListener('mouseleave', function() {
                tooltip.classList.add('hidden');
            });
            
            // Click - show add new tender option for empty districts
            path.addEventListener('click', function(e) {
                e.stopPropagation();
                showEmptyDistrictClickMenu(e, groupId);
            });
        }
    });
}

/**
 * Show tooltip with district information based on status
 */
function showTooltip(event, district) {
    const tooltip = document.getElementById('tooltip');
    let content = '';
    
    const provinceName = district.details.province;
    const districtName = district.details.district;
    const competitorName = district.details.competitor_name;
    
    switch (district.status) {
        case 'won':
            const remaining = district.details.cabin_count_total - district.details.cabin_count_full;
            content = `
                <strong>${provinceName} - ${districtName}</strong><br>
                <strong>Kabin Sayısı:</strong> ${district.details.cabin_count_full}/${district.details.cabin_count_total} (${remaining} Boş)<br>
                <strong>Kalan Süre:</strong> ${calculateRemainingTime(district.details.last_meeting_date, district.details.tender_duration)}
            `;
            break;
            
        case 'negotiating':
            content = `
                <strong>${provinceName} - ${districtName}</strong><br>
                <strong>Son Görüşme Tarihi:</strong> ${formatDate(district.details.last_meeting_date)}
            `;
            break;
            
        case 'upcoming':
            content = `
                <strong>${provinceName} - ${districtName}</strong><br>
                <strong>Öngörülen İhale Tarihi:</strong> ${formatDate(district.details.foreseen_tender_date)}
            `;
            break;
            
        case 'lost':
            content = `
                <strong>${provinceName} - ${districtName}</strong><br>
                <strong>Olumsuzluk Sebebi:</strong> ${district.details.reason_for_loss}
            `;
            break;
        case 'competitor':
            content = `
                <strong>${provinceName} - ${districtName}</strong><br>
                <strong>Rakip Firma:</strong> ${competitorName || 'Belirtilmedi'}
            `;
            break;
        case 'terminated':
            content = `
                <strong>${provinceName} - ${districtName}</strong><br>
                <strong>Durum:</strong> Feshedildi
            `;
            break;
    }
    
    tooltip.innerHTML = content;
    tooltip.classList.remove('hidden');
    updateTooltipPosition(event);
}

/**
 * Update tooltip position based on mouse coordinates
 */
function updateTooltipPosition(event) {
    const tooltip = document.getElementById('tooltip');
    const rect = document.body.getBoundingClientRect();
    
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY - 10) + 'px';
}

/**
 * Show district click menu with options to view details or add new tender
 */
function showDistrictClickMenu(event, district, groupId) {
    // Remove any existing menu
    const existingMenu = document.getElementById('district-click-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create menu element
    const menu = document.createElement('div');
    menu.id = 'district-click-menu';
    menu.className = 'fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-48';
    menu.style.left = (event.pageX + 10) + 'px';
    menu.style.top = (event.pageY + 10) + 'px';
    
    let menuContent = '';
    
    if (district) {
        // District has data - show view details and add new tender options
        // If this district already has at least one tender, show Edit instead of Add
        const hasTender = (district.details?.tender_count || 0) > 0;
        menuContent = `
            <div class="p-3 border-b border-gray-100">
                <h3 class="font-semibold text-gray-900">${district.details.province} - ${district.details.district}</h3>
                <p class="text-sm text-gray-600">${district.details.tender_count || 0} ihale kayıtlı</p>
            </div>
            <div class="py-2">
                <button onclick="viewDistrictDetails('${district.districtId}')" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                    Detayları Görüntüle
                </button>
                ${hasTender ? `
                <button onclick="openEditTenderForDistrict('${district.districtId}')" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                    <svg class=\"w-4 h-4 mr-2\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M11 4h2m-1 1v14m7-7H5\"></path></svg>
                    İhaleyi Düzenle
                </button>
                ` : `
                <button onclick=\"addTenderForDistrict('${district.details.province}', '${district.details.district}')\" class=\"w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center\">
                    <svg class=\"w-4 h-4 mr-2\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 6v6m0 0v6m0-6h6m-6 0H6\"></path></svg>
                    Yeni İhale Ekle
                </button>
                `}
            </div>
        `;
    } else {
        // District has no data - show add new tender option only
        const districtName = groupId.split('-')[1] || groupId;
        const provinceName = getProvinceFromDistrictId(groupId);
        
        menuContent = `
            <div class="p-3 border-b border-gray-100">
                <h3 class="font-semibold text-gray-900">${provinceName} - ${districtName}</h3>
                <p class="text-sm text-gray-600">Henüz ihale kaydı yok</p>
            </div>
            <div class="py-2">
                <button onclick="addTenderForDistrict('${provinceName}', '${districtName}')" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    İlk İhaleyi Ekle
                </button>
            </div>
        `;
    }
    
    menu.innerHTML = menuContent;
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
    
    console.log(`📋 District click menu shown for: ${district ? district.details.district : groupId}`);
}

/**
 * Get province name from district ID (simplified mapping)
 */
function getProvinceFromDistrictId(districtId) {
    // Simple mapping based on district ID patterns
    if (districtId.startsWith('01-')) return 'Adana';
    if (districtId.startsWith('06-')) return 'Ankara';
    if (districtId.startsWith('34-')) return 'İstanbul';
    if (districtId.startsWith('35-')) return 'İzmir';
    if (districtId.startsWith('16-')) return 'Bursa';
    // Add more mappings as needed
    return 'Bilinmeyen';
}

/**
 * View district details - wrapper function for showModal
 */
function viewDistrictDetails(districtId) {
    const district = districtData.find(d => d.districtId === districtId);
    if (district) {
        showModal(district);
    }
    // Remove the menu
    const menu = document.getElementById('district-click-menu');
    if (menu) menu.remove();
}

/**
 * Add tender for specific district - pre-fill the form
 */
function addTenderForDistrict(province, district) {
    // If district is empty, open as province-scoped add
    showAddTenderModal(district ? 'district' : 'province');
    
    // Pre-fill the form with district information
    setTimeout(() => {
        const provinceField = document.getElementById('tender-province');
        const districtField = document.getElementById('tender-district');
        
        if (provinceField) provinceField.value = province;
        if (districtField) districtField.value = district;
    }, 100);
    
    // Remove the menu
    const menu = document.getElementById('district-click-menu');
    if (menu) menu.remove();
    
    console.log(`➕ Add tender modal opened for: ${province}/${district}`);
}

/**
 * Show detailed information modal for district with multiple tenders
 */
function showModal(district) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    
    // Get all tenders for this district
    const districtTenders = tendersData.filter(tender => tender.districtId === district.districtId);
    
    modalTitle.textContent = `${district.details.province} - ${district.details.district}`;
    
    let content = `
        <div class="space-y-6">
            <!-- District Summary -->
            <div class="bg-gray-50 p-4 rounded-lg">
                <h3 class="font-semibold text-lg mb-3">Bölge Özeti</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <span class="font-medium text-gray-600">İl:</span>
                        <span class="ml-2">${district.details.province}</span>
                    </div>
                    <div>
                        <span class="font-medium text-gray-600">İlçe:</span>
                        <span class="ml-2">${district.details.district}</span>
                    </div>
                    <div>
                        <span class="font-medium text-gray-600">Toplam İhale Sayısı:</span>
                        <span class="ml-2">${district.details.tender_count}</span>
                    </div>
                    <div>
                        <span class="font-medium text-gray-600">Genel Durum:</span>
                        <span class="inline-block px-2 py-1 rounded text-white text-sm ml-2" style="background-color: ${statusColors[district.status]}">
                            ${getStatusText(district.status)}
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Individual Tenders -->
            <div>
                <h3 class="font-semibold text-lg mb-4">İhaleler (${districtTenders.length})</h3>
                <div class="space-y-4">`;
    
    // Add each tender as a separate card
    districtTenders.forEach((tender, index) => {
        content += `
                    <div class="border border-gray-200 rounded-lg p-4">
                        <div class="flex justify-between items-start mb-3">
                            <h4 class="font-semibold text-lg">${tender.title}</h4>
                            <span class="inline-block px-2 py-1 rounded text-white text-sm" style="background-color: ${statusColors[tender.status]}">
                                ${getStatusText(tender.status)}
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <span class="font-medium text-gray-600">İhale Süresi:</span>
                                <span class="ml-2">${tender.tender_duration}</span>
                            </div>
                            <div>
                                <span class="font-medium text-gray-600">Kira Bedeli:</span>
                                <span class="ml-2">${tender.rental_fee}</span>
                            </div>
                            <div>
                                <span class="font-medium text-gray-600">Toplam Kabin:</span>
                                <span class="ml-2">${tender.cabin_count_total}</span>
                            </div>
                            <div>
                                <span class="font-medium text-gray-600">Dolu Kabin:</span>
                                <span class="ml-2">${tender.cabin_count_full || 0}</span>
                            </div>
                        </div>`;
        
        // Add status-specific information for each tender
        switch (tender.status) {
            case 'won':
                content += `
                        <div class="bg-green-50 p-3 rounded">
                            <div>
                                <span class="font-medium text-gray-600">Son Görüşme:</span>
                                <span class="ml-2">${formatDate(tender.last_meeting_date)}</span>
                            </div>
                        </div>`;
                break;
                
            case 'negotiating':
                content += `
                        <div class="bg-yellow-50 p-3 rounded">
                            <div>
                                <span class="font-medium text-gray-600">Son Görüşme:</span>
                                <span class="ml-2">${formatDate(tender.last_meeting_date)}</span>
                            </div>
                        </div>`;
                break;
                
            case 'upcoming':
                content += `
                        <div class="bg-orange-50 p-3 rounded">
                            <div>
                                <span class="font-medium text-gray-600">Öngörülen İhale Tarihi:</span>
                                <span class="ml-2">${formatDate(tender.foreseen_tender_date)}</span>
                            </div>
                        </div>`;
                break;
                
            case 'lost':
                content += `
                        <div class="bg-red-50 p-3 rounded">
                            <div>
                                <span class="font-medium text-gray-600">Kayıp Sebebi:</span>
                                <span class="ml-2">${tender.reason_for_loss}</span>
                            </div>
                        </div>`;
                break;
            case 'competitor':
                content += `
                        <div class="bg-purple-50 p-3 rounded">
                            <div>
                                <span class="font-medium text-gray-600">Rakip Firma:</span>
                                <span class="ml-2">${tender.competitor_name || 'Belirtilmedi'}</span>
                            </div>
                        </div>`;
                break;
            case 'terminated':
                content += `
                        <div class="bg-gray-100 p-3 rounded">
                            <div>
                                <span class="font-medium text-gray-600">Durum:</span>
                                <span class="ml-2">Feshedildi</span>
                            </div>
                        </div>`;
                break;
        }
        
        content += `
                        <div class="mt-3">
                            <span class="font-medium text-gray-600">Notlar:</span>
                            <p class="text-gray-700 mt-1">${tender.meeting_notes}</p>
                        </div>
                    </div>`;
    });
    
    content += `
                </div>
            </div>
        </div>
    `;
    
    modalContent.innerHTML = content;
    modal.classList.remove('hidden');
}

/**
 * Setup event listeners for UI interactions
 */
function setupEventListeners() {
    // Filter buttons
    document.getElementById('filter-all').addEventListener('click', () => filterDistricts('all'));
    document.getElementById('filter-won').addEventListener('click', () => filterDistricts('won'));
    document.getElementById('filter-negotiating').addEventListener('click', () => filterDistricts('negotiating'));
    document.getElementById('filter-upcoming').addEventListener('click', () => filterDistricts('upcoming'));
    document.getElementById('filter-lost').addEventListener('click', () => filterDistricts('lost'));
    
    // Toggle buttons
    const btnDistrict = document.getElementById('toggle-district');
    const btnProvince = document.getElementById('toggle-province');
    if (btnDistrict && btnProvince) {
        const setActive = () => {
            if (currentMapLevel === 'district') {
                btnDistrict.classList.add('bg-gray-800','text-white');
                btnDistrict.classList.remove('bg-white','text-gray-800');
                btnProvince.classList.add('bg-white','text-gray-800');
                btnProvince.classList.remove('bg-gray-800','text-white');
            } else {
                btnProvince.classList.add('bg-gray-800','text-white');
                btnProvince.classList.remove('bg-white','text-gray-800');
                btnDistrict.classList.add('bg-white','text-gray-800');
                btnDistrict.classList.remove('bg-gray-800','text-white');
            }
        };
        btnDistrict.addEventListener('click', async () => {
            if (currentMapLevel !== 'district') {
                currentMapLevel = 'district';
                setActive();
                await loadSVGMap();
                // Re-apply current filter
                filterDistricts(currentFilter);
            }
        });
        btnProvince.addEventListener('click', async () => {
            if (currentMapLevel !== 'province') {
                currentMapLevel = 'province';
                setActive();
                await loadSVGMap();
                filterDistricts(currentFilter);
            }
        });
        setActive();
    }
    
    // Show/hide competitor name input based on status
    const statusSelect = document.getElementById('tender-status');
    const competitorWrapper = document.getElementById('competitor-name-wrapper');
    if (statusSelect && competitorWrapper) {
        const refreshCompetitor = () => {
            if (statusSelect.value === 'competitor') {
                competitorWrapper.classList.remove('hidden');
            } else {
                competitorWrapper.classList.add('hidden');
            }
        };
        statusSelect.addEventListener('change', refreshCompetitor);
        refreshCompetitor();
    }
    
    // Modal close (exists in demo.html). In index.html close button uses inline onclick.
    const modalCloseBtn = document.getElementById('modal-close');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }
    document.getElementById('modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
    
    // Escape key to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

/**
 * Filter districts by status
 */
function filterDistricts(status) {
    if (!svgElement) return;
    
    currentFilter = status;
    
    // Update active filter button
    document.querySelectorAll('[id^="filter-"]').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-blue-300');
    });
    const activeBtn = document.getElementById(`filter-${status}`);
    if (activeBtn) activeBtn.classList.add('ring-2', 'ring-blue-300');
    
    if (currentMapLevel === 'district') {
        const paths = svgElement.querySelectorAll('path[data-district-group-id]');
        paths.forEach(path => {
            const groupId = path.getAttribute('data-district-group-id');
            const district = findDistrictByGroupId(groupId);
            if (status === 'all') {
                path.style.opacity = '1';
            } else if (district && district.status === status) {
                path.style.opacity = '1';
            } else {
                path.style.opacity = '0.2';
            }
        });
    } else {
        const groups = svgElement.querySelectorAll('g.province-group');
        groups.forEach(group => {
            const provinceName = group.getAttribute('data-province-name') || group.getAttribute('title') || group.getAttribute('id');
            const agg = getProvinceAggregatedStatus(provinceName);
            if (status === 'all') {
                group.style.opacity = '1';
            } else if (agg === status) {
                group.style.opacity = '1';
            } else {
                group.style.opacity = '0.2';
            }
        });
    }
}

/**
 * Add dynamic text labels for districts
 */
function addDistrictLabels() {
    if (!svgElement) return;
    
    const paths = svgElement.querySelectorAll('path[data-district-group-id]');
    
    paths.forEach(path => {
        const groupId = path.getAttribute('data-district-group-id');
        // Try to match with district data using the same logic as other functions
        const district = findDistrictByGroupId(groupId);
        
        if (district) {
            // Calculate path centroid
            const bbox = path.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            
            // Create text element
            const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('x', centerX);
            textElement.setAttribute('y', centerY);
            textElement.setAttribute('class', 'district-label');
            textElement.textContent = district.details.district;
            
            // Add to SVG
            svgElement.appendChild(textElement);
        }
    });
}

/**
 * Close modal
 */
function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

/**
 * Helper function to get status text in Turkish
 */
function getStatusText(status) {
    const statusTexts = {
        won: 'Alınan',
        negotiating: 'Görüşmesi Devam Eden',
        upcoming: 'İhaleye Çıkacak',
        lost: 'Olumsuz',
        competitor: 'Rakip Firma',
        terminated: 'Feshedildi'
    };
    return statusTexts[status] || status;
}

/**
 * Helper function to format date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
}

/**
 * Helper function to calculate remaining time
 */
function calculateRemainingTime(startDate, duration) {
    if (!startDate || !duration) return 'Bilinmiyor';
    const start = new Date(startDate);
    const durationMonths = parseInt(String(duration).split(' ')[0]) || 0;
    const endDate = new Date(start.setMonth(start.getMonth() + durationMonths));
    const now = new Date();
    const remaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24 * 30));
    
    if (remaining > 0) {
        return `${remaining} ay`;
    } else {
        return 'Süresi dolmuş';
    }
}

/**
 * Show add tender modal
 */
function showAddTenderModal(scope = 'district') {
    const modal = document.getElementById('add-tender-modal');
    modal.classList.remove('hidden');
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tender-date').value = today;
    
    // Make district input optional when adding on province scope
    const districtInput = document.getElementById('tender-district');
    if (districtInput) {
        if (scope === 'province') {
            districtInput.removeAttribute('required');
            districtInput.placeholder = 'İl bazlı kayıt (opsiyonel)';
        } else {
            districtInput.setAttribute('required', 'true');
            districtInput.placeholder = 'Örn: Maltepe';
        }
    }
    
    console.log('🎯 Add tender modal opened');
}

/**
 * Close add tender modal
 */
function closeAddTenderModal() {
    const modal = document.getElementById('add-tender-modal');
    modal.classList.add('hidden');
    
    // Reset form
    document.getElementById('add-tender-form').reset();
    
    // Restore district field to required by default
    const districtInput = document.getElementById('tender-district');
    if (districtInput) {
        districtInput.setAttribute('required', 'true');
        districtInput.placeholder = 'Örn: Maltepe';
    }
    
    console.log('❌ Add tender modal closed');
}

/**
 * Handle add tender form submission
 */
async function handleAddTenderSubmit(event) {
    event.preventDefault();
    
    console.log('📝 Processing new tender submission...');
    
    // Get form values
    const province = document.getElementById('tender-province').value;
    const district = document.getElementById('tender-district').value || '';
    const value = parseInt(document.getElementById('tender-value').value);
    const date = document.getElementById('tender-date').value;
    const description = document.getElementById('tender-description').value || 'Yeni ihale kaydı';
    const competitorName = document.getElementById('tender-competitor-name')?.value || '';
    const status = document.getElementById('tender-status').value;
    
    // Generate a district ID - in real implementation this should match SVG data
    const districtId = Math.floor(Math.random() * 10000).toString();
    
    const formData = {
        districtId: districtId,
        status: status,
        province: province,
        district: district || province,
        title: `${district || province} İhale Projesi`,
        tender_duration: "24 ay", // Default duration
        cabin_count_total: Math.floor(value / 1000), // Estimate based on value
        cabin_count_full: 0,
        rental_fee: `₺${value.toLocaleString()}/ay`,
        meeting_notes: description,
        ...(status === 'competitor' ? { competitor_name: competitorName } : {})
    };
    
    // Add status-specific fields
    if (status === 'upcoming') {
        formData.foreseen_tender_date = date;
    } else {
        formData.last_meeting_date = date;
    }
    
    console.log('📊 Tender data:', formData);
    
    try {
        const response = await fetch(`${API_BASE_URL}/tenders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Success - reload data and update map
            console.log('✅ Tender added successfully, reloading data...');
            await fetchTendersData();
            await fetchDistrictsData();
            await loadSVGMap();
            closeAddTenderModal();
            
            // Show success message
            alert(`✅ Yeni ihale başarıyla eklendi: ${province}/${district}`);
        } else {
            throw new Error(result.message || 'İhale eklenirken hata oluştu');
        }
    } catch (error) {
        console.error('Error adding tender:', error);
        alert('❌ İhale eklenirken hata oluştu. Lütfen tekrar deneyin.');
    }
}

// Make functions globally available
window.showAddTenderModal = showAddTenderModal;
window.closeAddTenderModal = closeAddTenderModal;
window.openEditTenderForDistrict = openEditTenderForDistrict;
window.openEditTenderForProvince = openEditTenderForProvince;

// Initialize modal event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Setting up modal event listeners...');
    
    const addTenderForm = document.getElementById('add-tender-form');
    if (addTenderForm) {
        addTenderForm.addEventListener('submit', handleAddTenderSubmit);
        console.log('📝 Add tender form event listener attached');
    }
    const editTenderForm = document.getElementById('edit-tender-form');
    if (editTenderForm) {
        editTenderForm.addEventListener('submit', handleEditTenderSubmit);
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('add-tender-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeAddTenderModal();
            }
        });
    }
    
    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('add-tender-modal');
            if (modal && !modal.classList.contains('hidden')) {
                closeAddTenderModal();
            }
        }
    });
});

/**
 * Show tooltip for empty districts (no backend data)
 */
function showEmptyDistrictTooltip(event, groupId) {
    const tooltip = document.getElementById('tooltip');
    const districtName = groupId.split('-')[1] || groupId;
    
    const content = `
        <strong>${districtName}</strong><br>
        <span class="text-gray-500">Henüz ihale verisi yok</span><br>
        <span class="text-sm text-blue-600">Tıklayarak yeni ihale ekleyebilirsiniz</span>
    `;
    
    tooltip.innerHTML = content;
    tooltip.classList.remove('hidden');
    updateTooltipPosition(event);
}

/**
 * Show click menu for empty districts
 */
function showEmptyDistrictClickMenu(event, groupId) {
    const districtName = groupId.split('-')[1] || groupId;
    
    // Remove any existing context menus
    const existingMenu = document.querySelector('.district-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'district-context-menu';
    menu.style.position = 'absolute';
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
    menu.style.backgroundColor = 'white';
    menu.style.border = '1px solid #d1d5db';
    menu.style.borderRadius = '8px';
    menu.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    menu.style.zIndex = '1001';
    menu.style.minWidth = '200px';
    menu.style.padding = '8px';
    
    menu.innerHTML = `
        <div class="text-sm font-medium text-gray-700 mb-2 px-2 py-1">
            ${districtName}
        </div>
        <button class="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded" 
                onclick="openAddTenderForDistrict('${groupId}'); this.parentElement.remove();">
            🆕 İlk ihaleyı ekle
        </button>
    `;
    
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

/**
 * Open add tender modal for a specific district
 */
function openAddTenderForDistrict(groupId) {
    const districtName = groupId.split('-')[1] || groupId;
    const provinceName = extractProvinceFromGroupId(groupId);
    
    // Show the add tender modal
    showAddTenderModal();
    
    // Pre-fill the form with district information
    setTimeout(() => {
        const provinceSelect = document.getElementById('tender-province');
        const districtSelect = document.getElementById('tender-district');
        
        if (provinceSelect && provinceName) {
            provinceSelect.value = provinceName;
        }
        
        if (districtSelect && districtName) {
            districtSelect.value = districtName;
        }
    }, 100);
}

/**
 * Open edit modal for a district's latest tender
 */
function openEditTenderForDistrict(districtId) {
    // Find latest tender for the district
    const districtTenders = tendersData
        .filter(t => t.districtId === districtId)
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    if (districtTenders.length === 0) return;
    const tender = districtTenders[0];
    populateAndShowEditModal(tender);
}

/**
 * Open edit modal for a province-level record (pick latest tender in province)
 */
function openEditTenderForProvince(provinceName) {
    const items = tendersData
        .filter(t => normalizeName(t.province) === normalizeName(provinceName))
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    if (items.length === 0) return;
    populateAndShowEditModal(items[0]);
}

function populateAndShowEditModal(tender) {
    const modal = document.getElementById('edit-tender-modal');
    if (!modal) return;
    document.getElementById('edit-province').value = tender.province || '';
    document.getElementById('edit-district').value = tender.district || '';
    document.getElementById('edit-status').value = tender.status || '';
    document.getElementById('edit-duration').value = tender.tender_duration || '';
    document.getElementById('edit-rent').value = tender.rental_fee || '';
    document.getElementById('edit-cabin-total').value = tender.cabin_count_total || 0;
    document.getElementById('edit-cabin-full').value = tender.cabin_count_full || 0;
    document.getElementById('edit-date').value = (tender.last_meeting_date || tender.foreseen_tender_date || '').split('T')[0] || '';
    document.getElementById('edit-notes').value = tender.meeting_notes || '';
    const compWrap = document.getElementById('edit-competitor-wrapper');
    if (compWrap) {
        if (tender.status === 'competitor') {
            compWrap.classList.remove('hidden');
            const comp = document.getElementById('edit-competitor-name');
            if (comp) comp.value = tender.competitor_name || '';
        } else {
            compWrap.classList.add('hidden');
        }
    }
    modal.dataset.tenderId = tender.id;
    modal.classList.remove('hidden');
}

function closeEditTenderModal() {
    const modal = document.getElementById('edit-tender-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleEditTenderSubmit(event) {
    event.preventDefault();
    const modal = document.getElementById('edit-tender-modal');
    const tenderId = modal?.dataset.tenderId;
    if (!tenderId) return;
    const payload = {
        province: document.getElementById('edit-province').value,
        district: document.getElementById('edit-district').value,
        status: document.getElementById('edit-status').value,
        tender_duration: document.getElementById('edit-duration').value,
        rental_fee: document.getElementById('edit-rent').value,
        cabin_count_total: parseInt(document.getElementById('edit-cabin-total').value || '0'),
        cabin_count_full: parseInt(document.getElementById('edit-cabin-full').value || '0'),
        meeting_notes: document.getElementById('edit-notes').value
    };
    if (payload.status === 'upcoming') {
        payload.foreseen_tender_date = document.getElementById('edit-date').value;
    } else {
        payload.last_meeting_date = document.getElementById('edit-date').value;
    }
    if (payload.status === 'competitor') {
        payload.competitor_name = document.getElementById('edit-competitor-name').value;
    }
    try {
        const res = await fetch(`${API_BASE_URL}/tenders/${tenderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.message || 'Güncelleme hatası');
        await fetchTendersData();
        await fetchDistrictsData();
        await loadSVGMap();
        closeEditTenderModal();
    } catch (e) {
        console.error('Edit error:', e);
        alert('❌ Güncellenemedi.');
    }
}

/**
 * Extract province name from group ID
 */
function extractProvinceFromGroupId(groupId) {
    // Map common province codes to names
    const provinceMap = {
        '01': 'Adana',
        '06': 'Ankara', 
        '07': 'Antalya',
        '16': 'Bursa',
        '34': 'İstanbul',
        '35': 'İzmir',
        '41': 'Kocaeli'
    };
    
    const code = groupId.split('-')[0];
    return provinceMap[code] || 'Bilinmiyor';
}
