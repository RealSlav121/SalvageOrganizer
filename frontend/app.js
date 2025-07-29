// DOM Elements
let lotUrlInput, addLotBtn, tabBtns, tabPanes, modal, closeBtn, lotDetailsContainer, 
    soonLotsContainer, futureLotsContainer, recentLotsContainer, loadingOverlay;

// State
let lots = JSON.parse(localStorage.getItem('salvageLots')) || [];
const API_BASE_URL = 'http://localhost:5001';

// Show loading overlay
function showLoading(show) {
  loadingOverlay.style.display = show ? 'flex' : 'none';
  if (show) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

// Refresh all lots with latest data from the server
async function refreshAllLots() {
  if (lots.length === 0) return;
  
  showLoading(true);
  showToast('Refreshing lots data...', 'info');
  
  try {
    // Create an array of fetch promises for all lots
    const refreshPromises = lots.map(async (lot, index) => {
      try {
        const response = await fetch(`${API_BASE_URL}/lot/${lot.lotNumber}`);
        if (!response.ok) throw new Error(`Failed to fetch lot ${lot.lotNumber}`);
        
        const updatedLot = await response.json();
        
        // Preserve the favorite status and any other important data
        updatedLot.isFavorite = lot.isFavorite || false;
        
        // Update the lot in the array
        return { index, lot: updatedLot };
      } catch (error) {
        console.error(`Error refreshing lot ${lot.lotNumber}:`, error);
        return { index, lot };
      }
    });
    
    // Wait for all refreshes to complete
    const results = await Promise.all(refreshPromises);
    
    // Update the lots array with the refreshed data
    results.forEach(({ index, lot }) => {
      if (lot) {
        lots[index] = lot;
      }
    });
    
    // Save the updated lots and re-render
    saveLots();
    renderLots();
    showToast('Lots data refreshed successfully!', 'success');
  } catch (error) {
    console.error('Error refreshing lots:', error);
    showToast('Error refreshing lots. Please try again.', 'error');
  } finally {
    showLoading(false);
  }
}

// Initialize the app
async function init() {
  try {
    // Initialize DOM references
    lotUrlInput = document.getElementById('lotUrlInput');
    addLotBtn = document.getElementById('addLotBtn');
    tabBtns = document.querySelectorAll('.tab-btn');
    tabPanes = document.querySelectorAll('.tab-pane');
    modal = document.getElementById('lotModal');
    closeBtn = document.querySelector('.close-btn');
    lotDetailsContainer = document.getElementById('lotDetails');
    soonLotsContainer = document.getElementById('soonLots');
    futureLotsContainer = document.getElementById('futureLots');
    recentLotsContainer = document.getElementById('recentLots');
    loadingOverlay = document.getElementById('loadingOverlay');

    // Verify all required elements exist
    const requiredElements = {
      lotUrlInput, addLotBtn, modal, closeBtn, lotDetailsContainer,
      soonLotsContainer, futureLotsContainer, recentLotsContainer, loadingOverlay
    };

    for (const [name, element] of Object.entries(requiredElements)) {
      if (!element) {
        throw new Error(`Required element not found: ${name}`);
      }
    }

    // First render with existing data for a quick display
    renderLots();
    setupEventListeners();
    checkForExpiredLots();
    
    // Then refresh all lots in the background
    await refreshAllLots();
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Error initializing application', 'error');
    throw error;
  }
}

// Set up event listeners
function setupEventListeners() {
  // Add lot button click
  addLotBtn.addEventListener('click', handleAddLot);
  
  // Handle Enter key in input
  lotUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddLot();
  });
  
  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
  
  // Close modal
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
}

