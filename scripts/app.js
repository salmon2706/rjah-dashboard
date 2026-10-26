/**
 * RJAH tablet dashboard.
 * Same layout as Goodwood. Cups are daily counter deltas, clipped to
 * RiverSand's dates at Gobowen.
 */

'use strict';

const FIREBASE_CONFIG = {
    databaseURL: 'https://test-database-8f390-default-rtdb.europe-west1.firebasedatabase.app'
};

const SERIAL_HISTORY = [
    { serial: 'LKK-5925', name: 'RiverSand', startDate: '2026-10-26', endDate: null }
];

const DEVICE = {
    cycleTime: 25,
    waterUsage: 50,
    energyUsage: 0.009
};

const MAX_CYCLES_PER_DAY = 500;
const MILESTONE_TARGET = 100;

const BASELINES = {
    handwash: { water: 1000, energy: 0.08 },
    dishwash: { water: 250, energy: 0.032 }
};

const CLIENT = {
    name: 'RJAH',
    location: 'Gobowen',
    installDate: '26th October 2026'
};

const TIMING = {
    alternationInterval: 10 * 1000,
    cardFlipTimeout: 6000,
    overlayTimeout: 2000
};

const CARD_ASSUMPTIONS = {
    'water-savings': {
        title: 'Assumptions',
        text: 'Handwashing baseline: 1000ml per cup. Dishwasher baseline: 250ml per cup. Compared against instarinse® usage of 50ml per cycle.'
    },
    'energy-savings': {
        title: 'Assumptions',
        text: 'Handwashing baseline: 0.08kWh per cup (hot water heating). Dishwasher baseline: 0.032kWh per cup. Compared against instarinse® usage of 0.009kWh per cycle.'
    }
};

function uniqueSerials() {
    return [...new Set(SERIAL_HISTORY.map((row) => row.serial))];
}

function activeSerial() {
    const live = SERIAL_HISTORY.find((row) => row.endDate === null);
    return live ? live.serial : SERIAL_HISTORY[SERIAL_HISTORY.length - 1].serial;
}

function inRange(dateKey, startDate, endDate) {
    if (dateKey < startDate) return false;
    if (endDate && dateKey > endDate) return false;
    return true;
}

