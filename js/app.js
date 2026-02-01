// FOMOff - Tu Radar Anti-FOMO 🎭

const CARNIVAL_START = new Date('2026-02-14T00:00:00-05:00');
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const WEEKDAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

let eventsData = null;
let savedEvents = JSON.parse(localStorage.getItem('fomoff_saved') || '[]');
let filters = {
    city: 'all',
    category: 'all',
    afterWork: false
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    updateCountdown();
    setInterval(updateCountdown, 60000);
    setupFilters();
    setupModal();
});

// Load events from JSON
async function loadEvents() {
    try {
        const response = await fetch('data/events.json');
        eventsData = await response.json();
        document.getElementById('lastUpdate').textContent = new Date(eventsData.lastUpdated).toLocaleString('es-CO');
        renderEvents();
        renderSavedEvents();
    } catch (error) {
        console.error('Error loading events:', error);
        document.getElementById('eventsList').innerHTML = '<p class="empty-state">Error cargando eventos 😢</p>';
    }
}

// Render events list
function renderEvents() {
    const container = document.getElementById('eventsList');
    let events = [...eventsData.events];
    
    // Apply filters
    if (filters.city !== 'all') {
        events = events.filter(e => e.city === filters.city);
    }
    if (filters.category !== 'all') {
        events = events.filter(e => e.category === filters.category);
    }
    if (filters.afterWork) {
        events = events.filter(e => {
            const hour = parseInt(e.startTime.split(':')[0]);
            return hour >= 17;
        });
    }
    
    // Sort by date
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (events.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay eventos con estos filtros 🔍</p>';
        return;
    }
    
    container.innerHTML = events.map(event => createEventCard(event)).join('');
    
    // Add event listeners
    container.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn')) {
                showEventDetails(card.dataset.id);
            }
        });
    });
    
    container.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSaveEvent(btn.dataset.id);
        });
    });
    
    container.querySelectorAll('.calendar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCalendar(btn.dataset.id);
        });
    });
}

// Create event card HTML
function createEventCard(event) {
    const date = new Date(event.date + 'T12:00:00');
    const city = eventsData.cities[event.city];
    const category = eventsData.categories[event.category];
    const isSaved = savedEvents.includes(event.id);
    const hasConflict = checkConflict(event);
    
    return `
        <div class="event-card ${event.city}" data-id="${event.id}">
            <div class="event-date">
                <span class="day">${date.getDate()}</span>
                <span class="month">${MONTHS_ES[date.getMonth()]}</span>
                <span class="weekday">${WEEKDAYS_ES[date.getDay()]}</span>
            </div>
            <div class="event-info">
                <h3>
                    ${category.emoji} ${event.name}
                    ${hasConflict ? '<span class="conflict-badge">⚠️ Conflicto</span>' : ''}
                </h3>
                <div class="event-meta">
                    <span>${city.emoji} ${city.name}</span>
                    <span>🕐 ${event.startTime}</span>
                    <span>📍 ${event.venue}</span>
                    ${event.price ? `<span>💰 ${event.price}</span>` : ''}
                </div>
            </div>
            <div class="event-actions">
                <button class="action-btn save-btn ${isSaved ? 'saved' : ''}" data-id="${event.id}" title="Guardar">
                    ${isSaved ? '⭐' : '☆'}
                </button>
                <button class="action-btn calendar-btn" data-id="${event.id}" title="Agregar a calendario">
                    📅
                </button>
            </div>
        </div>
    `;
}

// Render saved events
function renderSavedEvents() {
    const container = document.getElementById('myEventsList');
    const events = eventsData.events.filter(e => savedEvents.includes(e.id));
    
    if (events.length === 0) {
        container.className = 'events-list empty';
        container.innerHTML = '<p class="empty-state">Aún no has agregado eventos. ¡Haz clic en ⭐ para guardar!</p>';
        return;
    }
    
    container.className = 'events-list';
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    container.innerHTML = events.map(event => createEventCard(event)).join('');
    
    // Re-add event listeners for saved section
    container.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSaveEvent(btn.dataset.id);
        });
    });
    
    container.querySelectorAll('.calendar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCalendar(btn.dataset.id);
        });
    });
}

// Toggle save event
function toggleSaveEvent(id) {
    const index = savedEvents.indexOf(id);
    if (index > -1) {
        savedEvents.splice(index, 1);
    } else {
        savedEvents.push(id);
    }
    localStorage.setItem('fomoff_saved', JSON.stringify(savedEvents));
    renderEvents();
    renderSavedEvents();
}

