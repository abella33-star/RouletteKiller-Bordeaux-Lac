'use strict';
// ============================================================
//  CIRCULAR BUFFER — Fixed-size ring, size 36
// ============================================================
class CircularBuffer {
  constructor(size = 36) {
    this._size   = size;
    this._buf    = new Array(size).fill(null);
    this._head   = 0;   // next write index
    this._count  = 0;
  }

  push(item) {
    this._buf[this._head] = item;
    this._head  = (this._head + 1) % this._size;
    this._count = Math.min(this._count + 1, this._size);
  }

  /** Returns items oldest → newest */
  toArray() {
    if (this._count === 0)          return [];
    if (this._count < this._size)   return this._buf.slice(0, this._count).filter(x => x !== null);
    // Full buffer: read from _head (oldest) wrapping around
    const tail = this._buf.slice(this._head);
    const head = this._buf.slice(0, this._head);
    return [...tail, ...head];
  }

  get length() { return this._count; }

  clear() {
    this._buf.fill(null);
    this._head  = 0;
    this._count = 0;
  }

  /** Rebuild from a plain array (e.g. after page reload) */
  static fromArray(arr, size = 36) {
    const cb = new CircularBuffer(size);
    const src = arr.slice(-size);   // keep only latest ≤36
    for (const item of src) cb.push(item);
    return cb;
  }
}

// ============================================================
//  ALPHA ENGINE WRAPPER
//  Manages Worker Thread + CircularBuffer + Promise queue
// ============================================================
class AlphaEngine {
  constructor() {
    this.buffer   = new CircularBuffer(36);
    this._worker  = null;
    this._pending = new Map();
    this._idSeq   = 0;
    this._last    = null;
    this._initWorker();
  }

  _initWorker() {
    try {
      this._worker = new Worker('js/alpha-worker.js');
      this._worker.onmessage = (e) => {
        const { id, result } = e.data;
        const resolve = this._pending.get(id);
        if (resolve) {
          this._pending.delete(id);
          this._last = result;
          resolve(result);
        }
      };
      this._worker.onerror = (err) => {
        console.warn('[AlphaEngine] Worker error:', err.message);
        this._pending.forEach(r => r(null));
        this._pending.clear();
        this._worker = null;
      };
    } catch (e) {
      console.warn('[AlphaEngine] Worker unavailable — sync fallback active');
      this._worker = null;
    }
  }

  /**
   * Push a new spin into the circular buffer.
   * Call this every time a spin is recorded.
   * @param {{ number, timestamp, starting_point? }} spin
   */
  push(spin) {
    this.buffer.push({
      number:         spin.number,
      timestamp:      spin.timestamp || Date.now(),
      starting_point: spin.starting_point != null ? spin.starting_point : undefined
    });
  }

  /**
   * Rebuild the buffer from an existing array (app reload / persistence restore).
   * Uses the last 36 entries.
   */
  syncFromArray(spins) {
    this.buffer = CircularBuffer.fromArray(
      spins.map((s, i) => ({
        number:    s.number,
        timestamp: s.timestamp || Date.now(),
        starting_point: s.starting_point != null ? s.starting_point : undefined
      }))
    );
  }

  /**
   * Run the Alpha-Predator analysis asynchronously.
   * @param {number} bankroll
   * @param {number} initialDeposit
   * @param {number} profit
   * @returns {Promise<Object>}
   */
  analyze(bankroll, initialDeposit, profit) {
    const history = this.buffer.toArray();
    if (this._worker) {
      return new Promise((resolve) => {
        const id = this._idSeq++;
        // Safety timeout 200 ms
        const timer = setTimeout(() => {
          if (this._pending.has(id)) {
            this._pending.delete(id);
            resolve(this._syncFallback(history, bankroll, initialDeposit, profit));
          }
        }, 200);
        this._pending.set(id, (res) => { clearTimeout(timer); resolve(res); });
        this._worker.postMessage({ id, history, bankroll, initialDeposit, profit });
      });
    }
    return Promise.resolve(this._syncFallback(history, bankroll, initialDeposit, profit));
  }

