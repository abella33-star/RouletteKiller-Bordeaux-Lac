'use strict';

// ===== STATE =====
let state = {
  spins: [],
  startBankroll: 1000,
  currentBankroll: 1000,
  wins: 0,
  losses: 0,
  totalSpins: 0,
  consecutiveLosses: 0,
  consecutiveWins: 0,
  discipline: 100,
  moneyMode: 'adaptatif',
  selectedProfile: 'equilibre',
  x2Mode: false,
  streakSessions: 0,
  antitiltActive: false,
  antitiltTimer: null,
  antitiltRemaining: 120
};

// Computed
function profitPct() {
  if (state.startBankroll === 0) return 0;
  return (state.currentBankroll - state.startBankroll) / state.startBankroll * 100;
}

function statsForEngines() {
  return {
    currentBankroll: state.currentBankroll,
    startBankroll: state.startBankroll,
    wins: state.wins,
    losses: state.losses,
    totalSpins: state.totalSpins,
    consecutiveLosses: state.consecutiveLosses,
    consecutiveWins: state.consecutiveWins,
    discipline: state.discipline,
    profitPct: profitPct(),
    moneyMode: state.moneyMode
  };
}

// Engines
const { ChiSquareAnalyzer, ElectronicRouletteAnalyzer, OpportunityScoreEngine,
        SessionEngine, StrategySelector, ProfitLockEngine, BacktestEngine,
        PROFILES, PHASES, WHEEL_ORDER, getColor, getZone, fmt, fmtPct, wheelDist } = window.RK;

const scoreEng = new OpportunityScoreEngine();
const electronicEng = new ElectronicRouletteAnalyzer();
const sessionEng = new SessionEngine();
const selector = new StrategySelector();
const lockEng = new ProfitLockEngine();

// ===== PERSISTENCE =====
function save() {
  try {
    localStorage.setItem('rk_state', JSON.stringify({
      spins: state.spins,
      startBankroll: state.startBankroll,
      currentBankroll: state.currentBankroll,
      wins: state.wins,
      losses: state.losses,
      totalSpins: state.totalSpins,
      consecutiveLosses: state.consecutiveLosses,
      consecutiveWins: state.consecutiveWins,
      discipline: state.discipline,
      moneyMode: state.moneyMode,
      selectedProfile: state.selectedProfile,
      x2Mode: state.x2Mode,
      streakSessions: state.streakSessions
    }));
  } catch (e) {}
}

function load() {
  try {
    const raw = localStorage.getItem('rk_state');
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
  } catch (e) {}
}

// ===== ADVICE MESSAGES =====
const ADVICE = [
  'Respirez profondément. La discipline est votre vrai atout.',
  'Le casino compte sur votre impatience — soyez patient.',
  'Chaque pause est une victoire contre vous-même.',
  'La fortune favorise les esprits calmes.',
  'Votre bankroll vous remerciera demain.',
  'Un joueur discipliné gagne sur le long terme.',
  'La colère coûte plus cher que les pertes.',
  'Attendez le bon moment — il viendra.'
];

// ===== ADD SPIN =====
function addSpin(number) {
  if (state.antitiltActive) return;

  const color = getColor(number);
  const zone = getZone(number);
  const spin = { number, color, zone, timestamp: Date.now() };
  state.spins.push(spin);
  state.totalSpins++;

  // Haptic
  if (navigator.vibrate) navigator.vibrate(30);

  // Flash animation on button
  const btn = document.querySelector(`.spin-btn[data-n="${number}"]`);
  if (btn) {
    btn.classList.add('last-hit');
    setTimeout(() => btn.classList.remove('last-hit'), 800);
    const flash = document.createElement('div');
    flash.style.cssText = 'position:absolute;inset:0;background:rgba(0,230,118,0.4);border-radius:6px;pointer-events:none;';
    btn.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
  }

  save();
  refresh();
}

