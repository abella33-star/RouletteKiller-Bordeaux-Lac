'use strict';

// ===== CONSTANTS =====
const SIGNAL_TIMEOUT   = 300;  // seconds until SIGNAL_EXPIRED (5 min)
const SIGNAL_WARN_AT   = 240;  // seconds: show warning banner (last 60 s)
const SIGNAL_WARN_VIBE = 60;   // vibrate at this threshold too

// ===== STATE =====
let state = {
  spins: [],
  startBankroll: 1000,
  currentBankroll: 1000,
  initialDeposit: 1000,     // First bankroll ever set (Take Profit reference)
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
  antitiltRemaining: 120,
  victoryShown: false,      // prevent repeat victory modal
  // --- Signal expiry ---
  signalExpired: false,
  lastSpinTimestamp: 0,    // ms epoch; 0 = no spin yet
  idleSeconds: 0,          // live counter (seconds since last spin)
  idleTimer: null          // setInterval handle
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
      initialDeposit: state.initialDeposit,
      wins: state.wins,
      losses: state.losses,
      totalSpins: state.totalSpins,
      consecutiveLosses: state.consecutiveLosses,
      consecutiveWins: state.consecutiveWins,
      discipline: state.discipline,
      moneyMode: state.moneyMode,
      selectedProfile: state.selectedProfile,
      x2Mode: state.x2Mode,
      streakSessions: state.streakSessions,
      lastSpinTimestamp: state.lastSpinTimestamp,
      signalExpired: state.signalExpired,
      victoryShown: state.victoryShown
    }));
  } catch (e) {}
}

function load() {
  try {
    const raw = localStorage.getItem('rk_state');
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    // Recompute idle seconds from wall clock (handles app reload / background)
    if (state.lastSpinTimestamp > 0) {
      state.idleSeconds = Math.floor((Date.now() - state.lastSpinTimestamp) / 1000);
      if (state.idleSeconds >= SIGNAL_TIMEOUT) {
        state.signalExpired = true;
      }
    }
  } catch (e) {}
}

// ===== SIGNAL EXPIRY TIMER =====
function startIdleTimer() {
  clearInterval(state.idleTimer);
  // Recompute from timestamp so timer stays accurate after tab switch / reload
  state.idleSeconds = state.lastSpinTimestamp > 0
    ? Math.floor((Date.now() - state.lastSpinTimestamp) / 1000)
    : 0;
  state.idleTimer = setInterval(() => {
    if (state.antitiltActive) return;   // pause ticking during anti-tilt lock
    state.idleSeconds = state.lastSpinTimestamp > 0
      ? Math.floor((Date.now() - state.lastSpinTimestamp) / 1000)
      : 0;
    updateIdleWarning();
    if (state.idleSeconds >= SIGNAL_TIMEOUT && !state.signalExpired) {
      expireSignal();
    }
  }, 1000);
}

function resetIdleTimer() {
  state.lastSpinTimestamp = Date.now();
  state.idleSeconds = 0;
  state.signalExpired = false;
  startIdleTimer();
  document.getElementById('signal-expired-overlay').classList.add('hidden');
  updateIdleWarning();
}

function stopIdleTimer() {
  clearInterval(state.idleTimer);
  state.idleTimer = null;
}

function expireSignal() {
  state.signalExpired = true;
  stopIdleTimer();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
  const overlay = document.getElementById('signal-expired-overlay');
  const elapsed = document.getElementById('se-elapsed');
  const m = Math.floor(state.idleSeconds / 60).toString().padStart(2, '0');
  const s = (state.idleSeconds % 60).toString().padStart(2, '0');
  elapsed.textContent = `Aucun spin depuis ${m}:${s}`;
  overlay.classList.remove('hidden');
  document.getElementById('idle-warning').classList.add('hidden');
  save();
}

function updateIdleWarning() {
  const banner = document.getElementById('idle-warning');
  if (state.signalExpired || state.lastSpinTimestamp === 0 || state.spins.length === 0) {
    banner.classList.add('hidden');
    return;
  }
  const idle = state.idleSeconds;
  if (idle < SIGNAL_WARN_AT) {
    banner.classList.add('hidden');
    return;
  }
  banner.classList.remove('hidden');
  const remaining = SIGNAL_TIMEOUT - idle;
  const rm = Math.floor(remaining / 60).toString().padStart(2, '0');
  const rs = (remaining % 60).toString().padStart(2, '0');
  const elapsed = idle;
  const em = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const es = (elapsed % 60).toString().padStart(2, '0');
  document.getElementById('idle-warning-title').textContent = 'INACTIVITÉ — SIGNAL MENACÉ';
  document.getElementById('idle-warning-sub').textContent = `Dernier spin il y a ${em}:${es}`;
  document.getElementById('idle-countdown').textContent = `${rm}:${rs}`;
  // One-time haptic when entering the warning zone
  if (idle === SIGNAL_WARN_AT && navigator.vibrate) navigator.vibrate([100, 50, 100]);
}

