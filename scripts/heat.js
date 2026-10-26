const HEAT_START_MIN = 7 * 60;
const HEAT_BINS = 22;
const HEAT_FILLS = [
    'rgb(238, 242, 247)',
    'rgb(186, 230, 253)',
    'rgb(56, 189, 248)',
    'rgb(2, 132, 199)',
    'rgb(3, 105, 161)',
];

function heatBinLabel(binIndex) {
    const mins = HEAT_START_MIN + binIndex * 30;
    const hour = String(Math.floor(mins / 60)).padStart(2, '0');
    const minute = String(mins % 60).padStart(2, '0');
    return `${hour}:${minute}`;
}

function heatHourLabel(binIndex) {
    const mins = HEAT_START_MIN + binIndex * 30;
    let hour = Math.floor(mins / 60);
    const suffix = hour >= 12 ? 'pm' : 'am';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}${suffix}`;
}

function heatLevel(avg, minAvg, maxAvg) {
    if (avg <= 0) return 0;
    if (maxAvg <= minAvg) return 2;
    const t = (avg - minAvg) / (maxAvg - minAvg);
    if (t <= 0.25) return 1;
    if (t <= 0.5) return 2;
    if (t <= 0.75) return 3;
    return 4;
}

function heatDeltas(events) {
    const ordered = events.slice().sort((a, b) => a.t - b.t || a.counter - b.counter);
    const prev = {};
    const out = [];
    ordered.forEach((event) => {
        const prior = prev[event.serial];
        prev[event.serial] = event.counter;
        if (prior == null) {
            out.push({ t: event.t, n: 1 });
            return;
        }
        const delta = event.counter - prior;
        if (delta > 0) out.push({ t: event.t, n: delta });
    });
    return out;
}

function heatFromEvents(events) {
    const totals = Array(HEAT_BINS).fill(0);
    const days = new Set();
    heatDeltas(events).forEach((rinse) => {
        const date = new Date(rinse.t);
        const dow = date.getDay();
        if (dow < 1 || dow > 5) return;
        const mins = date.getHours() * 60 + date.getMinutes();
        const bin = Math.floor((mins - HEAT_START_MIN) / 30);
        if (bin < 0 || bin >= HEAT_BINS) return;
        totals[bin] += rinse.n;
        days.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    });
    const dayCount = Math.max(days.size, 1);
    const slots = totals.map((total, binIndex) => ({
        binIndex,
        avg: total / dayCount,
        label: heatBinLabel(binIndex),
    }));
    const active = slots.filter((slot) => slot.avg > 0);
    const minAvg = active.length ? Math.min(...active.map((slot) => slot.avg)) : 0;
    const maxAvg = active.length ? Math.max(...active.map((slot) => slot.avg)) : 0;
    const busiest = active.slice().sort((a, b) => b.avg - a.avg)[0] || null;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const nowBin = Math.floor((nowMins - HEAT_START_MIN) / 30);
    const nowIndex =
        now.getDay() >= 1 && now.getDay() <= 5 && nowBin >= 0 && nowBin < HEAT_BINS
            ? nowBin
            : null;
    return { slots, minAvg, maxAvg, busiest, nowIndex, days: days.size };
}

function heatEventsFromEntries(serial, entries, startDate, endDate) {
    const out = [];
    entries.forEach((entry) => {
        const stamp = parseStamp(entry);
        const counter = Number(entry?.counter);
        if (!stamp || !Number.isFinite(counter)) return;
        if (!inRange(dayKey(stamp), startDate, endDate)) return;
        out.push({ serial, t: stamp.getTime(), counter });
    });
    return out;
}

function paintHeat(heat) {
    const grid = document.getElementById('heat-grid');
    const peak = document.getElementById('heat-peak');
    if (!grid || !heat) return;
    if (!grid.childElementCount) {
        heat.slots.forEach((slot) => {
            const cell = document.createElement('span');
            cell.className = 'heat-cell';
            cell.dataset.bin = String(slot.binIndex);
            grid.appendChild(cell);
        });
        heat.slots.forEach((slot) => {
            const label = document.createElement('span');
            label.className = 'heat-hour';
            label.textContent = slot.binIndex % 4 === 0 ? heatHourLabel(slot.binIndex) : '';
            grid.appendChild(label);
        });
    }
    heat.slots.forEach((slot) => {
        const cell = grid.querySelector(`[data-bin="${slot.binIndex}"]`);
        if (!cell) return;
        const level = heatLevel(slot.avg, heat.minAvg, heat.maxAvg);
        cell.style.background = HEAT_FILLS[level];
        cell.classList.toggle('is-peak', heat.busiest?.binIndex === slot.binIndex);
        cell.classList.toggle('is-now', heat.nowIndex === slot.binIndex);
    });
    if (peak) {
        peak.textContent = heat.busiest
            ? `Hottest ${heat.busiest.label} to ${heatBinLabel(heat.busiest.binIndex + 1)}`
            : '';
    }
}