// ===== RECORD WIN/LOSS =====
function recordResult(won, stake) {
  if (won) {
    state.wins++;
    state.consecutiveWins++;
    state.consecutiveLosses = 0;
    state.currentBankroll += stake;
    state.discipline = Math.min(100, state.discipline + 5);
  } else {
    state.losses++;
    state.consecutiveLosses++;
    state.consecutiveWins = 0;
    state.currentBankroll = Math.max(0, state.currentBankroll - stake);
    state.discipline = Math.max(0, state.discipline - 10);
    if (state.consecutiveLosses >= PROFILES[state.selectedProfile].maxLosses) triggerAntiTilt();
  }
  save();
  refresh();
}

// ===== ANTI-TILT =====
function triggerAntiTilt() {
  if (state.antitiltActive) return;
  state.antitiltActive = true;
  state.antitiltRemaining = 120;
  const overlay = document.getElementById('antitilt-overlay');
  const advice = document.getElementById('antitilt-advice');
  const icon = document.getElementById('antitilt-icon');
  overlay.classList.remove('hidden');
  advice.textContent = ADVICE[Math.floor(Math.random() * ADVICE.length)];
  icon.classList.add('shake');
  setTimeout(() => icon.classList.remove('shake'), 2000);
  updateTiltTimer();
  state.antitiltTimer = setInterval(() => {
    state.antitiltRemaining--;
    updateTiltTimer();
    if (state.antitiltRemaining <= 0) {
      clearInterval(state.antitiltTimer);
      state.antitiltActive = false;
      state.discipline = Math.max(30, state.discipline);
      overlay.classList.add('hidden');
      refresh();
    }
  }, 1000);
}

function updateTiltTimer() {
  const r = state.antitiltRemaining;
  const m = Math.floor(r / 60).toString().padStart(2, '0');
  const s = (r % 60).toString().padStart(2, '0');
  const el = document.getElementById('antitilt-countdown');
  if (el) el.textContent = `${m}:${s}`;
  const arc = document.getElementById('timer-arc');
  if (arc) {
    const pct = r / 120;
    arc.style.strokeDashoffset = 327 * (1 - pct);
  }
}