// ===== SIGNAL EXPIRED ACTIONS =====
function resumeWithClear() {
  // Hard reset: discard all spins, back to calibration
  state.spins = [];
  state.wins = 0;
  state.losses = 0;
  state.totalSpins = 0;
  state.consecutiveLosses = 0;
  state.consecutiveWins = 0;
  state.discipline = 100;
  state.stopShown = false;
  state.signalExpired = false;
  state.lastSpinTimestamp = 0;
  state.idleSeconds = 0;
  if (window.alphaEngine) window.alphaEngine.buffer.clear();
  document.getElementById('signal-expired-overlay').classList.add('hidden');
  stopIdleTimer();
  save();
  refresh();
  triggerAlpha();
}

function resumeWithHistory() {
  // Soft resume: keep history but restart the idle timer
  state.signalExpired = false;
  state.lastSpinTimestamp = Date.now();
  state.idleSeconds = 0;
  document.getElementById('signal-expired-overlay').classList.add('hidden');
  startIdleTimer();
  save();
  refresh();
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
  if (state.antitiltActive || state.signalExpired) return;

  const color = getColor(number);
  const zone = getZone(number);
  const spin = { number, color, zone, timestamp: Date.now() };
  state.spins.push(spin);
  state.totalSpins++;

  // Reset the idle/expiry timer on every new spin
  resetIdleTimer();

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

  // Push to Alpha engine buffer
  if (window.alphaEngine) window.alphaEngine.push(spin);

  save();
  refresh();
  triggerAlpha();
  triggerBordeaux();
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
  checkTakeProfit();
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
  // Phase: override with signal_expired when applicable
  const phase = state.signalExpired ? 'signal_expired' : sessionEng.phase(stats, score);
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
    state.initialDeposit = val;   // lock the Take-Profit reference
    state.victoryShown = false;
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
  state.signalExpired = false;
  state.lastSpinTimestamp = 0;
  state.idleSeconds = 0;
  if (window.alphaEngine) window.alphaEngine.buffer.clear();
  stopIdleTimer();
  document.getElementById('celebration-overlay').classList.add('hidden');
  document.getElementById('signal-expired-overlay').classList.add('hidden');
  document.getElementById('idle-warning').classList.add('hidden');
  closeSettings();
  save();
  refresh();
}

