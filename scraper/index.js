#!/usr/bin/env node
/**
 * FOMOff Event Scraper
 * Busca eventos en múltiples fuentes y actualiza events.json
 */

const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, '../data/events.json');
const SOURCES_FILE = path.join(__dirname, 'sources.json');

// Load current events
function loadEvents() {
    try {
        return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
    } catch (e) {
        console.error('Error loading events:', e.message);
        return { events: [], cities: {}, categories: {} };
    }
}

// Save events
function saveEvents(data) {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ Saved ${data.events.length} events`);
}

// Generate unique ID for event
function generateId(event) {
    const str = `${event.name}-${event.date}-${event.city}`;
    return Buffer.from(str).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
}

// Check if event already exists
function eventExists(events, newEvent) {
    return events.some(e => 
        e.name.toLowerCase() === newEvent.name.toLowerCase() &&
        e.date === newEvent.date &&
        e.city === newEvent.city
    );
}

// Add event if not duplicate
function addEvent(eventsData, newEvent) {
    if (!eventExists(eventsData.events, newEvent)) {
        newEvent.id = generateId(newEvent);
        newEvent.addedAt = new Date().toISOString();
        eventsData.events.push(newEvent);
        console.log(`  + Added: ${newEvent.name} (${newEvent.date})`);
        return true;
    }
    return false;
}

// Parse date from various formats
function parseDate(dateStr) {
    // Handle common Spanish date formats
    const months = {
        'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
        'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
        'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
    };
    
    // Try ISO format first
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }
    
    // Try "14 de febrero 2026" or "14 feb 2026"
    const match = dateStr.toLowerCase().match(/(\d{1,2})\s*(?:de\s*)?(\w+)\s*(\d{4})?/);
    if (match) {
        const day = match[1].padStart(2, '0');
        const month = months[match[2]] || '01';
        const year = match[3] || '2026';
        return `${year}-${month}-${day}`;
    }
    
    return null;
}

// Scraper implementations
const scrapers = {
    // Manual events (from sources.json or CLI input)
    async manual(config, eventsData) {
        console.log('📝 Processing manual events...');
        // Manual events are added via CLI or direct JSON editing
        return 0;
    },
    
    // Web scraper placeholder - will be implemented with specific parsers
    async web(source, eventsData) {
        console.log(`🌐 Scraping: ${source.name}...`);
        // This would use fetch + cheerio or similar
        // For now, return 0 new events
        console.log('   (Web scraping requires specific parser per source)');
        return 0;
    }
};

// Main scraper function
async function runScraper(options = {}) {
    console.log('🎭 FOMOff Scraper starting...\n');
    
    const eventsData = loadEvents();
    const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf-8'));
    
    let totalAdded = 0;
    
    // Process web sources
    for (const source of sources.sources.filter(s => s.enabled)) {
        try {
            const added = await scrapers.web(source, eventsData);
            totalAdded += added;
        } catch (e) {
            console.error(`  ❌ Error scraping ${source.name}:`, e.message);
        }
    }
    
    // Save if we added anything
    if (totalAdded > 0 || options.force) {
        saveEvents(eventsData);
    }
    
    console.log(`\n✨ Scraper complete. Added ${totalAdded} new events.`);
    return totalAdded;
}

// CLI: Add event manually
function addManualEvent(args) {
    const eventsData = loadEvents();
    
    const event = {
        name: args.name,
        description: args.description || '',
        city: args.city || 'barranquilla',
        venue: args.venue || 'Por confirmar',
        date: parseDate(args.date) || args.date,
        startTime: args.start || '18:00',
        endTime: args.end || '23:00',
        category: args.category || 'fiesta',
        official: false,
        price: args.price || null,
        source: 'manual',
        url: args.url || null
    };
    
    if (addEvent(eventsData, event)) {
        saveEvents(eventsData);
        console.log('✅ Event added successfully!');
    } else {
        console.log('⚠️ Event already exists');
    }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'run':
        runScraper({ force: args.includes('--force') });
        break;
    
    case 'add':
        // Parse --key=value args
        const eventArgs = {};
        args.slice(1).forEach(arg => {
            const match = arg.match(/--(\w+)=(.+)/);
            if (match) eventArgs[match[1]] = match[2];
        });
        
        if (!eventArgs.name || !eventArgs.date) {
            console.log('Usage: node scraper/index.js add --name="Event Name" --date="2026-02-14" [--city=barranquilla] [--venue="Lugar"] [--start=18:00] [--end=23:00] [--category=fiesta] [--price="$50,000"] [--url=https://...]');
            process.exit(1);
        }
        addManualEvent(eventArgs);
        break;
    
    case 'list':
        const data = loadEvents();
        console.log(`\n📅 ${data.events.length} events:\n`);
        data.events
            .sort((a, b) => a.date.localeCompare(b.date))
            .forEach(e => {
                console.log(`  ${e.date} | ${e.city.padEnd(12)} | ${e.name}`);
            });
        break;
    
    default:
        console.log(`
🎭 FOMOff Scraper

Commands:
  run [--force]     Run all scrapers
  add --name=X ...  Add event manually
  list              List all events

Examples:
  node scraper/index.js run
  node scraper/index.js add --name="Fiesta Blanca" --date="2026-02-14" --city=barranquilla --venue="Hotel X" --price="$80,000"
  node scraper/index.js list
`);
}

module.exports = { runScraper, addManualEvent, addEvent, loadEvents, saveEvents };