// ===== REFRESH UI =====
function refresh() {
  const stats = statsForEngines();
  const chi = new ChiSquareAnalyzer(state.spins);
  const score = scoreEng.calculate(state.spins);
  const chiScore = chi.sessionVarianceScore();
  const decision = selector.decide(state.spins, stats, state.selectedProfile);
  const phase = sessionEng.phase(stats, score);
  const phaseInfo = PHASES[phase];
  const exitScore = sessionEng.exitScore(stats, score);
  const lock = lockEng.check(stats);
  const exitSignal = lockEng.exitSignal(stats, score);
  const level = getLevel(state.streakSessions);
  const heatmap = chi.heatmap();
  const hot = chi.hotNumbers();
  const cold = chi.coldNumbers();
  const elScore = electronicEng.electronicScore(state.spins);

  // ---- Header ----
  document.getElementById('bankroll-display').textContent = fmt(state.currentBankroll);
  const pl = state.currentBankroll - state.startBankroll;
  const plEl = document.getElementById('session-pl');
  plEl.textContent = (pl >= 0 ? '+' : '') + fmt(pl);
  plEl.style.color = pl >= 0 ? 'var(--green)' : 'var(--red)';
  const pct = profitPct();
  const pctEl = document.getElementById('session-pct');
  pctEl.textContent = fmtPct(pct);
  pctEl.style.color = pct >= 0 ? 'var(--green)' : 'var(--red)';

  // X2 button
  const x2Btn = document.getElementById('x2-btn');
  x2Btn.classList.toggle('active', state.x2Mode);

  // ---- Mini stats ----
  document.getElementById('stat-wl').textContent = `${state.wins}/${state.losses}`;
  const wr = state.totalSpins > 0 ? Math.round(state.wins / state.totalSpins * 100) : 0;
  document.getElementById('stat-wr').textContent = `${wr}%`;
  const discEl = document.getElementById('stat-disc');
  discEl.textContent = Math.round(state.discipline);
  discEl.style.color = state.discipline >= 70 ? 'var(--green)' : state.discipline >= 40 ? 'var(--orange)' : 'var(--red)';
  const clEl = document.getElementById('stat-cl');
  clEl.textContent = state.consecutiveLosses;
  clEl.style.color = state.consecutiveLosses >= 2 ? 'var(--red)' : 'var(--text)';

  // ---- Exit signal ----
  const exitEl = document.getElementById('exit-signal');
  if (exitSignal) {
    exitEl.classList.remove('hidden');
    document.getElementById('exit-signal-text').textContent = exitSignal.msg;
  } else exitEl.classList.add('hidden');

  // ---- Profit lock ----
  const lockEl = document.getElementById('profit-lock-banner');
  if (lock.active) {
    lockEl.classList.remove('hidden');
    document.getElementById('profit-lock-text').textContent = `Profit protégé à ${lock.level}% — plancher: ${fmt(lock.floor)}`;
  } else lockEl.classList.add('hidden');

  // ---- Phase ----
  document.getElementById('phase-icon').textContent = phaseInfo.icon;
  document.getElementById('phase-name').textContent = phaseInfo.name;
  document.getElementById('phase-name').style.color = phaseInfo.color;
  document.getElementById('phase-instr').textContent = phaseInfo.instr;
  const progress = sessionEng.progress(stats, state.selectedProfile);
  document.getElementById('phase-pct').textContent = Math.round(progress) + '%';
  document.getElementById('pbar-fill').style.width = progress + '%';

  // ---- Gauge ----
  const arc = document.getElementById('gauge-arc');
  const circumference = 628.3;
  const offset = circumference * (1 - score / 100);
  arc.style.strokeDashoffset = offset;
  const gaugeColor = score >= 70 ? '#00E676' : score >= 40 ? '#FF9800' : '#E30613';
  arc.style.stroke = gaugeColor;
  const scoreEl = document.getElementById('gauge-score');
  scoreEl.textContent = Math.round(score);
  scoreEl.style.color = gaugeColor;
  document.getElementById('gauge-lbl').textContent = scoreEng.phrase(score);

  // ---- Decision card ----
  const card = document.getElementById('decision-card');
  card.className = 'decision-card ' + (decision.shouldPlay ? 'strike' : 'no-play');
  document.getElementById('decision-ico').textContent = decision.shouldPlay ? '⚡' : '⏸';
  const titleEl = document.getElementById('decision-title');
  titleEl.textContent = decision.shouldPlay ? 'STRIKE' : 'NO PLAY';
  titleEl.style.color = decision.shouldPlay ? 'var(--green)' : 'var(--muted)';
  document.getElementById('decision-sub').textContent = decision.rationale;

  const numsGrid = document.getElementById('nums-grid');
  numsGrid.innerHTML = '';
  decision.numbers.slice(0, 15).forEach(n => {
    const chip = document.createElement('div');
    chip.className = 'num-chip';
    chip.style.borderColor = getColor(n) === 'rouge' ? 'var(--red)' : getColor(n) === 'vert' ? 'var(--green)' : '#666';
    chip.style.color = getColor(n) === 'rouge' ? 'var(--red)' : getColor(n) === 'vert' ? 'var(--green)' : '#CCC';
    chip.textContent = n;
    numsGrid.appendChild(chip);
  });

  const footer = document.getElementById('decision-footer');
  if (decision.shouldPlay) {
    footer.innerHTML = `
      <div class="df-stat"><span class="df-val gold">${fmt(decision.stake)}</span><span class="df-lbl">MISE</span></div>
      <div class="df-stat"><span class="df-val green">+${fmt(decision.potentialGain)}</span><span class="df-lbl">GAIN POTENTIEL</span></div>
      <div class="df-stat"><span class="df-val">${decision.probability.toFixed(0)}%</span><span class="df-lbl">PROBABILITÉ</span></div>
      <div class="df-stat"><span class="df-val">${decision.riskLevel}</span><span class="df-lbl">RISQUE</span></div>`;
  } else {
    footer.innerHTML = `<div class="df-stat"><span class="df-val muted">Score: ${Math.round(score)}/100</span><span class="df-lbl">Minimum requis: ${PROFILES[state.selectedProfile].minScore}</span></div>`;
  }

  // ---- Profiles ----
  renderProfileBody(decision);

  // ---- Chi badge ----
  document.getElementById('chi-badge').textContent = `χ²: ${chi.chiSquare().toFixed(1)}`;

  // ---- Wheel heatmap ----
  renderWheelStrip(heatmap, hot, cold, decision.numbers, elScore);

  // ---- Analysis grid ----
  const pattern = electronicEng.temporalPattern(state.spins);
  const repScore = electronicEng.rapidRepetition(state.spins);
  document.getElementById('analysis-grid').innerHTML = `
    <div class="ag-item"><div class="ag-title">SCORE ÉLECTRONIQUE</div><div class="ag-val" style="color:${elScore.overall >= 60 ? 'var(--green)' : elScore.overall >= 30 ? 'var(--orange)' : 'var(--muted)'}">${Math.round(elScore.overall)}/100</div></div>
    <div class="ag-item"><div class="ag-title">MOTIF TEMPOREL</div><div class="ag-val" style="color:var(--orange)">${pattern.type}</div></div>
    <div class="ag-item"><div class="ag-title">RÉPÉTITION RAPIDE</div><div class="ag-val" style="color:${repScore >= 30 ? 'var(--green)' : 'var(--muted)'}">${Math.round(repScore)}/100</div></div>
    <div class="ag-item"><div class="ag-title">RAISON PRINCIPALE</div><div class="ag-val" style="font-size:11px;color:var(--muted)">${elScore.reason}</div></div>
  `;

  // ---- Spin grid ----
  renderSpinGrid(hot, cold, decision.numbers);

  // ---- History ----
  renderHistory(chi);

  // ---- Gamification ----
  document.getElementById('gm-streak').textContent = state.streakSessions;
  const discG = document.getElementById('gm-disc');
  discG.textContent = Math.round(state.discipline);
  discG.style.color = state.discipline >= 70 ? 'var(--green)' : state.discipline >= 40 ? 'var(--orange)' : 'var(--red)';
  document.getElementById('gm-level').textContent = level;
  const exitEl2 = document.getElementById('gm-exit');
  exitEl2.textContent = Math.round(exitScore);
  exitEl2.style.color = exitScore >= 70 ? 'var(--red)' : exitScore >= 40 ? 'var(--orange)' : 'var(--green)';

  // Check stops
  const { MoneyManagementEngine } = window.RK;
  const moneyEng = new MoneyManagementEngine();
  const stopCheck = moneyEng.checkStop(stats, state.selectedProfile);
  if (stopCheck.stop && !state.stopShown) {
    state.stopShown = true;
    if (stopCheck.type === 'success') showCelebration();
    else alert(`🛑 ARRÊTEZ : ${stopCheck.reason}`);
  }
}

