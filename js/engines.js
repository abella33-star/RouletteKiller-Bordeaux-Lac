'use strict';

// ===== CONSTANTS =====
const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

const ZONES = {
  voisins: [0,2,3,4,7,12,15,18,19,21,22,25,26,28,29,32,35],
  tiers: [5,8,10,11,13,16,23,24,27,30,33,36],
  zero: [0,3,12,26,32,35]
};

function getColor(n) {
  if (n === 0) return 'vert';
  return RED_NUMBERS.includes(n) ? 'rouge' : 'noir';
}

function getZone(n) {
  if (ZONES.zero.includes(n)) return 'zero';
  if (ZONES.voisins.includes(n)) return 'voisins';
  if (ZONES.tiers.includes(n)) return 'tiers';
  return 'orphelins';
}

function getWheelPos(n) { return WHEEL_ORDER.indexOf(n); }

function wheelDist(a, b) {
  const d = Math.abs(getWheelPos(a) - getWheelPos(b));
  return Math.min(d, 37 - d);
}

// ===== CHI-SQUARE ANALYZER =====
class ChiSquareAnalyzer {
  constructor(spins) { this.spins = spins; }

  chiSquare(windowSize = 37) {
    const recent = this.spins.slice(-windowSize);
    if (recent.length < 10) return 0;
    const counts = new Array(37).fill(0);
    recent.forEach(s => counts[s.number]++);
    const exp = recent.length / 37;
    return counts.reduce((sum, c) => sum + Math.pow(c - exp, 2) / exp, 0);
  }

  anomalyScore() {
    const chi2 = this.chiSquare();
    if (chi2 < 25) return (chi2 / 25) * 30;
    if (chi2 < 50) return 30 + ((chi2 - 25) / 25) * 30;
    if (chi2 < 80) return 60 + ((chi2 - 50) / 30) * 30;
    return Math.min(100, 90 + ((chi2 - 80) / 20) * 10);
  }

  hotNumbers(windowSize = 37) {
    const recent = this.spins.slice(-windowSize);
    const counts = new Array(37).fill(0);
    recent.forEach(s => counts[s.number]++);
    const threshold = (recent.length / 37) * 2;
    return counts.map((c, i) => ({ n: i, c })).filter(x => x.c >= threshold).map(x => x.n);
  }

  coldNumbers(windowSize = 37) {
    const recent = this.spins.slice(-windowSize);
    const seen = new Set(recent.map(s => s.number));
    return Array.from({ length: 37 }, (_, i) => i).filter(n => !seen.has(n));
  }

  heatmap() {
    const counts = new Array(37).fill(0);
    this.spins.forEach(s => counts[s.number]++);
    const exp = this.spins.length / 37 || 1;
    return counts.map((c, i) => ({ number: i, count: c, deviation: ((c - exp) / exp) * 100 }));
  }

  sessionVarianceScore() {
    const w = (ws) => {
      const r = this.spins.slice(-ws);
      if (r.length < 5) return 0;
      const counts = new Array(37).fill(0);
      r.forEach(s => counts[s.number]++);
      const e = r.length / 37;
      return counts.reduce((s, c) => s + Math.pow(c - e, 2) / e, 0);
    };
    const normalize = v => Math.min(100, (v / 80) * 100);
    return normalize(w(37)) * 0.5 + normalize(w(74)) * 0.3 + normalize(w(111)) * 0.2;
  }
}

// ===== ELECTRONIC ROULETTE ANALYZER =====
class ElectronicRouletteAnalyzer {
  constructor() {
    this.sectors = [];
    for (let i = 0; i < 9; i++) this.sectors.push(WHEEL_ORDER.slice(i * 4, i * 4 + 4));
    this.sectors.push([WHEEL_ORDER[36], WHEEL_ORDER[0], WHEEL_ORDER[1], WHEEL_ORDER[2]]);
  }

  sectorBias(spins) {
    const recent = spins.slice(-Math.min(37, spins.length));
    return this.sectors.map((sector, idx) => {
      const obs = recent.filter(s => sector.includes(s.number)).length;
      const obsFreq = obs / (recent.length || 1) * 100;
      const expFreq = (sector.length / 37) * 100;
      const bias = (obsFreq - expFreq) / expFreq * 100;
      return { idx, numbers: sector, obsFreq, expFreq, bias, direction: bias > 40 ? 'hot' : bias < -40 ? 'cold' : 'neutral' };
    });
  }

