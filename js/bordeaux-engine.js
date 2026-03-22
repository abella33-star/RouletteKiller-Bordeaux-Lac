'use strict';
// ============================================================
//  BORDEAUX ENGINE WRAPPER
//  Gère le Worker Thread + fallback synchrone si indisponible
//  Expose : BordeauxEngine.analyze(spins, bankroll) → Promise
// ============================================================

class BordeauxEngine {
  constructor() {
    this._worker   = null;
    this._pending  = new Map();   // id → resolve
    this._idSeq    = 0;
    this._lastResult = null;
    this._workerReady = false;
    this._initWorker();
  }

  _initWorker() {
    try {
      // Resolve path relative to the page root (works on Vercel + localhost)
      this._worker = new Worker('js/bordeaux-worker.js');
      this._worker.onmessage = (e) => {
        const { id, result } = e.data;
        const resolve = this._pending.get(id);
        if (resolve) {
          this._pending.delete(id);
          this._lastResult = result;
          resolve(result);
        }
      };
      this._worker.onerror = (err) => {
        console.warn('[BordeauxEngine] Worker error:', err.message);
        // Drain pending with null result so callers don't hang
        this._pending.forEach(r => r(null));
        this._pending.clear();
        this._worker = null;
      };
      this._workerReady = true;
    } catch (e) {
      console.warn('[BordeauxEngine] Worker unavailable, using sync fallback:', e.message);
      this._workerReady = false;
    }
  }

  /**
   * Analyse asynchrone.
   * Si le Worker est disponible → délégation avec timeout 200 ms.
   * Sinon → exécution synchrone dans le thread principal (fallback).
   *
   * @param {Array}  spins    — array of spin objects
   * @param {number} bankroll — current bankroll
   * @returns {Promise<Object>}
   */
  analyze(spins, bankroll) {
    if (this._workerReady && this._worker) {
      return new Promise((resolve) => {
        const id = this._idSeq++;
        this._pending.set(id, resolve);
        // Safety timeout: 200 ms (analysis should be < 50 ms)
        const timeout = setTimeout(() => {
          if (this._pending.has(id)) {
            this._pending.delete(id);
            resolve(this._syncFallback(spins, bankroll));
          }
        }, 200);
        this._worker.postMessage({ id, spins: spins.map(s => ({
          number: s.number,
          color:  s.color,
          zone:   s.zone
        })), bankroll });
        // Clear timeout if worker replies first
        const original = this._pending.get(id);
        this._pending.set(id, (result) => {
          clearTimeout(timeout);
          resolve(result);
        });
      });
    }
    // Synchronous fallback
    return Promise.resolve(this._syncFallback(spins, bankroll));
  }