function renderProfileBody(decision) {
  const p = PROFILES[state.selectedProfile];
  const isAuto = decision.autoProfile === state.selectedProfile;
  document.getElementById('profile-body').innerHTML = `
    <div class="profile-desc">${p.icon} ${p.desc} ${isAuto ? '<span class="auto-tag">AUTO</span>' : ''}</div>
    <div class="profile-metrics">
      <div class="pm-item"><div class="pm-val" style="color:${p.color}">${p.stakePct}‰</div><div class="pm-lbl">MISE BASE</div></div>
      <div class="pm-item"><div class="pm-val green">+${p.tp}%</div><div class="pm-lbl">TAKE PROFIT</div></div>
      <div class="pm-item"><div class="pm-val red">-${p.sl}%</div><div class="pm-lbl">STOP LOSS</div></div>
      <div class="pm-item"><div class="pm-val">${p.maxNums}</div><div class="pm-lbl">MAX NUMÉROS</div></div>
    </div>
  `;
}

function renderWheelStrip(heatmap, hot, cold, recommended, elScore) {
  const strip = document.getElementById('wheel-strip');
  strip.innerHTML = '';
  const lastNum = state.spins.length > 0 ? state.spins[state.spins.length - 1].number : -1;
  WHEEL_ORDER.forEach(n => {
    const cell = document.createElement('div');
    cell.className = 'wheel-cell';
    const h = heatmap[n];
    const isHot = hot.includes(n);
    const isCold = cold.includes(n);
    const isRec = recommended.includes(n);
    const isLast = n === lastNum;
    const isNeighbor = lastNum >= 0 && wheelDist(n, lastNum) <= 2 && n !== lastNum;
    let bg = '#1A1A1A', color = '#666', border = 'transparent', icon = '';
    if (isLast) { bg = '#3D3000'; color = '#FFD700'; border = '#FFD700'; icon = '⭐'; }
    else if (isRec && isHot) { bg = '#002200'; color = '#00E676'; border = '#00E676'; icon = '🔥'; }
    else if (isRec) { bg = '#001A00'; color = '#00AA55'; border = '#00AA55'; icon = '✓'; }
    else if (isHot) { bg = '#2A0808'; color = '#FF6B6B'; icon = '🔥'; }
    else if (isCold) { bg = '#081828'; color = '#4FC3F7'; icon = '❄'; }
    else if (isNeighbor) { bg = '#2A1800'; color = '#FF9800'; }
    cell.style.cssText = `background:${bg};color:${color};border-color:${border};`;
    cell.innerHTML = `<span class="wc-num">${n}</span><span class="wc-ico">${icon}</span>`;
    strip.appendChild(cell);
  });
}