function parseStamp(entry) {
    const raw = entry?.iso8601 || entry?.timestamp_ms || entry?.timestamp;
    if (!raw) return null;

    if (typeof raw === 'number') {
        const ms = raw > 1000000000000 ? raw : raw * 1000;
        const date = new Date(ms);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof raw !== 'string') return null;

    if (raw.includes('T')) {
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const match = raw.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
    if (!match) return null;
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthIndex = months.findIndex((name) => name.toLowerCase() === match[2].toLowerCase());
    if (monthIndex < 0) return null;
    const date = new Date(Number(match[3]), monthIndex, Number(match[1]));
    return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function dailyMaxByDate(entries) {
    const byDate = {};
    entries.forEach((entry) => {
        const stamp = parseStamp(entry);
        const counter = Number(entry?.counter);
        if (!stamp || !Number.isFinite(counter)) return;
        const key = dayKey(stamp);
        if (byDate[key] == null || counter > byDate[key]) byDate[key] = counter;
    });
    return Object.keys(byDate).sort().map((date) => ({ date, counter: byDate[date] }));
}

function cyclesForSerial(days, startDate, endDate) {
    let previous = null;
    let total = 0;
    let lastCounter = 0;

    days.forEach((row) => {
        if (previous == null) {
            previous = row.counter;
            lastCounter = row.counter;
            return;
        }
        const delta = row.counter - previous;
        previous = row.counter;
        lastCounter = row.counter;
        if (delta <= 0 || delta > MAX_CYCLES_PER_DAY) return;
        if (inRange(row.date, startDate, endDate)) total += delta;
    });

    return { total, lastCounter };
}

function getGreeting(name) {
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 18) greeting = 'Good afternoon';
    else if (hour >= 18) greeting = 'Good evening';
    return `${greeting},<br><span class="greeting-name">${name}</span>`;
}

function formatTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function formatDisplayDate() {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
}

class DashboardState {
    constructor() {
        this.siteCycles = 0;
    }

    getTotalCycles() {
        return this.siteCycles;
    }
}

class DashboardUI {
    constructor(state) {
        this.state = state;
        this.comparisonMode = 'handwash';
        this.flipTimers = {};
        this.overlayTimer = null;

        this.elements = {
            metricCups: document.getElementById('metricCups'),
            milestoneRing: document.getElementById('milestoneRing'),
            milestonePercent: document.getElementById('milestonePercent'),
            metricWaterSavings: document.getElementById('metricWaterSavings'),
            waterComparison: document.getElementById('waterComparison'),
            waterSavingsPercent: document.getElementById('waterSavingsPercent'),
            metricEnergySavings: document.getElementById('metricEnergySavings'),
            energyComparison: document.getElementById('energyComparison'),
            energySavingsPercent: document.getElementById('energySavingsPercent'),
            equivBathtubs: document.getElementById('equivBathtubs'),
            equivPhones: document.getElementById('equivPhones'),
            navTime: document.getElementById('navTime'),
            navDate: document.getElementById('navDate'),
            greeting: document.getElementById('greeting'),
            infoOverlay: document.getElementById('infoOverlay'),
            infoContent: document.getElementById('infoContent'),
            productStatusOverlay: document.getElementById('productStatusOverlay')
        };

        this._bindEvents();
        this._setupCardFlips();
        this.render();
        this._startClock();
        this._startAlternating();
        this._renderDeviceList();
    }

    _bindEvents() {
        const dashboard = document.querySelector('.dashboard-column');
        if (dashboard) {
            dashboard.addEventListener('click', (e) => {
                if (document.documentElement.classList.contains('is-tv')) return;
                if (e.target.closest('.comparison-grid')) return;
                if (e.target.closest('.heat')) return;
                if (e.target.closest('.info-overlay')) return;
                this._showInfoOverlay();
            });
        }
        if (this.elements.infoContent) {
            this.elements.infoContent.addEventListener('click', () => this._hideInfoOverlay());
        }
    }

    _setupCardFlips() {
        document.querySelectorAll('.metric-card').forEach((card) => {
            const metric = card.getAttribute('data-metric');
            const assumption = CARD_ASSUMPTIONS[metric];
            if (!assumption) return;
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                if (card.classList.contains('flipped')) {
                    this._flipCardBack(card, metric);
                } else {
                    this._flipCardToAssumptions(card, metric, assumption);
                }
            });
        });
    }

    _flipCardToAssumptions(card, metric, assumption) {
        if (this.flipTimers[metric]) clearTimeout(this.flipTimers[metric]);
        if (!card.dataset.originalContent) card.dataset.originalContent = card.innerHTML;
        card.innerHTML = `<div class="card-content">${card.innerHTML}</div>`;
        card.offsetHeight;
        const contentDiv = card.querySelector('.card-content');
        if (contentDiv) requestAnimationFrame(() => contentDiv.classList.add('fading'));
        setTimeout(() => {
            card.innerHTML = `
                <div class="card-content" style="opacity: 0;">
                    <div class="assumption-content">
                        <div class="assumption-title">${assumption.title}</div>
                        <div class="assumption-text">${assumption.text}</div>
                    </div>
                </div>
            `;
            card.classList.add('flipped');
            card.offsetHeight;
            const next = card.querySelector('.card-content');
            if (next) requestAnimationFrame(() => { next.style.opacity = '1'; });
            this.flipTimers[metric] = setTimeout(() => this._flipCardBack(card, metric), TIMING.cardFlipTimeout);
        }, 300);
    }

    _flipCardBack(card, metric) {
        if (this.flipTimers[metric]) {
            clearTimeout(this.flipTimers[metric]);
            delete this.flipTimers[metric];
        }
        const contentDiv = card.querySelector('.card-content');
        if (contentDiv) requestAnimationFrame(() => contentDiv.classList.add('fading'));
        setTimeout(() => {
            const original = card.dataset.originalContent;
            card.innerHTML = `<div class="card-content" style="opacity: 0;">${original}</div>`;
            card.classList.remove('flipped');
            delete card.dataset.originalContent;
            card.offsetHeight;
            const next = card.querySelector('.card-content');
            if (next) {
                requestAnimationFrame(() => { next.style.opacity = '1'; });
                setTimeout(() => { card.innerHTML = original; }, 350);
            }
        }, 300);
    }

    _showInfoOverlay() {
        if (!this.elements.infoOverlay) return;
        this.elements.infoOverlay.classList.add('active');
        if (this.overlayTimer) clearTimeout(this.overlayTimer);
        this.overlayTimer = setTimeout(() => this._hideInfoOverlay(), TIMING.overlayTimeout);
    }

    _hideInfoOverlay() {
        if (this.overlayTimer) {
            clearTimeout(this.overlayTimer);
            this.overlayTimer = null;
        }
        if (this.elements.infoOverlay) this.elements.infoOverlay.classList.remove('active');
    }

    _renderDeviceList() {
        const overlay = this.elements.productStatusOverlay;
        if (!overlay) return;
        overlay.innerHTML = `
            <div class="device-stats">
                <div class="device-stat-item">
                    <span class="device-stat-label">Install date:</span>
                    <span class="device-stat-value">${CLIENT.installDate}</span>
                </div>
                <div class="device-stat-item">
                    <span class="device-stat-label">Energy per cycle:</span>
                    <span class="device-stat-value">${DEVICE.energyUsage}kWh</span>
                </div>
                <div class="device-stat-item">
                    <span class="device-stat-label">Water per cycle:</span>
                    <span class="device-stat-value">${DEVICE.waterUsage}ml</span>
                </div>
            </div>
        `;
    }

    _startClock() {
        const tick = () => {
            if (this.elements.navTime) this.elements.navTime.textContent = formatTime();
            if (this.elements.navDate) this.elements.navDate.textContent = formatDisplayDate();
            if (this.elements.greeting) this.elements.greeting.innerHTML = getGreeting(CLIENT.name);
        };
        tick();
        setInterval(tick, 1000);
    }

    _startAlternating() {
        setInterval(() => {
            const cards = document.querySelectorAll('.metric-card.alternating');
            cards.forEach((card) => card.classList.add('transitioning'));
            setTimeout(() => {
                this.comparisonMode = this.comparisonMode === 'handwash' ? 'dishwash' : 'handwash';
                this._updateSavingsDisplay();
                this._updateEquivalents(this.state.getTotalCycles());
                requestAnimationFrame(() => {
                    cards.forEach((card) => card.classList.remove('transitioning'));
                });
            }, 350);
        }, TIMING.alternationInterval);
    }

    render() {
        const numCycles = this.state.getTotalCycles();
        if (this.elements.metricCups) {
            this.elements.metricCups.textContent = numCycles.toLocaleString();
        }
        this._updateMilestoneRing(numCycles);
        this._updateSavingsDisplay();
        this._updateEquivalents(numCycles);
    }

    _updateMilestoneRing(numCycles) {
        const percent = Math.max(0, Math.min(Math.round((numCycles / MILESTONE_TARGET) * 100), 100));
        if (this.elements.milestoneRing) {
            const circumference = 2 * Math.PI * 52;
            this.elements.milestoneRing.style.strokeDashoffset = circumference - (percent / 100) * circumference;
        }
        if (this.elements.milestonePercent) {
            this.elements.milestonePercent.textContent = `${percent}%`;
        }
    }

    _updateEquivalents(numCycles) {
        const baseline = BASELINES[this.comparisonMode];
        const waterSavedL = (numCycles * (baseline.water - DEVICE.waterUsage)) / 1000;
        const energySavedKWh = numCycles * (baseline.energy - DEVICE.energyUsage);
        if (this.elements.equivBathtubs) {
            this.elements.equivBathtubs.textContent = Math.round(waterSavedL / 60).toLocaleString();
        }
        if (this.elements.equivPhones) {
            this.elements.equivPhones.textContent = Math.round(energySavedKWh / 0.01).toLocaleString();
        }
    }

    _updateSavingsDisplay() {
        const numCycles = this.state.getTotalCycles();
        const baseline = BASELINES[this.comparisonMode];
        const baselineWater = (numCycles * baseline.water) / 1000;
        const actualWater = (numCycles * DEVICE.waterUsage) / 1000;
        const waterSaved = baselineWater - actualWater;
        const waterPercent = baselineWater > 0 ? (waterSaved / baselineWater) * 100 : 0;
        const baselineEnergy = numCycles * baseline.energy;
        const actualEnergy = numCycles * DEVICE.energyUsage;
        const energySaved = baselineEnergy - actualEnergy;
        const energyPercent = baselineEnergy > 0 ? (energySaved / baselineEnergy) * 100 : 0;
        const comparisonText = this.comparisonMode === 'handwash'
            ? 'vs <span class="highlight-text">Handwash</span>'
            : 'vs <span class="highlight-text">Dishwasher</span>';
        if (this.elements.waterComparison) this.elements.waterComparison.innerHTML = comparisonText;
        if (this.elements.energyComparison) this.elements.energyComparison.innerHTML = comparisonText;
        if (this.elements.waterSavingsPercent) {
            this.elements.waterSavingsPercent.textContent = `${Math.round(waterPercent)}%`;
        }
        if (this.elements.energySavingsPercent) {
            this.elements.energySavingsPercent.textContent = `${Math.round(energyPercent)}%`;
        }
        if (this.elements.metricWaterSavings) {
            this.elements.metricWaterSavings.innerHTML = `${Math.round(waterSaved).toLocaleString()}<small class="metric-unit">L</small>`;
        }
        if (this.elements.metricEnergySavings) {
            this.elements.metricEnergySavings.innerHTML = `${energySaved.toFixed(1)}<small class="metric-unit">kWh</small>`;
        }
    }

    animateDelta() {
        if (this.elements.metricCups) {
            this.elements.metricCups.classList.add('elastic-fade');
            setTimeout(() => this.elements.metricCups.classList.remove('elastic-fade'), 450);
        }
        const savedWord = document.querySelector('.hero-label-accent');
        if (savedWord) {
            savedWord.classList.add('saved-glow');
            setTimeout(() => savedWord.classList.remove('saved-glow'), 450);
        }
        const plusOneBadge = document.getElementById('plusOneBadge');
        if (plusOneBadge) {
            plusOneBadge.classList.remove('show', 'hide');
            requestAnimationFrame(() => plusOneBadge.classList.add('show'));
            setTimeout(() => {
                plusOneBadge.classList.remove('show');
                plusOneBadge.classList.add('hide');
                setTimeout(() => plusOneBadge.classList.remove('hide'), 400);
            }, 5000);
        }
        const cycleGlow = document.getElementById('cycleRing');
        if (cycleGlow) {
            cycleGlow.classList.remove('active', 'fade-out');
            requestAnimationFrame(() => cycleGlow.classList.add('active'));
            setTimeout(() => {
                cycleGlow.classList.remove('active');
                cycleGlow.classList.add('fade-out');
                setTimeout(() => cycleGlow.classList.remove('fade-out'), 1000);
            }, 5000);
        }
    }
}