// Handle adding a new lot
async function handleAddLot() {
  const input = lotUrlInput.value.trim();
  if (!input) {
    showToast('Please enter a Copart lot URL or lot number', 'error');
    return;
  }
  
  // Extract lot number
  let lotNumber = input;
  const urlMatch = input.match(/copart\.com\/lot\/(\d+)/i);
  if (urlMatch && urlMatch[1]) lotNumber = urlMatch[1];
  
  // Check if lot exists
  if (lots.some(lot => lot.lotNumber === lotNumber)) {
    showToast('This lot is already in your organizer', 'warning');
    return;
  }
  
  // Show loading state
  addLotBtn.disabled = true;
  addLotBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
  
  try {
    // Fetch lot data
    const response = await fetch(`${API_BASE_URL}/lot/${lotNumber}`);
    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error || 'Failed to fetch lot data');
    
    // Add metadata
    const lotWithMetadata = {
      ...data,
      addedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isFavorite: false,
      notes: ''
    };
    
    // Add to array and save
    lots.unshift(lotWithMetadata);
    saveLots();
    
    // Update UI
    lotUrlInput.value = '';
    showToast('Lot added successfully!', 'success');
    renderLots();
    
  } catch (error) {
    console.error('Error adding lot:', error);
    showToast(error.message || 'Failed to add lot. Please try again.', 'error');
  } finally {
    addLotBtn.disabled = false;
    addLotBtn.innerHTML = '<i class="fas fa-plus"></i> Add Lot';
  }
}