  temporalPattern(spins) {
    const recent = spins.slice(-16);
    if (recent.length < 8) return { confidence: 0, type: 'AUCUN', predicted: [] };
    const colors = recent.map(s => s.color);
    let alt = 0;
    for (let i = 1; i < colors.length; i++) if (colors[i] !== colors[i - 1] && colors[i] !== 'vert' && colors[i - 1] !== 'vert') alt++;
    const altRate = alt / (colors.length - 1);
    const positions = recent.map(s => getWheelPos(s.number));
    let neighborReps = 0;
    for (let i = 1; i < positions.length; i++) {
      const d = Math.abs(positions[i] - positions[i - 1]);
      if (Math.min(d, 37 - d) <= 3) neighborReps++;
    }
    if (altRate > 0.75) return { confidence: 72, type: 'ALTERNANCE', predicted: this.neighbors(recent[recent.length - 1]?.number || 0) };
    if (neighborReps > recent.length * 0.4) return { confidence: 68, type: 'RÉPÉTITION', predicted: this.neighbors(recent[recent.length - 1]?.number || 0) };
    return { confidence: 20, type: 'AUCUN', predicted: [] };
  }

  neighbors(n) {
    const pos = getWheelPos(n);
    return [-2, -1, 1, 2].map(i => WHEEL_ORDER[((pos + i) + 37) % 37]);
  }

  rapidRepetition(spins) {
    if (spins.length < 3) return 0;
    const last3 = spins.slice(-3);
    let score = 0;
    for (let i = 1; i < last3.length; i++) {
      const d = wheelDist(last3[i].number, last3[i - 1].number);
      if (d === 0) score += 30;
      else if (d <= 2) score += 20;
      else if (d <= 5) score += 10;
    }
    return Math.min(100, score);
  }

  electronicScore(spins) {
    if (spins.length < 5) return { sectorScore: 0, temporalScore: 0, overall: 0, numbers: [], reason: 'Données insuffisantes' };
    const biases = this.sectorBias(spins);
    const hot = biases.filter(b => b.direction === 'hot');
    const sectorScore = hot.length > 0 ? Math.min(100, hot.reduce((s, b) => s + Math.abs(b.bias), 0) / hot.length) : 0;
    const pattern = this.temporalPattern(spins);
    const temporalScore = pattern.confidence;
    const overall = sectorScore * 0.6 + temporalScore * 0.4;
    const numbers = [...new Set(hot.flatMap(b => b.numbers))].slice(0, 8);
    let reason = 'Marché neutre';
    if (sectorScore > 60) reason = 'Biais sectoriel détecté';
    else if (temporalScore > 60) reason = `Motif ${pattern.type}`;
    return { sectorScore, temporalScore, overall, numbers, reason };
  }
}

// ===== OPPORTUNITY SCORE ENGINE =====
class OpportunityScoreEngine {
  calculate(spins) {
    if (spins.length < 5) return 0;
    const chi = new ChiSquareAnalyzer(spins);
    const momentum = this._momentum(spins);
    const clustering = this._clustering(spins);
    const anomaly = chi.anomalyScore();
    return Math.min(100, momentum * 0.4 + clustering * 0.3 + anomaly * 0.3);
  }

  _momentum(spins) {
    const r10 = spins.slice(-10), r8 = spins.slice(-8);
    let score = 0;
    const numMap = {};
    r10.forEach(s => { numMap[s.number] = (numMap[s.number] || 0) + 1; });
    score += Math.min(50, Object.values(numMap).filter(c => c > 1).length * 12);
    const zoneMap = {};
    r8.forEach(s => { zoneMap[s.zone] = (zoneMap[s.zone] || 0) + 1; });
    const maxZ = Math.max(0, ...Object.values(zoneMap));
    if (maxZ >= 5) score += 30; else if (maxZ >= 4) score += 15;
    const colors = spins.slice(-8).map(s => s.color);
    let changes = 0;
    for (let i = 1; i < colors.length; i++) if (colors[i] !== colors[i - 1] && colors[i] !== 'vert' && colors[i - 1] !== 'vert') changes++;
    if (changes <= 2) score += 20;
    return Math.min(100, score);
  }