// ===== RESET =====
function confirmReset() {
  if (confirm('Réinitialiser la session ? La bankroll sera remise à zéro.')) {
    stopIdleTimer();
    Object.assign(state, {
      spins: [], wins: 0, losses: 0, totalSpins: 0,
      consecutiveLosses: 0, consecutiveWins: 0, discipline: 100,
      startBankroll: 1000, currentBankroll: 1000, streakSessions: 0, stopShown: false,
      signalExpired: false, lastSpinTimestamp: 0, idleSeconds: 0
    });
    document.getElementById('signal-expired-overlay').classList.add('hidden');
    document.getElementById('idle-warning').classList.add('hidden');
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

// ===== ALPHA-PREDATOR ENGINE RENDERING =====

function renderAlpha(result) {
  if (!result) return;

  const statusRaw = result.status.toLowerCase();
  const conf      = result.confidence;
  const phase     = (result.phase || '').toLowerCase();
  const r         = result.recommendation || {};

  // Colour palette per status
  const color = statusRaw === 'play' ? '#00E676' : statusRaw === 'noise' ? '#E30613' : '#555';

  // Status pill
  const pill = document.getElementById('ap-status-pill');
  pill.textContent = result.status;
  pill.className   = `ap-status-pill ${statusRaw}`;

  // Confidence bar
  document.getElementById('ap-bar-fill').style.cssText = `width:${conf}%;background:${color}`;
  const confEl = document.getElementById('ap-conf');
  confEl.textContent = `${conf}%`;
  confEl.style.color = color;

  // Phase tag
  const phaseEl = document.getElementById('ap-phase');
  phaseEl.textContent = phase ? phase.toUpperCase() : '';
  phaseEl.className = `ap-phase-tag ${phase}`;

  // Target
  const targEl = document.getElementById('ap-target');
  targEl.textContent   = r.target || '—';
  targEl.style.color   = statusRaw === 'play' ? 'var(--green)' : statusRaw === 'noise' ? 'var(--red)' : 'var(--text)';

  // Bet value + gain
  const betEl  = document.getElementById('ap-bet');
  const gainEl = document.getElementById('ap-gain');
  if (r.bet_value > 0) {
    betEl.textContent  = `${fmt(r.bet_value)} (${r.num_bets}×${fmt(r.bet_per_split)})`;
    gainEl.textContent = result.potential_gain > 0 ? `+${fmt(result.potential_gain)}` : '—';
    gainEl.style.color = result.potential_gain > 0 ? 'var(--green)' : 'var(--muted)';
  } else {
    betEl.textContent  = '—';
    gainEl.textContent = '—';
    gainEl.style.color = 'var(--muted)';
  }

  // Smart Splits section
  const splitsSection = document.getElementById('ap-splits-section');
  const splitsContainer = document.getElementById('ap-splits');
  splitsContainer.innerHTML = '';
  if (r.splits && r.splits.length > 0 && statusRaw === 'play') {
    splitsSection.classList.remove('hidden');
    r.splits.forEach(s => {
      const chip = document.createElement('span');
      chip.className = 'ap-split-chip' + (s.includes('plein') ? ' plein' : '');
      chip.textContent = s;
      splitsContainer.appendChild(chip);
    });
    document.getElementById('ap-splits-note').textContent =
      `${r.bet_per_split > 0 ? fmt(r.bet_per_split) : '—'} par mise · ${r.num_bets} positions couvertes`;
  } else {
    splitsSection.classList.add('hidden');
  }

  // Chi-square indicators
  _renderChiVal('ap-chi-color-val', result.colorTest);
  _renderChiVal('ap-chi-parity-val', result.parityTest);

  // Mechanical offset
  const offEl = document.getElementById('ap-offset-val');
  const off   = result.offsetAnalysis;
  if (off && off.detected) {
    offEl.textContent  = `~${off.center} cases ×${off.count}`;
    offEl.className    = 'ap-chi-val active';
    document.getElementById('ap-offset-item').style.background = 'rgba(255,152,0,0.05)';
  } else if (off && off.total >= 3) {
    offEl.textContent  = `Aucun (${off.total} spins)`;
    offEl.className    = 'ap-chi-val';
  } else {
    offEl.textContent  = '< 3 spins';
    offEl.className    = 'ap-chi-val';
  }

  // Sector Z-bars
  const secContainer = document.getElementById('ap-sectors');
  secContainer.innerHTML = '';
  const sectorLabels = { voisins: 'Voisins (17)', tiers: 'Tiers (12)', orphelins: 'Orphelins (8)' };
  if (result.sectors) {
    for (const [key, data] of Object.entries(result.sectors)) {
      const Z   = data.Z;
      const pct = Math.min(100, Math.max(0, (Z / 3) * 100));
      const fc  = Z < 0 ? '#333' : Z < 1 ? '#555' : Z < 2 ? 'var(--orange)' : 'var(--green)';
      const row = document.createElement('div');
      row.className = 'ap-s-row';
      row.innerHTML = `
        <span class="ap-s-name">${sectorLabels[key] || key}</span>
        <div class="ap-s-track"><div class="ap-s-fill" style="width:${Math.max(0,pct)}%;background:${fc}"></div></div>
        <span class="ap-s-z" style="color:${Z>=2?'var(--green)':Z>=1?'var(--orange)':'var(--muted)'}">${Z>=0?'+':''}${Z.toFixed(2)}σ</span>
        <span class="ap-s-post">${(data.posterior*100).toFixed(0)}%</span>`;
      secContainer.appendChild(row);
    }
  }

  // Reason
  const reasonEl = document.getElementById('ap-reason');
  reasonEl.textContent = result.reason;
  reasonEl.className   = `ap-reason ${statusRaw}`;

  // Buffer info
  if (window.alphaEngine) {
    const n = window.alphaEngine.buffer.length;
    document.getElementById('ap-buf-info').textContent = `Buffer: ${n}/36 spins`;
  }

  // Latency
  const latTag = document.getElementById('ap-latency');
  if (result.latency !== undefined) {
    latTag.textContent = `${result.latency}ms`;
    latTag.style.color = result.latency < 20 ? 'var(--green)' : result.latency < 50 ? 'var(--orange)' : 'var(--red)';
  }
}

function _renderChiVal(elId, test) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!test) { el.textContent = 'p=—'; el.className = 'ap-chi-val'; return; }
  el.textContent = `p=${test.pValue.toFixed(3)}`;
  el.className   = `ap-chi-val ${test.isNoise ? 'noise' : 'ok'}`;
}