// Render all lots
function renderLots() {
  // Ensure containers exist before using them
  const containers = [
    { name: 'soonLotsContainer', element: soonLotsContainer },
    { name: 'futureLotsContainer', element: futureLotsContainer },
    { name: 'recentLotsContainer', element: recentLotsContainer }
  ];

  // Clear containers if they exist
  containers.forEach(({ name, element }) => {
    if (!element) {
      console.error(`Container ${name} is not initialized`);
      return;
    }
    element.innerHTML = '';
  });
  
  if (lots.length === 0) {
    if (soonLotsContainer) {
      soonLotsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-car-crash"></i>
          <p>No lots added yet. Add a Copart lot to get started!</p>
        </div>
      `;
    } else {
      console.error('soonLotsContainer is not initialized');
    }
    return;
  }
  
  // Sort lots
  const sortedLots = [...lots].sort((a, b) => {
    const dateA = a.saleDate ? new Date(a.saleDate) : new Date(0);
    const dateB = b.saleDate ? new Date(b.saleDate) : new Date(0);
    return dateA - dateB;
  });
  
  // Categorize lots
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  sortedLots.forEach(lot => {
    const saleDate = lot.saleDate ? new Date(lot.saleDate) : null;
    const lotElement = createLotCard(lot);
    
    // Get today's date for comparison (ignoring time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if the sale date is today (ignoring time)
    const saleDateOnly = saleDate ? new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate()) : null;
    const isToday = saleDateOnly && saleDateOnly.getTime() === today.getTime();
    
    // 1. Check if the lot is sold or has a past sale date
    if (lot.saleStatus === 'SOLD' || (saleDate && saleDate < now)) {
      lot.saleStatus = 'SOLD';
      recentLotsContainer.appendChild(lotElement);
      return;
    }
    
    // 2. Check for today's date - these are "Now Playing"
    if (isToday) {
      lot.saleStatus = 'NOW_PLAYING';
      const statusElement = lotElement.querySelector('.lot-status');
      if (statusElement) {
        statusElement.textContent = 'Now Playing';
        statusElement.className = 'lot-status status-live';
      }
      soonLotsContainer.appendChild(lotElement);
      return;
    }
    
    // 3. If there's any sale date in the future, it's a "Future Lot"
    if (saleDate && saleDate > now) {
      lot.saleStatus = 'FUTURE';
      const statusElement = lotElement.querySelector('.lot-status');
      if (statusElement) {
        statusElement.textContent = 'Future Lot';
        statusElement.className = 'lot-status status-upcoming';
      }
      futureLotsContainer.appendChild(lotElement);
      return;
    }
    
    // 4. If we have an explicit status from the backend
    if (lot.saleStatus === 'NOW_PLAYING') {
      soonLotsContainer.appendChild(lotElement);
      return;
    }
    
    // 5. All other lots (no sale date or unknown status) go to future
    futureLotsContainer.appendChild(lotElement);
  });
  
  // Setup empty states
  setupEmptyState(soonLotsContainer, 'play-circle', 'No lots playing soon');
  setupEmptyState(futureLotsContainer, 'clock', 'No future lots yet');
  setupEmptyState(recentLotsContainer, 'history', 'No sold or recently played lots');
  
  // Set up event listeners for the new lot cards
  setupLotCardEventListeners();
}

// Create a lot card element
function createLotCard(lot) {
  const saleDate = lot.saleDate ? new Date(lot.saleDate) : null;
  const now = new Date();
  const saleDateObj = saleDate ? new Date(saleDate) : null;
  const isUpcoming = saleDateObj && saleDateObj > now;
  const isSold = lot.saleStatus === 'SOLD' || (saleDateObj && saleDateObj < now);
  
  // Format sale date safely
  let saleDateStr = 'No date available';
  if (saleDateObj) {
    try {
      saleDateStr = `Sale: ${saleDateObj.toLocaleDateString()} at ${saleDateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    } catch (e) {
      console.error('Error formatting date:', e);
    }
  }
  
  // Format odometer safely
  let odometer = 'N/A';
  if (lot.odometer && lot.odometer.value !== null && lot.odometer.value !== undefined) {
    try {
      odometer = `${Number(lot.odometer.value).toLocaleString()} ${lot.odometer.unit || ''}`.trim();
    } catch (e) {
      console.error('Error formatting odometer:', e);
    }
  }
  
  // Determine status
  let statusText, statusClass;
  if (isSold) {
    statusText = 'Sold';
    statusClass = 'status-sold';
  } else if (isUpcoming) {
    statusText = lot.saleStatus === 'LIVE' ? 'Live Now' : 'Upcoming';
    statusClass = lot.saleStatus === 'LIVE' ? 'status-live' : 'status-upcoming';
  } else {
    statusText = 'Future';
    statusClass = 'status-upcoming';
  }
  
  // Create card
  const card = document.createElement('div');
  card.className = 'lot-card';
  card.setAttribute('data-lot-number', lot.lotNumber);
  
  card.innerHTML = `
    <img src="${lot.imageUrl || 'https://via.placeholder.com/300x180?text=No+Image'}" 
         alt="${lot.title || 'Vehicle'}" 
         class="lot-image" 
         onerror="this.src='https://via.placeholder.com/300x180?text=Image+Not+Available';">
    <div class="lot-details">
      <div class="lot-header">
        <h3 class="lot-title">${lot.year} ${lot.make} ${lot.model}</h3>
        <div class="lot-meta">
          <span><i class="fas fa-hashtag"></i> ${lot.lotNumber}</span>
          <span><i class="fas fa-tachometer-alt"></i> ${odometer}</span>
        </div>
      </div>
      
      <div class="lot-stats">
        <div class="stat-item">
          <span class="stat-label">Damage</span>
          <span class="stat-value">${lot.primaryDamage || 'N/A'}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Location</span>
          <span class="stat-value">${lot.location || 'N/A'}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Sale Date</span>
          <span class="stat-value">${saleDate ? saleDate.toLocaleDateString() : 'N/A'}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Current Bid</span>
          <span class="stat-value">${lot.currentBid ? `$${lot.currentBid.toLocaleString()}` : 'N/A'}</span>
        </div>
      </div>
      
      <div class="lot-footer">
        <span class="lot-status ${statusClass}">${statusText}</span>
        <div class="lot-actions">
          <button class="btn btn-sm btn-outline view-details" data-lot-number="${lot.lotNumber}" title="View on Copart">
            <i class="fas fa-external-link-alt"></i> Visit
          </button>
          <button class="btn btn-sm btn-danger remove-lot" data-lot-number="${lot.lotNumber}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
  
  return card;
}

// Helper function to setup empty state
function setupEmptyState(container, icon, message) {
  if (container.children.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-${icon}"></i>
        <p>${message}</p>
      </div>
    `;
  }
}

// Set up event listeners for lot cards
function setupLotCardEventListeners() {
  // Visit Copart lot buttons
  document.querySelectorAll('.view-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const lotNumber = e.currentTarget.getAttribute('data-lot-number');
      const copartUrl = `https://www.copart.com/lot/${lotNumber}`;
      window.open(copartUrl, '_blank');
    });
  });
  
  // Remove lot buttons
  document.querySelectorAll('.remove-lot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lotNumber = e.currentTarget.getAttribute('data-lot-number');
      removeLot(lotNumber);
    });
  });
}