  _clustering(spins) {
    const nums = spins.slice(-10).map(s => s.number);
    let score = 0;
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const d = wheelDist(nums[i], nums[j]);
        if (d <= 3) score += 15; else if (d <= 5) score += 8;
      }
    }
    const clusters = this._findClusters(nums, 5);
    if (clusters.length > 0) score += 25;
    return Math.min(100, score);
  }

  _findClusters(nums, maxDist) {
    const used = new Set(), clusters = [];
    nums.forEach((n, i) => {
      if (used.has(i)) return;
      const cluster = [n];
      nums.forEach((m, j) => { if (i !== j && !used.has(j) && wheelDist(n, m) <= maxDist) { cluster.push(m); used.add(j); } });
      if (cluster.length >= 3) clusters.push(cluster);
    });
    return clusters;
  }

  recommendedNumbers(spins, profile) {
    const chi = new ChiSquareAnalyzer(spins);
    if (profile === 'defense') return this._sectorNumbers(spins, 24);
    if (profile === 'attaque') {
      const cold = chi.coldNumbers();
      if (cold.length >= 3) return cold.slice(0, 3);
      return chi.heatmap().sort((a, b) => a.count - b.count).slice(0, 3).map(h => h.number);
    }
    return [...new Set([...this._sectorNumbers(spins, 12), ...chi.coldNumbers().slice(0, 3)])].slice(0, 15);
  }

  _sectorNumbers(spins, count) {
    if (spins.length === 0) return WHEEL_ORDER.slice(0, count);
    const lastPos = getWheelPos(spins[spins.length - 1]?.number || 0);
    const result = [];
    for (let i = 0; i < count; i++) result.push(WHEEL_ORDER[((lastPos - Math.floor(count / 2) + i) + 37) % 37]);
    return result;
  }

  phrase(score) {
    if (score >= 85) return 'EXPLOSIF 🔥';
    if (score >= 70) return 'FORTE OPPORTUNITÉ';
    if (score >= 55) return 'FAVORABLE';
    if (score >= 40) return 'NEUTRE';
    if (score >= 25) return 'SIGNAL FAIBLE';
    return 'DEAD MARKET';
  }
}

// ===== PROFILES =====
const PROFILES = {
  defense: { name: 'DÉFENSE', icon: '🛡', color: '#4CAF50', stakePct: 0.5, tp: 10, sl: 5, maxNums: 24, maxLosses: 5, minScore: 55, desc: 'Mise faible, protection maximale' },
  equilibre: { name: 'ÉQUILIBRE', icon: '⚖', color: '#FF9800', stakePct: 1.0, tp: 15, sl: 10, maxNums: 15, maxLosses: 4, minScore: 65, desc: 'Risque modéré, recommandé' },
  attaque: { name: 'ATTAQUE', icon: '⚡', color: '#E30613', stakePct: 1.5, tp: 20, sl: 15, maxNums: 3, maxLosses: 3, minScore: 75, desc: 'Haute mise, experts uniquement' }
};

// ===== MONEY MANAGEMENT ENGINE =====
class MoneyManagementEngine {
  stake(bankroll, mode, profile, stats, score) {
    const p = PROFILES[profile];
    let s = bankroll * (p.stakePct / 100);
    if (mode === 'adaptatif') {
      const pct = stats.profitPct || 0;
      if (pct < -5) s *= 0.7;
      else if (pct > 10 && score > 75) s *= 1.3;
      if (stats.consecutiveLosses >= 3) s *= 0.6;
      if (stats.discipline >= 80) s *= 1.1;
    } else if (mode === 'attaque_max') {
      const mults = [1, 1.2, 1.4, 1.5];
      s *= mults[Math.min(stats.consecutiveWins || 0, mults.length - 1)];
      if (score >= 85) s *= 1.15;
      s = Math.min(bankroll * 0.08, s);
    }
    return Math.max(0.5, Math.round(s * 100) / 100);
  }