function triggerAlpha() {
  if (!window.alphaEngine) return;
  const profit = state.currentBankroll - state.startBankroll;
  window.alphaEngine
    .analyze(state.currentBankroll, state.initialDeposit, profit)
    .then(renderAlpha)
    .catch(() => {});
}

// ===== TAKE PROFIT — CIRCUIT BREAKER =====

/**
 * Check if bankroll has reached 4× the initial deposit.
 * Called after every recordResult().
 */
function checkTakeProfit() {
  if (state.victoryShown) return;
  if (state.initialDeposit <= 0) return;
  if (state.currentBankroll >= state.initialDeposit * 4) {
    state.victoryShown = true;
    showVictoryOverlay();
  }
}

function showVictoryOverlay() {
  const profit  = state.currentBankroll - state.initialDeposit;
  const mult    = (state.currentBankroll / state.initialDeposit).toFixed(2);
  const wlRatio = state.losses > 0 ? (state.wins / state.losses).toFixed(2) : '∞';
  document.getElementById('victory-stats').innerHTML =
    `<div>Dépôt initial <strong>${fmt(state.initialDeposit)}</strong></div>` +
    `<div>Bankroll actuelle <strong class="gold">${fmt(state.currentBankroll)}</strong></div>` +
    `<div>Profit net <strong style="color:var(--green)">+${fmt(profit)}</strong></div>` +
    `<div>Multiplicateur <strong class="gold">×${mult}</strong></div>` +
    `<div>Ratio V/L <strong>${wlRatio}</strong></div>`;
  const ov = document.getElementById('victory-overlay');
  ov.classList.remove('hidden');
  if (navigator.vibrate) navigator.vibrate([100,50,100,50,200,100,500]);
  save();
}

function acknowledgeVictory() {
  document.getElementById('victory-overlay').classList.add('hidden');
  newSession();
}

function continueAfterVictory() {
  document.getElementById('victory-overlay').classList.add('hidden');
}

// ===== RESET CYCLE =====

/**
 * Clears the spin history (machine changed behaviour).
 * Does NOT touch bankroll.
 */
function resetCycle() {
  state.spins             = [];
  state.totalSpins        = 0;
  state.consecutiveLosses = 0;
  state.consecutiveWins   = 0;
  state.signalExpired     = false;
  state.lastSpinTimestamp = 0;
  state.idleSeconds       = 0;
  stopIdleTimer();
  if (window.alphaEngine)   window.alphaEngine.buffer.clear();
  document.getElementById('signal-expired-overlay').classList.add('hidden');
  document.getElementById('idle-warning').classList.add('hidden');
  // Reset alpha card display
  renderAlpha({ status:'WAIT', confidence:0,
    recommendation:{ target:'—', type:'Cycle effacé', splits:[], bet_per_split:0, bet_value:0, num_bets:0 },
    reason:'Cycle effacé — historique remis à zéro. Attente de nouveaux spins.',
    potential_gain:0, phase:'—', sectors:null, colorTest:null, parityTest:null, offsetAnalysis:null, latency:0 });
  if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
  save();
  refresh();
}