  // ── Minimal synchronous fallback (same logic, compressed) ──
  _syncFallback(history, bankroll, initialDeposit, profit) {
    const t0  = performance.now();
    if (history.length < 10) return { status:'WAIT', confidence:0, recommendation:{target:'—',type:'Calibration',splits:[],bet_per_split:0,bet_value:0,num_bets:0}, reason:`Calibration — ${history.length}/10 spins`, potential_gain:0, phase:'—', sectors:null, colorTest:null, parityTest:null, offsetAnalysis:null, latency:performance.now()-t0 };

    // Minimal Chi-Square + Z-Score inline
    const RED=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const CYL={voisins:[22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25],tiers:[27,13,36,11,30,8,23,10,5,24,16,33],orphelins:[1,20,14,31,9,17,34,6]};
    const LBL={voisins:'Voisins du Zéro',tiers:'Tiers du Cylindre',orphelins:'Orphelins'};
    const SPLITS={voisins:{s:[[0,3],[12,15],[32,35]],p:[26]},tiers:{s:[[5,8],[10,11],[13,16],[23,24],[27,30],[33,36]],p:[]},orphelins:{s:[[6,9],[14,17],[17,20],[31,34]],p:[1]}};
    function nCDF(z){if(z<-8)return 0;if(z>8)return 1;const a=[0.319381530,-0.356563782,1.781477937,-1.821255978,1.330274429];const t=1/(1+0.2316419*Math.abs(z));const poly=t*(a[0]+t*(a[1]+t*(a[2]+t*(a[3]+t*a[4]))));const p=1-Math.exp(-0.5*z*z)*0.3989422804*poly;return z>=0?p:1-p;}
    const win=history.slice(-Math.min(24,Math.max(18,history.length)));
    function sc(w,nums){if(w.length<10)return 0;const n=w.length,k=w.filter(s=>nums.includes(s.number)).length,p=nums.length/37,E=n*p,sig=Math.sqrt(E*(1-p)),Z=sig>0?(k-E)/sig:0;const post=(k+p*4)/(n+4);const zC=nCDF(Z)*100,bC=Math.min(100,Math.max(0,(post-p)/p)*120);return Math.min(100,zC*0.6+bC*0.4);}
    const sects={};for(const[k,v]of Object.entries(CYL)){const k2=win.filter(s=>v.includes(s.number)).length,E=win.length*(v.length/37),Z=Math.sqrt(E*(1-v.length/37))>0?(k2-E)/Math.sqrt(E*(1-v.length/37)):0,post=(k2+v.length/37*4)/(win.length+4),cf=sc(win,v);sects[k]={Z,posterior:post,confidence:cf,k:k2,E};}
    const bk=Object.entries(sects).reduce((a,b)=>a[1].confidence>=b[1].confidence?a:b)[0];
    const bd=sects[bk];let conf=bd.confidence;
    const rr=win.filter(s=>RED.includes(s.number)).length,vv=win.filter(s=>s.number===0).length,bb=win.length-rr-vv;const Er=win.length*18/37,Eb=win.length*18/37,Ev=win.length/37;const chi2c=(rr-Er)**2/Er+(bb-Eb)**2/Eb+(vv-Ev)**2/Ev;const pvc=Math.exp(-chi2c/2);
    if(pvc>0.05&&conf<75)return{status:'NOISE',confidence:Math.round(conf*10)/10,recommendation:{target:'NOISE',type:'—',splits:[],bet_per_split:0,bet_value:0,num_bets:0},reason:`Distribution aléatoire χ²-col p=${pvc.toFixed(3)}`,potential_gain:0,phase:'—',sectors:sects,colorTest:{chi2:chi2c,pValue:pvc,isNoise:true},parityTest:null,offsetAnalysis:null,latency:Math.round((performance.now()-t0)*100)/100};
    const sp=SPLITS[bk];const nb=sp.s.length+sp.p.length;
    const phase=profit>=50&&conf>85?'Aggressive':'Safe';
    const total=phase==='Aggressive'?profit*0.5:bankroll*(conf>=85?0.02:0.01);
    const bps=Math.round(total/nb*100)/100;
    const splits=[...sp.s.map(([a,b])=>`${a}/${b}`),...sp.p.map(n=>`${n}-plein`)];
    return{status:conf>=70?'PLAY':'WAIT',confidence:Math.round(conf*10)/10,recommendation:{target:LBL[bk],type:`Smart Splits (${phase})`,splits,bet_per_split:bps,bet_value:Math.round(bps*nb*100)/100,num_bets:nb},reason:`${LBL[bk]}: Z=+${bd.Z.toFixed(2)}σ · Obs=${bd.k}/Att=${bd.E.toFixed(1)}`,potential_gain:Math.round(bps*(sp.p.length>0?35:17-(nb-1))*100)/100,phase,sectors:sects,colorTest:{chi2:chi2c,pValue:pvc,isNoise:pvc>0.05},parityTest:null,offsetAnalysis:null,latency:Math.round((performance.now()-t0)*100)/100};
  }

  get lastResult() { return this._last; }
  terminate()      { if (this._worker) { this._worker.terminate(); this._worker = null; } }
}

// Global singleton
window.alphaEngine = new AlphaEngine();