class FirebaseService {
    constructor(state, onReady, onLiveBump) {
        this.state = state;
        this.onReady = onReady;
        this.onLiveBump = onLiveBump;
        this.lastCounter = 0;
        this.events = [];
        this.ready = false;
        firebase.initializeApp(FIREBASE_CONFIG);
        this.database = firebase.database();
    }

    start() {
        this.database.ref('.info/connected').on('value', (snap) => {
            console.log(snap.val() ? 'Connected to Firebase' : 'Disconnected from Firebase');
        });
        this._loadHistory().then(() => {
            this.ready = true;
            this.onReady();
            this._listen();
        }).catch((error) => {
            console.error('Failed to load usage history', error);
            this.ready = true;
            this.onReady();
            this._listen();
        });
    }

    async _loadHistory() {
        const bySerial = {};
        await Promise.all(uniqueSerials().map(async (serial) => {
            const snap = await this.database
                .ref('counter_values')
                .orderByChild('serial_number')
                .equalTo(serial)
                .once('value');
            bySerial[serial] = snap.val() ? Object.values(snap.val()) : [];
        }));

        let siteCycles = 0;
        this.events = [];
        SERIAL_HISTORY.forEach((row) => {
            const entries = bySerial[row.serial] || [];
            const days = dailyMaxByDate(entries);
            const { total, lastCounter } = cyclesForSerial(days, row.startDate, row.endDate);
            siteCycles += total;
            this.events.push(...heatEventsFromEntries(row.serial, entries, row.startDate, row.endDate));
            if (row.serial === activeSerial()) this.lastCounter = lastCounter;
        });

        this.state.siteCycles = siteCycles;
        this._paintHeat();
        console.log(`RJAH cups from dated serial history: ${siteCycles}`);
        console.log(`Live board ${activeSerial()} last counter: ${this.lastCounter}`);
    }