function renderSpinGrid(hot, cold, recommended) {
  const grid = document.getElementById('spin-grid');
  if (grid.children.length === 37) {
    // Just update classes
    for (let n = 0; n <= 36; n++) {
      const btn = grid.querySelector(`[data-n="${n}"]`);
      if (!btn) continue;
      btn.className = `spin-btn ${getColor(n)}`;
      if (hot.includes(n)) btn.classList.add('hot');
      if (cold.includes(n)) btn.classList.add('cold');
      if (recommended.includes(n)) btn.classList.add('recommended');
      const lastN = state.spins.length > 0 ? state.spins[state.spins.length - 1].number : -1;
      if (n === lastN) btn.classList.add('last-hit');
    }
    return;
  }
  grid.innerHTML = '';

  // Zero row
  const zeroRow = document.createElement('div');
  zeroRow.className = 'zero-row';
  const zeroBtn = makeSpinBtn(0, hot, cold, recommended);
  zeroRow.appendChild(zeroBtn);
  grid.appendChild(zeroRow);

  // 3 rows: [3,6,9,...36], [2,5,8,...35], [1,4,7,...34]
  const rows = [
    Array.from({ length: 12 }, (_, i) => (i + 1) * 3),
    Array.from({ length: 12 }, (_, i) => (i + 1) * 3 - 1),
    Array.from({ length: 12 }, (_, i) => (i + 1) * 3 - 2)
  ];
  rows.forEach(row => {
    row.forEach(n => {
      grid.appendChild(makeSpinBtn(n, hot, cold, recommended));
    });
  });
}

