// ===== EdgeLog — Futures Trading Journal =====
// All data stored in localStorage, exportable as JSON

(function () {
    'use strict';

    // ===== Instrument Definitions =====
    const INSTRUMENTS = {
        MNQ: { name: 'Micro E-mini Nasdaq', tickSize: 0.25, tickValue: 0.50, pointValue: 2.00 },
        MES: { name: 'Micro E-mini S&P', tickSize: 0.25, tickValue: 1.25, pointValue: 5.00 },
        MYM: { name: 'Micro E-mini Dow', tickSize: 1.00, tickValue: 0.50, pointValue: 0.50 },
        M2K: { name: 'Micro E-mini Russell', tickSize: 0.10, tickValue: 0.50, pointValue: 5.00 },
        MCL: { name: 'Micro Crude Oil', tickSize: 0.01, tickValue: 1.00, pointValue: 100.00 },
        MGC: { name: 'Micro Gold', tickSize: 0.10, tickValue: 1.00, pointValue: 10.00 },
        MHG: { name: 'Micro Copper', tickSize: 0.0005, tickValue: 1.25, pointValue: 2500.00 },
        SIL: { name: 'Micro Silver', tickSize: 0.005, tickValue: 2.50, pointValue: 500.00 },
        MBT: { name: 'Micro Bitcoin', tickSize: 5.00, tickValue: 0.50, pointValue: 0.10 },
        MET: { name: 'Micro Ether', tickSize: 0.25, tickValue: 0.50, pointValue: 2.00 }
    };

    // ===== State =====
    let trades = [];
    let journalEntries = [];
    let currentSort = { field: 'date', dir: 'desc' };
    let calendarDate = new Date();
    let deleteTargetId = null;
    let equityChart = null;

    // ===== Storage =====
    function loadData() {
        try {
            trades = JSON.parse(localStorage.getItem('edgelog_trades') || '[]');
            journalEntries = JSON.parse(localStorage.getItem('edgelog_journal') || '[]');
        } catch (e) {
            trades = [];
            journalEntries = [];
        }
    }

    function saveTrades() {
        localStorage.setItem('edgelog_trades', JSON.stringify(trades));
    }

    function saveJournal() {
        localStorage.setItem('edgelog_journal', JSON.stringify(journalEntries));
    }

    // ===== P&L Calculation =====
    function calcPnL(trade) {
        const inst = INSTRUMENTS[trade.instrument];
        if (!inst) return 0;
        const diff = trade.direction === 'long'
            ? (trade.exitPrice - trade.entryPrice)
            : (trade.entryPrice - trade.exitPrice);
        return (diff * inst.pointValue * trade.qty) - (trade.fees || 0);
    }

    // ===== Stats =====
    function getStats(tradeList) {
        const wins = tradeList.filter(t => t.pnl > 0);
        const losses = tradeList.filter(t => t.pnl < 0);
        const breakevens = tradeList.filter(t => t.pnl === 0);
        const grossWins = wins.reduce((s, t) => s + t.pnl, 0);
        const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

        return {
            total: tradeList.length,
            wins: wins.length,
            losses: losses.length,
            breakevens: breakevens.length,
            netPL: tradeList.reduce((s, t) => s + t.pnl, 0),
            winRate: tradeList.length > 0 ? (wins.length / tradeList.length * 100) : 0,
            profitFactor: grossLosses > 0 ? (grossWins / grossLosses) : grossWins > 0 ? Infinity : 0,
            avgWin: wins.length > 0 ? grossWins / wins.length : 0,
            avgLoss: losses.length > 0 ? -(grossLosses / losses.length) : 0,
            largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0,
            largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0,
            avgRR: (wins.length > 0 && losses.length > 0)
                ? (grossWins / wins.length) / (grossLosses / losses.length)
                : 0,
            expectancy: tradeList.length > 0
                ? tradeList.reduce((s, t) => s + t.pnl, 0) / tradeList.length
                : 0,
            grossWins,
            grossLosses
        };
    }

    // ===== Format Helpers =====
    function fmtMoney(val) {
        const sign = val >= 0 ? '+' : '';
        return sign + '$' + Math.abs(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function fmtMoneyPlain(val) {
        return '$' + Math.abs(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function fmtDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function fmtDateShort(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // ===== Navigation =====
    function switchView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.remove('active'));
        document.getElementById(viewName + 'View').classList.add('active');
        document.querySelector(`.nav-item[data-view="${viewName}"]`).classList.add('active');

        if (viewName === 'dashboard') renderDashboard();
        if (viewName === 'trades') renderTrades();
        if (viewName === 'calendar') renderCalendar();
        if (viewName === 'journal') renderJournal();
    }

    // ===== Dashboard =====
    function renderDashboard() {
        const stats = getStats(trades);

        // Stat cards
        const plEl = document.getElementById('totalPL');
        plEl.textContent = fmtMoney(stats.netPL);
        plEl.className = 'stat-value ' + (stats.netPL >= 0 ? 'positive' : 'negative');
        document.getElementById('statNetPL').className = 'stat-card' + (stats.netPL >= 0 ? '' : ' loss-card');

        document.getElementById('winRate').textContent = stats.winRate.toFixed(1) + '%';
        document.getElementById('winLossCount').textContent = `${stats.wins}W / ${stats.losses}L`;

        document.getElementById('profitFactor').textContent =
            stats.profitFactor === Infinity ? '∞' :
                stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '--';

        document.getElementById('totalTrades').textContent = stats.total;
        document.getElementById('plTradeCount').textContent = stats.total + ' trades';

        if (trades.length > 0) {
            const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
            document.getElementById('tradePeriod').textContent =
                fmtDateShort(sorted[0].date) + ' – ' + fmtDateShort(sorted[sorted.length - 1].date);
        } else {
            document.getElementById('tradePeriod').textContent = 'No trades yet';
        }

        // Performance
        document.getElementById('avgWin').textContent = stats.avgWin > 0 ? fmtMoney(stats.avgWin) : '--';
        document.getElementById('avgLoss').textContent = stats.avgLoss < 0 ? fmtMoney(stats.avgLoss) : '--';
        document.getElementById('largestWin').textContent = stats.largestWin > 0 ? fmtMoney(stats.largestWin) : '--';
        document.getElementById('largestLoss').textContent = stats.largestLoss < 0 ? fmtMoney(stats.largestLoss) : '--';
        document.getElementById('avgRR').textContent = stats.avgRR > 0 ? stats.avgRR.toFixed(2) : '--';
        document.getElementById('expectancy').textContent = stats.expectancy !== 0 ? fmtMoney(stats.expectancy) : '--';

        // Equity chart
        renderEquityChart();

        // Breakdowns
        renderBreakdown('instrument', 'instrumentBreakdown', 'emptyInstrument');
        renderBreakdown('setup', 'setupBreakdown', 'emptySetup');
    }

    function renderEquityChart(range) {
        const sorted = [...trades].sort((a, b) => {
            const da = a.date + (a.time || '00:00');
            const db = b.date + (b.time || '00:00');
            return da.localeCompare(db);
        });

        let filtered = sorted;
        if (range === '30d') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            filtered = sorted.filter(t => new Date(t.date) >= cutoff);
        } else if (range === '7d') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7);
            filtered = sorted.filter(t => new Date(t.date) >= cutoff);
        }

        const emptyEl = document.getElementById('emptyEquity');
        const canvas = document.getElementById('equityChart');

        if (filtered.length === 0) {
            canvas.style.display = 'none';
            emptyEl.style.display = 'flex';
            return;
        }

        canvas.style.display = 'block';
        emptyEl.style.display = 'none';

        let cumPL = 0;
        const data = filtered.map(t => {
            cumPL += t.pnl;
            return { x: fmtDateShort(t.date), y: cumPL, trade: t };
        });

        // Add starting point
        data.unshift({ x: 'Start', y: 0 });

        if (equityChart) equityChart.destroy();

        equityChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: data.map(d => d.x),
                datasets: [{
                    data: data.map(d => d.y),
                    borderColor: cumPL >= 0 ? '#10b981' : '#ef4444',
                    backgroundColor: cumPL >= 0
                        ? 'rgba(16, 185, 129, 0.08)'
                        : 'rgba(239, 68, 68, 0.08)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 2,
                    pointRadius: data.length < 30 ? 4 : 2,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: cumPL >= 0 ? '#10b981' : '#ef4444',
                    pointBorderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#111113',
                        titleFont: { family: "'DM Sans', sans-serif", size: 12 },
                        bodyFont: { family: "'JetBrains Mono', monospace", size: 13 },
                        padding: 10,
                        cornerRadius: 6,
                        callbacks: {
                            label: function (ctx) {
                                return 'P&L: ' + fmtMoney(ctx.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: "'DM Sans', sans-serif", size: 11 },
                            color: '#aeaeb2',
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        grid: { color: 'rgba(0,0,0,0.04)' },
                        ticks: {
                            font: { family: "'JetBrains Mono', monospace", size: 11 },
                            color: '#aeaeb2',
                            callback: v => '$' + v.toLocaleString()
                        }
                    }
                }
            }
        });
    }

    function renderBreakdown(field, containerId, emptyId) {
        const container = document.getElementById(containerId);
        const emptyEl = document.getElementById(emptyId);

        if (trades.length === 0) {
            container.innerHTML = '';
            emptyEl.style.display = 'flex';
            return;
        }

        emptyEl.style.display = 'none';

        const groups = {};
        trades.forEach(t => {
            const key = t[field] || 'Unspecified';
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });

        const sorted = Object.entries(groups)
            .map(([name, ts]) => ({
                name,
                count: ts.length,
                pnl: ts.reduce((s, t) => s + t.pnl, 0),
                winRate: (ts.filter(t => t.pnl > 0).length / ts.length * 100)
            }))
            .sort((a, b) => b.pnl - a.pnl);

        container.innerHTML = sorted.map(g => `
            <div class="breakdown-item">
                <span class="breakdown-name">${g.name}</span>
                <div class="breakdown-stats">
                    <span class="breakdown-count">${g.count} trades · ${g.winRate.toFixed(0)}% WR</span>
                    <span class="breakdown-pl ${g.pnl >= 0 ? 'positive' : 'negative'}">${fmtMoney(g.pnl)}</span>
                </div>
            </div>
        `).join('');
    }

    // ===== Trades Table =====
    function renderTrades() {
        updateFilterOptions();
        const filtered = getFilteredTrades();
        const sorted = sortTrades(filtered);

        const tbody = document.getElementById('tradesTableBody');
        const emptyEl = document.getElementById('emptyTrades');

        if (sorted.length === 0) {
            tbody.innerHTML = '';
            emptyEl.style.display = trades.length === 0 ? 'flex' : 'none';
            if (trades.length > 0 && sorted.length === 0) {
                tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text-tertiary)">No trades match your filters</td></tr>';
            }
            return;
        }

        emptyEl.style.display = 'none';

        tbody.innerHTML = sorted.map(t => {
            const tags = (t.tags || '').split(',').map(s => s.trim()).filter(Boolean);
            const stars = '★'.repeat(t.rating || 0) + '☆'.repeat(5 - (t.rating || 0));
            const emotion = t.emotion ? getEmotionIcon(t.emotion) : '';

            return `<tr>
                <td>${fmtDate(t.date)}${t.time ? ' <span style="color:var(--text-tertiary);font-size:11px">' + t.time + '</span>' : ''}</td>
                <td><strong>${t.instrument}</strong></td>
                <td><span class="dir-badge ${t.direction}">${t.direction}</span></td>
                <td class="mono">${t.entryPrice}</td>
                <td class="mono">${t.exitPrice}</td>
                <td>${t.qty}</td>
                <td class="mono ${t.pnl >= 0 ? 'positive' : 'negative'}">${fmtMoney(t.pnl)}</td>
                <td>${t.setup || '--'}</td>
                <td>${tags.map(tag => '<span class="tag">' + tag + '</span>').join('')}</td>
                <td><span class="rating-stars">${stars}</span> ${emotion}</td>
                <td>
                    <button class="action-btn" onclick="EdgeLog.editTrade('${t.id}')" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="action-btn danger" onclick="EdgeLog.confirmDelete('${t.id}')" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    function getEmotionIcon(emotion) {
        const map = {
            confident: '😎', calm: '😌', neutral: '😐',
            anxious: '😰', fomo: '😫', tilted: '🤯',
            great: '🔥', good: '😊', okay: '😐', bad: '😤'
        };
        return map[emotion] || '';
    }

    function updateFilterOptions() {
        const instruments = [...new Set(trades.map(t => t.instrument))].sort();
        const setups = [...new Set(trades.map(t => t.setup).filter(Boolean))].sort();

        const instrSel = document.getElementById('filterInstrument');
        const curInstr = instrSel.value;
        instrSel.innerHTML = '<option value="">All Instruments</option>' +
            instruments.map(i => `<option value="${i}" ${i === curInstr ? 'selected' : ''}>${i}</option>`).join('');

        const setupSel = document.getElementById('filterSetup');
        const curSetup = setupSel.value;
        setupSel.innerHTML = '<option value="">All Setups</option>' +
            setups.map(s => `<option value="${s}" ${s === curSetup ? 'selected' : ''}>${s}</option>`).join('');
    }

    function getFilteredTrades() {
        const instr = document.getElementById('filterInstrument').value;
        const dir = document.getElementById('filterDirection').value;
        const setup = document.getElementById('filterSetup').value;
        const result = document.getElementById('filterResult').value;
        const from = document.getElementById('filterDateFrom').value;
        const to = document.getElementById('filterDateTo').value;

        return trades.filter(t => {
            if (instr && t.instrument !== instr) return false;
            if (dir && t.direction !== dir) return false;
            if (setup && t.setup !== setup) return false;
            if (result === 'win' && t.pnl <= 0) return false;
            if (result === 'loss' && t.pnl >= 0) return false;
            if (result === 'breakeven' && t.pnl !== 0) return false;
            if (from && t.date < from) return false;
            if (to && t.date > to) return false;
            return true;
        });
    }

    function sortTrades(list) {
        const { field, dir } = currentSort;
        const mult = dir === 'asc' ? 1 : -1;

        return [...list].sort((a, b) => {
            let va = a[field], vb = b[field];
            if (field === 'pnl' || field === 'entry' || field === 'exit') {
                va = Number(va) || 0;
                vb = Number(vb) || 0;
            }
            if (va < vb) return -1 * mult;
            if (va > vb) return 1 * mult;
            return 0;
        });
    }

    // ===== Calendar =====
    function renderCalendar() {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const monthName = calendarDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        document.getElementById('calMonth').textContent = monthName;

        const grid = document.getElementById('calendarGrid');
        // Keep headers
        grid.innerHTML = `
            <div class="cal-day-header">Mon</div>
            <div class="cal-day-header">Tue</div>
            <div class="cal-day-header">Wed</div>
            <div class="cal-day-header">Thu</div>
            <div class="cal-day-header">Fri</div>
            <div class="cal-day-header">Sat</div>
            <div class="cal-day-header">Sun</div>
        `;

        // Aggregate daily P&L
        const dailyData = {};
        trades.forEach(t => {
            if (!dailyData[t.date]) dailyData[t.date] = { pnl: 0, count: 0 };
            dailyData[t.date].pnl += t.pnl;
            dailyData[t.date].count++;
        });

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Empty cells before first day
        for (let i = 0; i < startOffset; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day empty';
            grid.appendChild(empty);
        }

        let monthPL = 0;
        let monthTrades = 0;
        let winDays = 0;
        let lossDays = 0;
        let bestDay = { date: '', pnl: -Infinity };
        let worstDay = { date: '', pnl: Infinity };

        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const data = dailyData[dateStr];
            const isToday = dateStr === todayStr;

            const cell = document.createElement('div');
            cell.className = 'cal-day';
            if (isToday) cell.classList.add('today');

            if (data) {
                monthPL += data.pnl;
                monthTrades += data.count;

                if (data.pnl > 0) winDays++;
                if (data.pnl < 0) lossDays++;
                if (data.pnl > bestDay.pnl) bestDay = { date: dateStr, pnl: data.pnl };
                if (data.pnl < worstDay.pnl) worstDay = { date: dateStr, pnl: data.pnl };

                const absPL = Math.abs(data.pnl);
                let colorClass = 'breakeven';
                if (data.pnl > 0) {
                    colorClass = absPL > 200 ? 'win-heavy' : 'win';
                } else if (data.pnl < 0) {
                    colorClass = absPL > 200 ? 'loss-heavy' : 'loss';
                }
                cell.classList.add(colorClass);

                cell.innerHTML = `
                    <span class="day-num">${d}</span>
                    <span class="day-pl">${fmtMoney(data.pnl)}</span>
                    <span class="day-count">${data.count} trade${data.count > 1 ? 's' : ''}</span>
                `;

                cell.addEventListener('mouseenter', (e) => showCalTooltip(e, dateStr, data));
                cell.addEventListener('mouseleave', hideCalTooltip);
            } else {
                cell.innerHTML = `<span class="day-num">${d}</span>`;
            }

            // Weekend dimming
            const dayOfWeek = new Date(year, month, d).getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                cell.style.opacity = '0.5';
            }

            grid.appendChild(cell);
        }

        // Summary
        const summaryEl = document.getElementById('calendarSummary');
        summaryEl.innerHTML = `
            <div class="cal-stat">
                <span class="cal-stat-label">Month P&L</span>
                <span class="cal-stat-value ${monthPL >= 0 ? 'positive' : 'negative'}">${fmtMoney(monthPL)}</span>
            </div>
            <div class="cal-stat">
                <span class="cal-stat-label">Trades</span>
                <span class="cal-stat-value">${monthTrades}</span>
            </div>
            <div class="cal-stat">
                <span class="cal-stat-label">Win Days</span>
                <span class="cal-stat-value positive">${winDays}</span>
            </div>
            <div class="cal-stat">
                <span class="cal-stat-label">Loss Days</span>
                <span class="cal-stat-value negative">${lossDays}</span>
            </div>
            <div class="cal-stat">
                <span class="cal-stat-label">Best Day</span>
                <span class="cal-stat-value positive">${bestDay.pnl > -Infinity ? fmtMoney(bestDay.pnl) : '--'}</span>
            </div>
            <div class="cal-stat">
                <span class="cal-stat-label">Worst Day</span>
                <span class="cal-stat-value negative">${worstDay.pnl < Infinity ? fmtMoney(worstDay.pnl) : '--'}</span>
            </div>
        `;
    }

    let tooltipEl = null;

    function showCalTooltip(e, dateStr, data) {
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'cal-tooltip';
            document.body.appendChild(tooltipEl);
        }
        tooltipEl.innerHTML = `
            <div class="tt-date">${fmtDate(dateStr)}</div>
            <div class="tt-pl ${data.pnl >= 0 ? 'positive' : 'negative'}">${fmtMoney(data.pnl)}</div>
            <div class="tt-count">${data.count} trade${data.count > 1 ? 's' : ''}</div>
        `;
        tooltipEl.style.display = 'block';
        const rect = e.target.getBoundingClientRect();
        tooltipEl.style.left = (rect.left + rect.width / 2 - tooltipEl.offsetWidth / 2) + 'px';
        tooltipEl.style.top = (rect.top - tooltipEl.offsetHeight - 8) + 'px';
    }

    function hideCalTooltip() {
        if (tooltipEl) tooltipEl.style.display = 'none';
    }

    // ===== Journal =====
    function renderJournal() {
        const list = document.getElementById('journalList');
        const emptyEl = document.getElementById('emptyJournal');

        if (journalEntries.length === 0) {
            list.innerHTML = '';
            emptyEl.style.display = 'flex';
            list.appendChild(emptyEl);
            return;
        }

        emptyEl.style.display = 'none';
        const sorted = [...journalEntries].sort((a, b) => b.date.localeCompare(a.date));

        list.innerHTML = sorted.map(e => `
            <div class="journal-card" onclick="EdgeLog.editJournal('${e.id}')">
                <div class="journal-card-header">
                    <div>
                        <div class="journal-card-title">${e.title}</div>
                        <div class="journal-card-date">${fmtDate(e.date)}</div>
                    </div>
                    ${e.mood ? '<span class="journal-card-mood">' + getEmotionIcon(e.mood) + '</span>' : ''}
                </div>
                <div class="journal-card-preview">${e.content}</div>
                <div class="journal-card-footer">
                    <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); EdgeLog.editJournal('${e.id}')">Edit</button>
                    <button class="btn btn-sm btn-ghost" style="color:var(--clr-loss)" onclick="event.stopPropagation(); EdgeLog.deleteJournal('${e.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    // ===== Trade Modal =====
    function openTradeModal(trade) {
        const modal = document.getElementById('tradeModal');
        const form = document.getElementById('tradeForm');
        const title = document.getElementById('tradeModalTitle');

        form.reset();
        document.getElementById('tradeId').value = '';
        document.getElementById('tradeDirection').value = 'long';
        document.getElementById('tradeRating').value = '0';
        document.getElementById('tradeEmotion').value = '';

        // Reset direction buttons
        document.querySelectorAll('.dir-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.dir === 'long');
        });
        // Reset stars
        document.querySelectorAll('#starRating .star').forEach(s => s.classList.remove('active'));
        // Reset emotions
        document.querySelectorAll('#emotionSelect .emotion-btn').forEach(b => b.classList.remove('active'));

        // Set default date to today
        document.getElementById('tradeDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('tradeFees').value = '0.62';

        if (trade) {
            title.textContent = 'Edit Trade';
            document.getElementById('tradeId').value = trade.id;
            document.getElementById('tradeInstrument').value = trade.instrument;
            document.getElementById('tradeDirection').value = trade.direction;
            document.getElementById('tradeEntry').value = trade.entryPrice;
            document.getElementById('tradeExit').value = trade.exitPrice;
            document.getElementById('tradeQty').value = trade.qty;
            document.getElementById('tradeFees').value = trade.fees;
            document.getElementById('tradeDate').value = trade.date;
            document.getElementById('tradeTime').value = trade.time || '';
            document.getElementById('tradeSetup').value = trade.setup || '';
            document.getElementById('tradeTags').value = trade.tags || '';
            document.getElementById('tradeRating').value = trade.rating || 0;
            document.getElementById('tradeEmotion').value = trade.emotion || '';
            document.getElementById('tradeNotes').value = trade.notes || '';

            // Set direction buttons
            document.querySelectorAll('.dir-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.dir === trade.direction);
            });
            // Set stars
            for (let i = 1; i <= 5; i++) {
                const star = document.querySelector(`#starRating .star[data-rating="${i}"]`);
                if (star) star.classList.toggle('active', i <= (trade.rating || 0));
            }
            // Set emotion
            if (trade.emotion) {
                const btn = document.querySelector(`#emotionSelect .emotion-btn[data-emotion="${trade.emotion}"]`);
                if (btn) btn.classList.add('active');
            }
        } else {
            title.textContent = 'Log Trade';
        }

        modal.classList.add('open');
    }

    function closeTradeModal() {
        document.getElementById('tradeModal').classList.remove('open');
    }

    function saveTrade(e) {
        e.preventDefault();

        const id = document.getElementById('tradeId').value || 't_' + Date.now();
        const instrument = document.getElementById('tradeInstrument').value;
        const direction = document.getElementById('tradeDirection').value;
        const entryPrice = parseFloat(document.getElementById('tradeEntry').value);
        const exitPrice = parseFloat(document.getElementById('tradeExit').value);
        const qty = parseInt(document.getElementById('tradeQty').value);
        const fees = parseFloat(document.getElementById('tradeFees').value) || 0;
        const date = document.getElementById('tradeDate').value;
        const time = document.getElementById('tradeTime').value;
        const setup = document.getElementById('tradeSetup').value;
        const tags = document.getElementById('tradeTags').value;
        const rating = parseInt(document.getElementById('tradeRating').value) || 0;
        const emotion = document.getElementById('tradeEmotion').value;
        const notes = document.getElementById('tradeNotes').value;

        const trade = {
            id, instrument, direction, entryPrice, exitPrice, qty,
            fees, date, time, setup, tags, rating, emotion, notes, pnl: 0
        };
        trade.pnl = calcPnL(trade);

        const existing = trades.findIndex(t => t.id === id);
        if (existing >= 0) {
            trades[existing] = trade;
        } else {
            trades.push(trade);
        }

        saveTrades();
        closeTradeModal();
        showToast('Trade saved successfully', 'success');

        // Refresh current view
        const activeView = document.querySelector('.view.active').id.replace('View', '');
        switchView(activeView);
    }

    // ===== Journal Modal =====
    function openJournalModal(entry) {
        const modal = document.getElementById('journalModal');
        const form = document.getElementById('journalForm');
        const title = document.getElementById('journalModalTitle');

        form.reset();
        document.getElementById('journalId').value = '';
        document.getElementById('journalMood').value = '';
        document.querySelectorAll('#journalMoodSelect .emotion-btn').forEach(b => b.classList.remove('active'));

        document.getElementById('journalDate').value = new Date().toISOString().split('T')[0];

        if (entry) {
            title.textContent = 'Edit Journal Entry';
            document.getElementById('journalId').value = entry.id;
            document.getElementById('journalDate').value = entry.date;
            document.getElementById('journalTitle').value = entry.title;
            document.getElementById('journalContent').value = entry.content;
            document.getElementById('journalMood').value = entry.mood || '';

            if (entry.mood) {
                const btn = document.querySelector(`#journalMoodSelect .emotion-btn[data-emotion="${entry.mood}"]`);
                if (btn) btn.classList.add('active');
            }
        } else {
            title.textContent = 'New Journal Entry';
        }

        modal.classList.add('open');
    }

    function closeJournalModal() {
        document.getElementById('journalModal').classList.remove('open');
    }

    function saveJournalEntry(e) {
        e.preventDefault();

        const id = document.getElementById('journalId').value || 'j_' + Date.now();
        const entry = {
            id,
            date: document.getElementById('journalDate').value,
            title: document.getElementById('journalTitle').value,
            content: document.getElementById('journalContent').value,
            mood: document.getElementById('journalMood').value,
            updatedAt: new Date().toISOString()
        };

        const existing = journalEntries.findIndex(j => j.id === id);
        if (existing >= 0) {
            journalEntries[existing] = entry;
        } else {
            journalEntries.push(entry);
        }

        saveJournal();
        closeJournalModal();
        showToast('Journal entry saved', 'success');
        renderJournal();
    }

    // ===== Delete =====
    function confirmDelete(id) {
        deleteTargetId = id;
        document.getElementById('deleteModal').classList.add('open');
    }

    function executeDelete() {
        if (!deleteTargetId) return;
        trades = trades.filter(t => t.id !== deleteTargetId);
        saveTrades();
        deleteTargetId = null;
        document.getElementById('deleteModal').classList.remove('open');
        showToast('Trade deleted', 'success');
        renderTrades();
    }

    function deleteJournalEntry(id) {
        if (!confirm('Delete this journal entry?')) return;
        journalEntries = journalEntries.filter(j => j.id !== id);
        saveJournal();
        showToast('Journal entry deleted', 'success');
        renderJournal();
    }

    // ===== Export / Import =====
    function exportData() {
        const data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            trades,
            journalEntries
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edgelog-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported successfully', 'success');
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.trades || !Array.isArray(data.trades)) {
                    throw new Error('Invalid file format');
                }

                const mergeChoice = confirm(
                    `Found ${data.trades.length} trades and ${(data.journalEntries || []).length} journal entries.\n\n` +
                    'OK = Merge with existing data\nCancel = Replace all data'
                );

                if (mergeChoice) {
                    // Merge: add non-duplicate trades
                    const existingIds = new Set(trades.map(t => t.id));
                    const newTrades = data.trades.filter(t => !existingIds.has(t.id));
                    trades = [...trades, ...newTrades];

                    const existingJournalIds = new Set(journalEntries.map(j => j.id));
                    const newJournal = (data.journalEntries || []).filter(j => !existingJournalIds.has(j.id));
                    journalEntries = [...journalEntries, ...newJournal];
                } else {
                    trades = data.trades;
                    journalEntries = data.journalEntries || [];
                }

                saveTrades();
                saveJournal();
                showToast(`Imported ${data.trades.length} trades`, 'success');
                switchView('dashboard');
            } catch (err) {
                showToast('Invalid file: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    // ===== Toast =====
    function showToast(message, type) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast ' + (type || '');
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ===== Event Listeners =====
    function init() {
        loadData();

        // Navigation
        document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
            btn.addEventListener('click', () => switchView(btn.dataset.view));
        });

        // Add trade buttons
        document.getElementById('addTradeBtn').addEventListener('click', () => openTradeModal());
        document.getElementById('addTradeBtn2').addEventListener('click', () => openTradeModal());
        document.getElementById('addTradeBtn3').addEventListener('click', () => openTradeModal());

        // Trade form
        document.getElementById('tradeForm').addEventListener('submit', saveTrade);
        document.getElementById('tradeModalClose').addEventListener('click', closeTradeModal);
        document.getElementById('tradeCancel').addEventListener('click', closeTradeModal);

        // Direction toggle
        document.querySelectorAll('.dir-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('tradeDirection').value = btn.dataset.dir;
            });
        });

        // Star rating
        document.querySelectorAll('#starRating .star').forEach(star => {
            star.addEventListener('click', () => {
                const rating = parseInt(star.dataset.rating);
                document.getElementById('tradeRating').value = rating;
                document.querySelectorAll('#starRating .star').forEach(s => {
                    s.classList.toggle('active', parseInt(s.dataset.rating) <= rating);
                });
            });
        });

        // Emotion select (trade)
        document.querySelectorAll('#emotionSelect .emotion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#emotionSelect .emotion-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('tradeEmotion').value = btn.dataset.emotion;
            });
        });

        // Journal
        document.getElementById('addJournalBtn').addEventListener('click', () => openJournalModal());
        document.getElementById('addJournalBtn2').addEventListener('click', () => openJournalModal());
        document.getElementById('journalForm').addEventListener('submit', saveJournalEntry);
        document.getElementById('journalModalClose').addEventListener('click', closeJournalModal);
        document.getElementById('journalCancel').addEventListener('click', closeJournalModal);

        // Journal mood select
        document.querySelectorAll('#journalMoodSelect .emotion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#journalMoodSelect .emotion-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('journalMood').value = btn.dataset.emotion;
            });
        });

        // Delete modal
        document.getElementById('deleteModalClose').addEventListener('click', () => {
            document.getElementById('deleteModal').classList.remove('open');
        });
        document.getElementById('deleteCancel').addEventListener('click', () => {
            document.getElementById('deleteModal').classList.remove('open');
        });
        document.getElementById('deleteConfirm').addEventListener('click', executeDelete);

        // Export/Import
        document.getElementById('exportBtn').addEventListener('click', exportData);
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });
        document.getElementById('importFile').addEventListener('change', (e) => {
            if (e.target.files[0]) importData(e.target.files[0]);
            e.target.value = '';
        });

        // Calendar navigation
        document.getElementById('calPrev').addEventListener('click', () => {
            calendarDate.setMonth(calendarDate.getMonth() - 1);
            renderCalendar();
        });
        document.getElementById('calNext').addEventListener('click', () => {
            calendarDate.setMonth(calendarDate.getMonth() + 1);
            renderCalendar();
        });
        document.getElementById('calToday').addEventListener('click', () => {
            calendarDate = new Date();
            renderCalendar();
        });

        // Equity chart range filters
        document.querySelectorAll('.chart-filters .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.chart-filters .chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                renderEquityChart(chip.dataset.range);
            });
        });

        // Table sorting
        document.querySelectorAll('.trades-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                if (currentSort.field === field) {
                    currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort = { field, dir: 'desc' };
                }
                document.querySelectorAll('.trades-table th.sortable').forEach(t => {
                    t.classList.remove('th-sort-asc', 'th-sort-desc');
                });
                th.classList.add(currentSort.dir === 'asc' ? 'th-sort-asc' : 'th-sort-desc');
                renderTrades();
            });
        });

        // Filters
        ['filterInstrument', 'filterDirection', 'filterSetup', 'filterResult', 'filterDateFrom', 'filterDateTo'].forEach(id => {
            document.getElementById(id).addEventListener('change', renderTrades);
        });

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('open');
                }
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
            }
            if (e.key === 'n' && !isInputFocused()) {
                e.preventDefault();
                openTradeModal();
            }
        });

        // Initial render
        switchView('dashboard');
    }

    function isInputFocused() {
        const el = document.activeElement;
        return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
    }

    // ===== Expose API for inline handlers =====
    window.EdgeLog = {
        editTrade: function (id) {
            const trade = trades.find(t => t.id === id);
            if (trade) openTradeModal(trade);
        },
        confirmDelete: confirmDelete,
        editJournal: function (id) {
            const entry = journalEntries.find(j => j.id === id);
            if (entry) openJournalModal(entry);
        },
        deleteJournal: deleteJournalEntry
    };

    // ===== Init =====
    document.addEventListener('DOMContentLoaded', init);
})();