    _listen() {
        const liveSerial = activeSerial();
        this.database
            .ref('counter_values')
            .orderByChild('serial_number')
            .equalTo(liveSerial)
            .limitToLast(4)
            .on('child_added', (snapshot) => {
                if (!this.ready) return;
                const data = snapshot.val();
                if (!data || data.serial_number?.trim() !== liveSerial) return;
                const counter = Number(data.counter);
                if (!Number.isFinite(counter)) return;
                if (this.lastCounter === 0) {
                    this.lastCounter = counter;
                    return;
                }
                const delta = counter - this.lastCounter;
                if (delta <= 0 || delta > MAX_CYCLES_PER_DAY) return;
                this.lastCounter = counter;
                this.state.siteCycles += delta;
                const stamp = parseStamp(data);
                this.events.push({
                    serial: liveSerial,
                    t: stamp ? stamp.getTime() : Date.now(),
                    counter,
                });
                this._paintHeat();
                this.onLiveBump();
            });
    }

    _paintHeat() {
        paintHeat(heatFromEvents(this.events));
    }
}

class DashboardApp {
    constructor() {
        this.state = new DashboardState();
        this.ui = new DashboardUI(this.state);
        this.firebase = new FirebaseService(
            this.state,
            this._showReady.bind(this),
            this._handleLiveBump.bind(this)
        );
        this.firebase.start();
    }

    _showReady() {
        const heroLoading = document.getElementById('heroLoading');
        const heroCounter = document.getElementById('heroCounter');
        if (heroLoading && heroCounter) {
            heroLoading.style.display = 'none';
            heroCounter.style.display = 'flex';
        }
        this.ui.render();
    }

    _handleLiveBump() {
        this._showReady();
        this.ui.animateDelta();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dashboardApp = new DashboardApp();
});