// Check for conflicts with saved events
function checkConflict(event) {
    if (!savedEvents.includes(event.id)) return false;
    
    const savedEventsList = eventsData.events.filter(e => 
        savedEvents.includes(e.id) && e.id !== event.id
    );
    
    for (const saved of savedEventsList) {
        if (saved.date === event.date) {
            // Simple time overlap check
            const eventStart = timeToMinutes(event.startTime);
            const eventEnd = timeToMinutes(event.endTime);
            const savedStart = timeToMinutes(saved.startTime);
            const savedEnd = timeToMinutes(saved.endTime);
            
            if (eventStart < savedEnd && eventEnd > savedStart) {
                return true;
            }
        }
    }
    return false;
}

function timeToMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

// Add to Google Calendar
function addToCalendar(id) {
    const event = eventsData.events.find(e => e.id === id);
    if (!event) return;
    
    const startDate = event.date.replace(/-/g, '') + 'T' + event.startTime.replace(':', '') + '00';
    const endDate = event.date.replace(/-/g, '') + 'T' + event.endTime.replace(':', '') + '00';
    
    const city = eventsData.cities[event.city];
    const location = `${event.venue}, ${city.name}, Colombia`;
    
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(location)}&ctz=America/Bogota`;
    
    window.open(url, '_blank');
}

// Show event details modal
function showEventDetails(id) {
    const event = eventsData.events.find(e => e.id === id);
    if (!event) return;
    
    const city = eventsData.cities[event.city];
    const category = eventsData.categories[event.category];
    const date = new Date(event.date + 'T12:00:00');
    
    const modal = document.getElementById('eventModal');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = `
        <h2>${category.emoji} ${event.name}</h2>
        <p style="margin: 1rem 0; color: rgba(255,255,255,0.8);">${event.description}</p>
        <div style="display: grid; gap: 0.5rem; margin: 1.5rem 0;">
            <p><strong>📅 Fecha:</strong> ${WEEKDAYS_ES[date.getDay()]} ${date.getDate()} de ${MONTHS_ES[date.getMonth()]}</p>
            <p><strong>🕐 Hora:</strong> ${event.startTime} - ${event.endTime}</p>
            <p><strong>${city.emoji} Ciudad:</strong> ${city.name} ${city.travelTime > 0 ? `(~${city.travelTime} min desde Santa Marta)` : '(Base)'}</p>
            <p><strong>📍 Lugar:</strong> ${event.venue}</p>
            ${event.price ? `<p><strong>💰 Precio:</strong> ${event.price}</p>` : ''}
            ${event.official ? '<p><strong>✅ Evento oficial</strong></p>' : ''}
        </div>
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
            <button onclick="addToCalendar('${event.id}')" style="flex: 1; padding: 1rem; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 1rem;">
                📅 Agregar a Google Calendar
            </button>
            <button onclick="toggleSaveEvent('${event.id}'); document.getElementById('eventModal').style.display='none';" style="flex: 1; padding: 1rem; background: var(--secondary); color: var(--dark); border: none; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 1rem;">
                ${savedEvents.includes(event.id) ? '⭐ Guardado' : '☆ Guardar'}
            </button>
        </div>
        ${event.url ? `<p style="margin-top: 1rem; text-align: center;"><a href="${event.url}" target="_blank" style="color: var(--accent);">🔗 Más información</a></p>` : ''}
    `;
    
    modal.style.display = 'block';
}

// Setup filters
function setupFilters() {
    document.querySelectorAll('#cityFilter .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#cityFilter .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filters.city = btn.dataset.city;
            renderEvents();
        });
    });
    
    document.querySelectorAll('#categoryFilter .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#categoryFilter .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filters.category = btn.dataset.category;
            renderEvents();
        });
    });
    
    document.getElementById('afterWorkFilter').addEventListener('change', (e) => {
        filters.afterWork = e.target.checked;
        renderEvents();
    });
}

// Setup modal
function setupModal() {
    const modal = document.getElementById('eventModal');
    const close = modal.querySelector('.close');
    
    close.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

// Update countdown
function updateCountdown() {
    const now = new Date();
    const diff = CARNIVAL_START - now;
    
    if (diff <= 0) {
        document.getElementById('countdown').innerHTML = '<span class="countdown-label">🎭 ¡EL CARNAVAL ESTÁ AQUÍ!</span>';
        return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    document.getElementById('days').textContent = days;
    document.getElementById('hours').textContent = hours;
}