  /**
   * Synchronous fallback — same math as the worker, inlined.
   * Only used when Worker API is unavailable.
   */
  _syncFallback(spins, bankroll) {
    const t0 = performance.now();
    // Inline the exact same logic as bordeaux-worker.js
    const WIN_MIN = 18, WIN_MAX = 24;
    const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const CYL = {
      voisins:   [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25],
      tiers:     [27,13,36,11,30,8,23,10,5,24,16,33],
      orphelins: [1,20,14,31,9,17,34,6]
    };
    const LBL = { voisins:'Voisins du Zéro', tiers:'Tiers du Cylindre', orphelins:'Orphelins' };

    function nCDF(z) {
      if (z<-8) return 0; if (z>8) return 1;
      const a=[0.319381530,-0.356563782,1.781477937,-1.821255978,1.330274429];
      const t=1/(1+0.2316419*Math.abs(z));
      const poly=t*(a[0]+t*(a[1]+t*(a[2]+t*(a[3]+t*a[4]))));
      const p=1-Math.exp(-0.5*z*z)*0.3989422804*poly;
      return z>=0?p:1-p;
    }
    function zS(win,nums){ const n=win.length,k=win.filter(s=>nums.includes(s.number)).length,p=nums.length/37,E=n*p,sig=Math.sqrt(E*(1-p));return sig>0?(k-E)/sig:0; }
    function bP(win,nums){ const n=win.length,k=win.filter(s=>nums.includes(s.number)).length,p=nums.length/37,a0=p*4,b0=(1-p)*4;return(k+a0)/(n+4); }
    function sc(win,nums){ if(win.length<10)return 0;const Z=zS(win,nums),pr=nums.length/37,po=bP(win,nums),zC=nCDF(Z)*100,ex=Math.max(0,(po-pr)/pr);return Math.min(100,zC*0.6+Math.min(100,ex*120)*0.4); }
    function ccq(win){ const n=win.length;if(n<10)return{chi2:0,pValue:1,isNoise:true};const r=win.filter(s=>RED.includes(s.number)).length,v=win.filter(s=>s.number===0).length,no=n-r-v;const Er=n*18/37,En=n*18/37,Ev=n/37;const c=Math.pow(r-Er,2)/Er+Math.pow(no-En,2)/En+Math.pow(v-Ev,2)/Ev;const p=Math.exp(-c/2);return{chi2:c,pValue:p,isNoise:p>0.05}; }

    const n=spins.length;
    const win=spins.slice(-Math.min(WIN_MAX,Math.max(WIN_MIN,n)));
    if(win.length<10)return{signal:'Low',confidence:0,target:'CALIBRATION',bet_units:0,reason:`Données insuffisantes — ${win.length} spins`,sectors:null,colorTest:null,latency:performance.now()-t0};
    const ct=ccq(win);
    const sects={};
    for(const[k2,nums]of Object.entries(CYL)){const Z=zS(win,nums),po=bP(win,nums),cf=sc(win,nums),k3=win.filter(s=>nums.includes(s.number)).length,E=win.length*(nums.length/37);sects[k2]={Z,posterior:po,confidence:cf,k:k3,E};}
    const bk=Object.entries(sects).reduce((a,b)=>a[1].confidence>=b[1].confidence?a:b)[0];
    const bd=sects[bk],cf2=bd.confidence;
    if(ct.isNoise&&cf2<75)return{signal:'Noise',confidence:Math.round(cf2*10)/10,target:'NOISE / DO NOT PLAY',bet_units:0,reason:`Distribution aléatoire — χ²=${ct.chi2.toFixed(2)}, p=${ct.pValue.toFixed(3)} > 0.05`,sectors:sects,colorTest:ct,latency:performance.now()-t0};
    const bet=cf2<70?0:cf2<85?Math.round(bankroll*0.01*100)/100:Math.round(bankroll*0.02*100)/100;
    const sig=cf2>=85?'High':cf2>=70?'Medium':'Low';
    const zStr=bd.Z.toFixed(2),eStr=bd.E.toFixed(1),postPct=(bd.posterior*100).toFixed(1),chi2Str=ct.chi2.toFixed(2),cpStr=ct.pValue.toFixed(3);
    let reason=sig==='High'?`${LBL[bk]}: Z=+${zStr}σ · Obs=${bd.k}/Att=${eStr} · P_post=${postPct}% · χ²-col=${chi2Str} (p=${cpStr})`:sig==='Medium'?`${LBL[bk]}: Z=+${zStr}σ · Biais modéré (P_post=${postPct}%) — confirmer sur 3-4 spins`:`Signal faible (${cf2.toFixed(0)}%) — attendre renforcement`;
    return{signal:sig,confidence:Math.round(cf2*10)/10,target:LBL[bk],bet_units:bet,reason,sectors:sects,colorTest:ct,latency:Math.round((performance.now()-t0)*100)/100};
  }

  get lastResult() { return this._lastResult; }

  terminate() {
    if (this._worker) { this._worker.terminate(); this._worker = null; }
  }
}

// Singleton exported globally
window.bordeauxEngine = new BordeauxEngine();