function makeSpinBtn(n, hot, cold, recommended) {
  const btn = document.createElement('button');
  btn.className = `spin-btn ${getColor(n)}`;
  btn.dataset.n = n;
  if (hot.includes(n)) btn.classList.add('hot');
  if (cold.includes(n)) btn.classList.add('cold');
  if (recommended.includes(n)) btn.classList.add('recommended');
  const lastN = state.spins.length > 0 ? state.spins[state.spins.length - 1].number : -1;
  if (n === lastN) btn.classList.add('last-hit');
  btn.textContent = n;
  btn.addEventListener('click', () => addSpin(n));
  return btn;
}

function renderHistory(chi) {
  const scroll = document.getElementById('history-scroll');
  scroll.innerHTML = '';
  const recent = state.spins.slice(-20).reverse();
  recent.forEach((s, i) => {
    const chip = document.createElement('div');
    chip.className = `hist-chip ${s.color} ${i === 0 ? 'latest' : ''}`;
    const hot = chi.hotNumbers();
    const cold = chi.coldNumbers();
    const ico = hot.includes(s.number) ? '🔥' : cold.includes(s.number) ? '❄' : '';
    chip.innerHTML = `<span class="hist-ico">${ico}</span><span class="hist-num">${s.number}</span><span class="hist-pos">#${i + 1}</span>`;
    scroll.appendChild(chip);
  });

  const rouge = state.spins.filter(s => s.color === 'rouge').length;
  const noir = state.spins.filter(s => s.color === 'noir').length;
  const vert = state.spins.filter(s => s.color === 'vert').length;
  document.getElementById('history-stats').innerHTML = `
    <div class="hs-item"><div class="hs-val red">${rouge}</div><div class="hs-lbl">ROUGE</div></div>
    <div class="hs-item"><div class="hs-val">${noir}</div><div class="hs-lbl">NOIR</div></div>
    <div class="hs-item"><div class="hs-val green">${vert}</div><div class="hs-lbl">ZÉRO</div></div>
    <div class="hs-item"><div class="hs-val gold">${state.spins.length}</div><div class="hs-lbl">TOTAL</div></div>
  `;
}

// ===== CELEBRATION =====
function showCelebration() {
  const wr = state.totalSpins > 0 ? (state.wins / state.totalSpins * 100).toFixed(0) : 0;
  const profit = state.currentBankroll - state.startBankroll;
  document.getElementById('celebration-stats').innerHTML = `
    <div style="font-size:22px;font-weight:900;color:var(--gold)">${fmt(profit)}</div>
    <div style="color:var(--muted);font-size:14px">Win Rate: ${wr}% · Spins: ${state.totalSpins} · Discipline: ${Math.round(state.discipline)}</div>
  `;
  document.getElementById('celebration-overlay').classList.remove('hidden');
}

// ===== GETTERS FOR LEVEL =====
function getLevel(streak) {
  if (streak >= 15) return 'KILLER';
  if (streak >= 7) return 'ELITE';
  if (streak >= 3) return 'PRO';
  return 'ROOKIE';
}

// ===== ACTIONS =====
function selectProfile(profile) {
  state.selectedProfile = profile;
  state.stopShown = false;
  ['defense', 'equilibre', 'attaque'].forEach(p => {
    document.getElementById(`ptab-${p}`).classList.toggle('active', p === profile);
  });
  save();
  refresh();
}

function toggleX2() {
  state.x2Mode = !state.x2Mode;
  save();
  refresh();
}