// Show lot details in modal
function showLotDetails(lotNumber) {
  const lot = lots.find(l => l.lotNumber === lotNumber);
  if (!lot) return;
  
  // Format lot data for display
  const saleDate = lot.saleDate ? new Date(lot.saleDate) : null;
  const now = new Date();
  const isUpcoming = saleDate && saleDate > now;
  
  // Create modal content
  let modalContent = `
    <div class="lot-detail-container">
      <div class="lot-detail-header">
        <img src="${lot.imageUrl || 'https://via.placeholder.com/600x400?text=No+Image'}" 
             alt="${lot.title || 'Vehicle'}" 
             class="lot-detail-image"
             onerror="this.src='https://via.placeholder.com/600x400?text=Image+Not+Available';">
        <div class="lot-detail-info">
          <h2>${lot.year} ${lot.make} ${lot.model}</h2>
          <div class="lot-detail-meta">
            <div><strong>Lot #:</strong> ${lot.lotNumber}</div>
            <div><strong>VIN:</strong> ${lot.vin || 'N/A'}</div>
            <div><strong>Location:</strong> ${lot.location || 'N/A'}</div>
            <div><strong>Odometer:</strong> ${lot.odometer ? `${lot.odometer.value.toLocaleString()} ${lot.odometer.unit}` : 'N/A'}</div>
            <div><strong>Primary Damage:</strong> ${lot.primaryDamage || 'N/A'}</div>
            <div><strong>Title Status:</strong> ${lot.titleStatus || 'N/A'}</div>
            <div><strong>Sale Status:</strong> ${lot.saleStatusDescription || 'N/A'}</div>
          </div>
          
          <div class="lot-detail-actions">
            <a href="https://www.copart.com/lot/${lot.lotNumber}" 
               target="_blank" 
               class="btn btn-primary"
               data-uName="viewOnCopart">
              <i class="fas fa-external-link-alt"></i> View on Copart
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Show modal
  lotDetailsContainer.innerHTML = modalContent;
  modal.classList.add('active');
  
  // Add event listener for favorite button
  const favoriteBtn = document.querySelector('.toggle-favorite');
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', () => toggleFavorite(lot.lotNumber));
  }
}

// Toggle favorite status
function toggleFavorite(lotNumber) {
  const lot = lots.find(l => l.lotNumber === lotNumber);
  if (lot) {
    lot.isFavorite = !lot.isFavorite;
    saveLots();
    renderLots();
    
    // Update the favorite button in the modal if it's open
    const favoriteBtn = document.querySelector('.toggle-favorite');
    if (favoriteBtn) {
      favoriteBtn.innerHTML = `
        <i class="${lot.isFavorite ? 'fas' : 'far'} fa-star"></i> 
        ${lot.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
      `;
    }
    
    showToast(
      lot.isFavorite ? 'Added to favorites' : 'Removed from favorites',
      'success'
    );
  }
}

// Remove a lot
function removeLot(lotNumber) {
  if (confirm('Are you sure you want to remove this lot?')) {
    lots = lots.filter(lot => lot.lotNumber !== lotNumber);
    saveLots();
    renderLots();
    showToast('Lot removed', 'success');
  }
}

// Save lots to localStorage
function saveLots() {
  localStorage.setItem('salvageLots', JSON.stringify(lots));
}

// Check for expired lots (older than 5 days)
function checkForExpiredLots() {
  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000));
  
  const initialCount = lots.length;
  lots = lots.filter(lot => {
    const saleDate = lot.saleDate ? new Date(lot.saleDate) : null;
    return !saleDate || saleDate >= fiveDaysAgo;
  });
  
  if (lots.length < initialCount) {
    saveLots();
    renderLots();
  }
}

// Switch between tabs
function switchTab(tabId) {
  // Update active tab button
  tabBtns.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Show active tab content
  tabPanes.forEach(pane => {
    if (pane.id === tabId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast show`;
  
  let icon = 'info-circle';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'exclamation-circle';
  if (type === 'warning') icon = 'exclamation-triangle';
  
  toast.innerHTML = `
    <i class="fas fa-${icon}"></i>
    <div class="toast-message">${message}</div>
  `;
  
  document.body.appendChild(toast);
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Initialize the app when DOM is fully loaded
window.addEventListener('load', () => {
  // Ensure all DOM elements are available
  init().catch(error => {
    console.error('Error initializing app:', error);
    showToast('Failed to initialize the application', 'error');
  });
});