// ===== BORDEAUX ENGINE RENDERING =====
function renderBordeaux(result) {
  if (!result) return;

  const sig = result.signal.toLowerCase();
  const conf = result.confidence;
  const barColor = sig === 'high' ? '#00E676' : sig === 'medium' ? '#FF9800' : sig === 'noise' ? '#E30613' : '#555';

  // Dot
  const dot = document.getElementById('bx-dot');
  dot.className = `bx-dot ${sig}`;

  // Signal label
  const lbl = document.getElementById('bx-signal-lbl');
  const labelText = { high: 'HIGH ⚡', medium: 'MEDIUM', low: 'LOW', noise: 'NOISE 🚫' };
  lbl.textContent = labelText[sig] || sig;
  lbl.className = `bx-signal-lbl ${sig}`;

  // Confidence bar
  document.getElementById('bx-bar-fill').style.cssText = `width:${conf}%;background:${barColor}`;
  const confEl = document.getElementById('bx-conf-val');
  confEl.textContent = `${conf}%`;
  confEl.style.color = barColor;

  // Details
  document.getElementById('bx-target').textContent = result.target;
  document.getElementById('bx-target').style.color = sig === 'noise' ? 'var(--red)' : sig === 'high' ? 'var(--green)' : 'var(--text)';
  document.getElementById('bx-bet').textContent = result.bet_units > 0 ? fmt(result.bet_units) : '—';
  const ct = result.colorTest;
  const pEl = document.getElementById('bx-pval');
  if (ct) {
    pEl.textContent = `p=${ct.pValue.toFixed(3)}`;
    pEl.style.color = ct.isNoise ? 'var(--red)' : 'var(--green)';
  } else {
    pEl.textContent = 'p=—';
    pEl.style.color = 'var(--muted)';
  }

  // Per-sector Z-score bars
  const secContainer = document.getElementById('bx-sectors');
  secContainer.innerHTML = '';
  const sectorLabels = { voisins: 'Voisins (17)', tiers: 'Tiers (12)', orphelins: 'Orphelins (8)' };
  if (result.sectors) {
    for (const [key, data] of Object.entries(result.sectors)) {
      const Z = data.Z;
      const pct = Math.min(100, Math.max(0, (Z / 3) * 100)); // map 0–3σ to 0–100%
      const fillClass = Z < 0 ? 'bx-z-neg' : Z < 1 ? 'bx-z-pos-low' : Z < 2 ? 'bx-z-pos-mid' : 'bx-z-pos-high';
      const row = document.createElement('div');
      row.className = 'bx-sector-row';
      row.innerHTML = `
        <span class="bx-sector-name">${sectorLabels[key] || key}</span>
        <div class="bx-z-track"><div class="bx-z-fill ${fillClass}" style="width:${Math.max(0,pct)}%"></div></div>
        <span class="bx-z-val" style="color:${Z>=2?'var(--green)':Z>=1?'var(--orange)':'var(--muted)'}">${Z>=0?'+':''}${Z.toFixed(2)}σ</span>
        <span class="bx-bayes">${(data.posterior*100).toFixed(0)}%</span>`;
      secContainer.appendChild(row);
    }
  }

  // Reason
  const reasonEl = document.getElementById('bx-reason');
  reasonEl.textContent = result.reason;
  reasonEl.className = `bx-reason ${sig}`;

  // Latency tag
  const latTag = document.getElementById('bx-latency');
  if (result.latency !== undefined) {
    latTag.textContent = `${result.latency}ms`;
    latTag.style.color = result.latency < 20 ? 'var(--green)' : result.latency < 50 ? 'var(--orange)' : 'var(--red)';
  }
}

// Trigger Bordeaux analysis (async, non-blocking)
function triggerBordeaux() {
  if (!window.bordeauxEngine) return;
  window.bordeauxEngine.analyze(state.spins, state.currentBankroll)
    .then(renderBordeaux)
    .catch(() => {});
}

// ===== INIT =====
function init() {
  load();
  buildSpinGrid();
  // Restore idle timer if session was active (spins present and not expired)
  if (state.lastSpinTimestamp > 0 && !state.signalExpired) {
    startIdleTimer();
  }
  // Show expired overlay immediately if state was already expired on load
  if (state.signalExpired) {
    const m = Math.floor(state.idleSeconds / 60).toString().padStart(2, '0');
    const s = (state.idleSeconds % 60).toString().padStart(2, '0');
    const elapsed = document.getElementById('se-elapsed');
    if (elapsed) elapsed.textContent = `Aucun spin depuis ${m}:${s}`;
    document.getElementById('signal-expired-overlay').classList.remove('hidden');
  }
  // Rebuild Alpha CircularBuffer from persisted spin history
  if (window.alphaEngine && state.spins.length > 0) {
    window.alphaEngine.syncFromArray(state.spins);
  }
  refresh();
  triggerAlpha();
  triggerBordeaux();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function buildSpinGrid() {
  // Spin grid built dynamically in renderSpinGrid on first call
}

document.addEventListener('DOMContentLoaded', init);
