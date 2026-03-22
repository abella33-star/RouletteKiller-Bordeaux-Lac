'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { AppState, Spin, EngineResult } from './types'
import { getColor, getZone, TAKE_PROFIT_MULTIPLIER } from './constants'
import { processData, computeNumberHeat } from './alpha-engine'
import { saveState, loadState } from './indexeddb'
import { haptics } from './haptics'

/** Returns true if the given roulette number is covered by the split list */
function isNumberCovered(number: number, splits: string[]): boolean {
  for (const split of splits) {
    if (split.includes('plein')) {
      if (parseInt(split) === number) return true
    } else {
      const [a, b] = split.split('/').map(Number)
      if (a === number || b === number) return true
    }
  }
  return false
}

// ── Default state ──────────────────────────────────────────────
const DEFAULT: AppState = {
  spins:           [],
  bankroll:        100,
  initialDeposit:  100,
  startBankroll:   100,
  wins:            0,
  losses:          0,
  totalSpins:      0,
  consecutiveLoss: 0,
  victoryShown:    false,
  lastEngineResult: null,
}

export function useRouletteState() {
  const [state, _setState] = useState<AppState>(DEFAULT)
  const [heat, setHeat] = useState<Record<number, number>>({})
  const [bufferSize, setBufferSize] = useState(0)
  const [showVictory, setShowVictory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Use ref for worker to avoid re-renders
  const workerRef = useRef<Worker | null>(null)
  const pendingRef = useRef<Map<number, (r: EngineResult) => void>>(new Map())
  const idRef     = useRef(0)

  // ── Load persisted state ──────────────────────────────────────
  useEffect(() => {
    loadState().then(saved => {
      if (saved) {
        _setState(prev => ({ ...prev, ...saved, lastEngineResult: null }))
      }
      setLoaded(true)
    })
  }, [])

  // ── Initialise Web Worker ─────────────────────────────────────
  useEffect(() => {
    try {
      const w = new Worker('/alpha-worker.js')
      w.onmessage = (e) => {
        const { id, result } = e.data
        const resolve = pendingRef.current.get(id)
        if (resolve) { pendingRef.current.delete(id); resolve(result) }
      }
      w.onerror = () => { workerRef.current = null }
      workerRef.current = w
    } catch {}
    return () => { workerRef.current?.terminate() }
  }, [])

  // ── setState wrapper that also saves ─────────────────────────
  const setState = useCallback((updater: (prev: AppState) => AppState) => {
    _setState(prev => {
      const next = updater(prev)
      saveState(next).catch(() => {})
      return next
    })
  }, [])

  // ── Run engine (worker or sync fallback) ──────────────────────
  const runEngine = useCallback((spins: Spin[], bankroll: number, initialDeposit: number) => {
    const history = spins.slice(-36)
    setBufferSize(history.length)
    setHeat(computeNumberHeat(spins))

    if (workerRef.current) {
      const id = idRef.current++
      const promise = new Promise<EngineResult>((res) => {
        const timer = setTimeout(() => {
          if (pendingRef.current.has(id)) {
            pendingRef.current.delete(id)
            res(processData(spins, bankroll, initialDeposit))
          }
        }, 200)
        pendingRef.current.set(id, (r) => { clearTimeout(timer); res(r) })
      })
      const profit = bankroll - initialDeposit
      workerRef.current.postMessage({ id, history, bankroll, initialDeposit, profit })
      promise.then(result => {
        setState(prev => ({ ...prev, lastEngineResult: result }))
        // Haptic for signal change
        if      (result.status === 'KILLER') haptics.killer()
        else if (result.status === 'PLAY')   haptics.play()
        else if (result.status === 'NOISE')  haptics.noise()
      })
    } else {
      const result = processData(spins, bankroll, initialDeposit)
      setState(prev => ({ ...prev, lastEngineResult: result }))
    }
  }, [setState])

  // ── Add spin + auto-update bankroll + run engine ──────────────
  const addSpinAndRun = useCallback((number: number) => {
    haptics.tap()
    setState(prev => {
      // 1. Auto-update bankroll from last recommendation
      let bankroll       = prev.bankroll
      let wins           = prev.wins
      let losses         = prev.losses
      let consecutiveLoss = prev.consecutiveLoss
      const last = prev.lastEngineResult
      if (last && (last.status === 'PLAY' || last.status === 'KILLER')) {
        const covered = isNumberCovered(number, last.recommendation.splits)
        if (covered) {
          // Win: mise_sur_numéro × 35 - mise_totale
          const gain = last.recommendation.bet_per_split * 35 - last.recommendation.bet_value
          bankroll = Math.round((bankroll + gain) * 100) / 100
          wins++
          consecutiveLoss = 0
        } else {
          bankroll = Math.max(0, Math.round((bankroll - last.recommendation.bet_value) * 100) / 100)
          losses++
          consecutiveLoss++
        }
      }

      // 2. Add spin
      const spin: Spin = {
        id:        `${Date.now()}-${Math.random()}`,
        number,
        color:     getColor(number),
        zone:      getZone(number),
        timestamp: Date.now(),
      }
      const spins      = [...prev.spins, spin]
      const totalSpins = prev.totalSpins + 1

      // 3. Check take profit
      let victoryShown = prev.victoryShown
      if (!victoryShown &&
          bankroll >= prev.initialDeposit * TAKE_PROFIT_MULTIPLIER &&
          prev.initialDeposit > 0) {
        setShowVictory(true)
        haptics.victory()
        victoryShown = true
      }

      return { ...prev, spins, totalSpins, bankroll, wins, losses, consecutiveLoss, victoryShown }
    })

    // 4. Run engine with fresh state (setTimeout 0 to read updated state)
    setTimeout(() => {
      _setState(current => {
        runEngine(current.spins, current.bankroll, current.initialDeposit)
        return current
      })
    }, 0)
  }, [setState, runEngine])

  // ── Undo last spin ────────────────────────────────────────────
  const undoSpin = useCallback(() => {
    haptics.undo()
    setState(prev => {
      if (prev.spins.length === 0) return prev
      const spins    = prev.spins.slice(0, -1)
      const totalSpins = Math.max(0, prev.totalSpins - 1)
      runEngine(spins, prev.bankroll, prev.initialDeposit)
      return { ...prev, spins, totalSpins }
    })
  }, [setState, runEngine])

  // ── Reset cycle ───────────────────────────────────────────────
  const resetCycle = useCallback(() => {
    haptics.reset()
    setState(prev => ({
      ...prev,
      spins:           [],
      totalSpins:      0,
      consecutiveLoss: 0,
      lastEngineResult: null,
    }))
    setHeat({})
    setBufferSize(0)
  }, [setState])

  // ── Apply bankroll settings ───────────────────────────────────
  const applyBankroll = useCallback((amount: number) => {
    setState(prev => ({
      ...prev,
      bankroll:       amount,
      initialDeposit: amount,
      startBankroll:  amount,
      victoryShown:   false,
    }))
    setShowSettings(false)
  }, [setState])

  // ── Record win/loss (manual) ──────────────────────────────────
  const recordWin = useCallback((stake: number) => {
    setState(prev => {
      const bankroll = prev.bankroll + stake
      if (!prev.victoryShown && bankroll >= prev.initialDeposit * TAKE_PROFIT_MULTIPLIER) {
        setShowVictory(true)
        haptics.victory()
        return { ...prev, bankroll, wins: prev.wins+1, consecutiveLoss:0, victoryShown:true }
      }
      return { ...prev, bankroll, wins: prev.wins+1, consecutiveLoss:0 }
    })
  }, [setState])

  const recordLoss = useCallback((stake: number) => {
    setState(prev => ({
      ...prev,
      bankroll:        Math.max(0, prev.bankroll - stake),
      losses:          prev.losses + 1,
      consecutiveLoss: prev.consecutiveLoss + 1,
    }))
  }, [setState])

  return {
    state,
    heat,
    bufferSize,
    loaded,
    showVictory,   setShowVictory,
    showSettings,  setShowSettings,
    addSpin:       addSpinAndRun,
    undoSpin,
    resetCycle,
    applyBankroll,
    recordWin,
    recordLoss,
  }
}