  checkStop(stats, profile) {
    const p = PROFILES[profile];
    const pct = stats.profitPct || 0;
    if (pct >= p.tp) return { stop: true, reason: 'TAKE PROFIT ✅', type: 'success' };
    if (pct <= -p.sl) return { stop: true, reason: 'STOP LOSS 🔴', type: 'danger' };
    if (stats.consecutiveLosses >= p.maxLosses) return { stop: true, reason: 'MAX PERTES CONSÉCUTIVES', type: 'danger' };
    if (stats.discipline < 30) return { stop: true, reason: 'TILT DÉTECTÉ 🧠', type: 'tilt' };
    return { stop: false };
  }
}

// ===== SESSION ENGINE =====
const PHASES = {
  calibration:    { icon: '🔍', name: 'CALIBRATION',     instr: 'Observez sans miser — collectez les données',                color: '#9E9E9E' },
  hunting:        { icon: '🎯', name: 'HUNTING',          instr: 'Signal favorable — jouez selon la recommandation',            color: '#00E676' },
  recovery:       { icon: '🔄', name: 'RECOVERY',         instr: 'Progression Fibonacci — récupérez méthodiquement',            color: '#FF9800' },
  protecting:     { icon: '🔒', name: 'PROTECTION',       instr: 'Réduisez les mises — protégez vos gains',                    color: '#FFD700' },
  exit_zone:      { icon: '🚪', name: 'ZONE DE SORTIE',   instr: 'QUITTEZ MAINTENANT — sécurisez vos gains !',                 color: '#E30613' },
  signal_expired: { icon: '⏱', name: 'SIGNAL EXPIRÉ',   instr: 'Aucun spin depuis 5 min — cycle potentiellement changé',     color: '#FF5722' }
};

class SessionEngine {
  phase(stats, score) {
    const pct = stats.profitPct || 0;
    if (stats.totalSpins < 15) return 'calibration';
    if (this.exitScore(stats, score) >= 70 || pct >= 20) return 'exit_zone';
    if (pct >= 10) return 'protecting';
    if (pct < -5 || stats.consecutiveLosses >= 2) return 'recovery';
    return 'hunting';
  }

  exitScore(stats, score) {
    let s = 0;
    const pct = stats.profitPct || 0;
    if (pct >= 20) s += 40; else if (pct >= 15) s += 30; else if (pct >= 10) s += 20; else if (pct >= 5) s += 10;
    if (score < 40) s += 30; else if (score < 55) s += 15;
    if (stats.consecutiveLosses >= 2) s += 20;
    if (stats.discipline < 50) s += 15;
    return Math.min(100, s);
  }

  progress(stats, profile) {
    const p = PROFILES[profile];
    const pct = stats.profitPct || 0;
    return Math.min(100, Math.max(0, (pct / p.tp) * 100));
  }
}

// ===== STRATEGY SELECTOR =====
class StrategySelector {
  auto(score, chiScore, discipline) {
    if (discipline < 40) return { profile: 'defense', confidence: 95, shouldPlay: true };
    if (score < 40) return { profile: 'defense', confidence: 0, shouldPlay: false };
    const combined = chiScore * 0.4 + score * 0.6;
    if (combined < 50) return { profile: 'defense', confidence: 75, shouldPlay: score >= 55 };
    if (combined < 70) return discipline >= 70 ? { profile: 'equilibre', confidence: 80, shouldPlay: true } : { profile: 'defense', confidence: 70, shouldPlay: true };
    return discipline >= 80 ? { profile: 'attaque', confidence: 85, shouldPlay: true } : { profile: 'equilibre', confidence: 80, shouldPlay: true };
  }