// ===== SETTINGS =====
function openSettings() {
  document.getElementById('settings-bankroll').textContent = fmt(state.currentBankroll);
  const pl = state.currentBankroll - state.startBankroll;
  const badge = document.getElementById('settings-profit-badge');
  badge.textContent = (pl >= 0 ? '+' : '') + fmt(pl) + ' (' + fmtPct(profitPct()) + ')';
  badge.style.background = pl >= 0 ? '#002200' : '#220000';
  badge.style.color = pl >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('bankroll-input').value = '';
  document.getElementById(`mm-${state.moneyMode.replace('_', '-')}`).checked = true;
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function setAmount(amount) {
  document.getElementById('bankroll-input').value = amount;
}

function applySettings() {
  const val = parseFloat(document.getElementById('bankroll-input').value);
  if (!isNaN(val) && val > 0) {
    state.startBankroll = val;
    state.currentBankroll = val;
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  }
  const modes = ['safe', 'adaptatif', 'attaque_max'];
  for (const m of modes) {
    const el = document.getElementById(`mm-${m.replace('_', '-')}`);
    if (el && el.checked) { state.moneyMode = m; break; }
  }
  state.stopShown = false;
  save();
  closeSettings();
  refresh();
}

// ===== NEW SESSION =====
function newSession() {
  if (state.currentBankroll > state.startBankroll) state.streakSessions++;
  else if (state.currentBankroll < state.startBankroll) state.streakSessions = 0;
  state.spins = [];
  state.wins = 0;
  state.losses = 0;
  state.totalSpins = 0;
  state.consecutiveLosses = 0;
  state.consecutiveWins = 0;
  state.discipline = 100;
  state.startBankroll = state.currentBankroll;
  state.stopShown = false;
  document.getElementById('celebration-overlay').classList.add('hidden');
  closeSettings();
  save();
  refresh();
}

// ===== RESET =====
function confirmReset() {
  if (confirm('Réinitialiser la session ? La bankroll sera remise à zéro.')) {
    Object.assign(state, {
      spins: [], wins: 0, losses: 0, totalSpins: 0,
      consecutiveLosses: 0, consecutiveWins: 0, discipline: 100,
      startBankroll: 1000, currentBankroll: 1000, streakSessions: 0, stopShown: false
    });
    save();
    refresh();
  }
}

// ===== BACKTEST =====
function openBacktest() {
  document.getElementById('backtest-info').textContent = `Simulation sur ${Math.min(50, state.spins.length)} spinss · Bankroll: ${fmt(state.currentBankroll)}`;
  document.getElementById('backtest-results').innerHTML = '';
  document.getElementById('backtest-modal').classList.remove('hidden');
}

function closeBacktest() {
  document.getElementById('backtest-modal').classList.add('hidden');
}

function runBacktest() {
  if (state.spins.length < 15) {
    alert('Minimum 15 spins requis pour la simulation.');
    return;
  }
  const engine = new BacktestEngine();
  const results = engine.run(state.spins, state.currentBankroll).sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi));
  const container = document.getElementById('backtest-results');
  container.innerHTML = '<div class="backtest-results-grid">' +
    results.map((r, i) => {
      const p = PROFILES[r.profile];
      const roiVal = parseFloat(r.roi);
      return `
        <div class="btr-card ${i === 0 ? 'best' : ''}">
          <div class="btr-header">
            <span class="btr-name" style="color:${p.color}">${p.icon} ${p.name} ${i === 0 ? '🏆' : ''}</span>
            <span class="btr-roi" style="color:${roiVal >= 0 ? 'var(--green)' : 'var(--red)'}">${roiVal >= 0 ? '+' : ''}${r.roi}%</span>
          </div>
          <div class="btr-metrics">
            <div class="btr-metric"><div class="btr-mval">${r.winRate}%</div><div class="btr-mlbl">Win Rate</div></div>
            <div class="btr-metric"><div class="btr-mval red">${r.maxDrawdown}%</div><div class="btr-mlbl">Max DD</div></div>
            <div class="btr-metric"><div class="btr-mval">${r.trades}</div><div class="btr-mlbl">Trades</div></div>
          </div>
        </div>`;
    }).join('') + '</div>';
}

// ===== INIT =====
function init() {
  load();
  buildSpinGrid();
  refresh();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function buildSpinGrid() {
  // Spin grid built dynamically in renderSpinGrid on first call
}

document.addEventListener('DOMContentLoaded', init);