  decide(spins, stats, selectedProfile) {
    const scoreEng = new OpportunityScoreEngine();
    const moneyEng = new MoneyManagementEngine();
    const chi = new ChiSquareAnalyzer(spins);
    const score = scoreEng.calculate(spins);
    const chiScore = chi.sessionVarianceScore();
    const autoResult = this.auto(score, chiScore, stats.discipline);
    const profile = selectedProfile || autoResult.profile;
    const p = PROFILES[profile];
    const shouldPlay = autoResult.shouldPlay && score >= p.minScore;
    const numbers = shouldPlay ? scoreEng.recommendedNumbers(spins, profile) : [];
    const stake = moneyEng.stake(stats.currentBankroll, stats.moneyMode || 'adaptatif', profile, stats, score);
    const count = numbers.length;
    const payout = count > 0 ? (36 / count) - 1 : 0;
    return {
      shouldPlay, score, numbers, stake,
      rationale: autoResult.shouldPlay ? scoreEng.phrase(score) : 'Score insuffisant — attendez',
      profile, autoProfile: autoResult.profile,
      probability: count / 37 * 100,
      potentialGain: stake * payout,
      riskLevel: profile === 'defense' ? 'FAIBLE' : profile === 'equilibre' ? 'MOYEN' : 'ÉLEVÉ'
    };
  }
}

// ===== PROFIT LOCK ENGINE =====
class ProfitLockEngine {
  check(stats) {
    const pct = stats.profitPct || 0;
    if (pct >= 20) return { active: true, level: 85, floor: stats.startBankroll + (stats.currentBankroll - stats.startBankroll) * 0.85 };
    if (pct >= 10) return { active: true, level: 70, floor: stats.startBankroll + (stats.currentBankroll - stats.startBankroll) * 0.70 };
    if (pct >= 5) return { active: true, level: 50, floor: stats.startBankroll + (stats.currentBankroll - stats.startBankroll) * 0.50 };
    return { active: false, level: 0, floor: 0 };
  }

  exitSignal(stats, score) {
    const pct = stats.profitPct || 0;
    const profit = stats.currentBankroll - stats.startBankroll;
    if (pct >= 15 && score < 45) return { urgency: 'high', msg: `🔴 SORTEZ — +${fmt(profit)} à sécuriser`, profit };
    if (pct >= 10 && stats.consecutiveLosses >= 2) return { urgency: 'medium', msg: `🟡 Signal sortie — +${fmt(profit)}`, profit };
    if (pct >= 5 && stats.discipline < 50) return { urgency: 'medium', msg: `🟡 Protégez +${fmt(profit)}`, profit };
    return null;
  }
}

// ===== BACKTEST ENGINE =====
class BacktestEngine {
  run(spins, bankroll) {
    const scoreEng = new OpportunityScoreEngine();
    return Object.keys(PROFILES).map(profileKey => {
      let br = bankroll, wins = 0, trades = 0, peakBr = bankroll, maxDD = 0;
      const window = spins.slice(-50);
      for (let i = 10; i < window.length; i++) {
        const past = window.slice(0, i);
        const score = scoreEng.calculate(past);
        const p = PROFILES[profileKey];
        if (score < p.minScore) continue;
        const nums = scoreEng.recommendedNumbers(past, profileKey);
        const stake = br * (p.stakePct / 100);
        const actual = window[i].number;
        trades++;
        if (nums.includes(actual)) {
          const payout = (36 / nums.length) - 1;
          br += stake * payout;
          wins++;
        } else {
          br -= stake;
        }
        if (br > peakBr) peakBr = br;
        const dd = (peakBr - br) / peakBr * 100;
        if (dd > maxDD) maxDD = dd;
      }
      return {
        profile: profileKey,
        roi: ((br - bankroll) / bankroll * 100).toFixed(1),
        winRate: trades > 0 ? (wins / trades * 100).toFixed(1) : '0.0',
        maxDrawdown: maxDD.toFixed(1),
        trades,
        finalBankroll: br.toFixed(2)
      };
    });
  }
}

// ===== UTILS =====
function fmt(n) { return (n || 0).toFixed(2) + '€'; }
function fmtPct(n) { return (n >= 0 ? '+' : '') + (n || 0).toFixed(2) + '%'; }

// Export globals
window.RK = {
  RED_NUMBERS, WHEEL_ORDER, ZONES, PROFILES, PHASES,
  getColor, getZone, getWheelPos, wheelDist, fmt, fmtPct,
  ChiSquareAnalyzer, ElectronicRouletteAnalyzer, OpportunityScoreEngine,
  MoneyManagementEngine, SessionEngine, StrategySelector, ProfitLockEngine, BacktestEngine
};
