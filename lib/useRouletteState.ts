'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { AppState, Spin, EngineResult } from './types'
import { getColor, getZone, TAKE_PROFIT_MULTIPLIER } from './constants'
import { processData, computeNumberHeat } from './alpha-engine'
import { saveState, loadState } from './indexeddb'
import { haptics } from './haptics'

// ── Default state ──────────────────────────────────────────────
const DEFAULT: AppState = {
  spins:           [],
  bankroll:        1000,
  initialDeposit:  1000,
  startBankroll:   1000,
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
      workerRef.current.postMessage({ id, history, bankroll, initialDeposit })
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

  // ── Add spin ──────────────────────────────────────────────────
  const addSpin = useCallback((number: number) => {
    haptics.tap()
    setState(prev => {
      const spin: Spin = {
        id:        `${Date.now()}-${Math.random()}`,
        number,
        color:     getColor(number),
        zone:      getZone(number),
        timestamp: Date.now(),
      }
      const spins     = [...prev.spins, spin]
      const totalSpins = prev.totalSpins + 1
      const next = { ...prev, spins, totalSpins }

      // Check Take Profit after each spin (not bet-based, but as a side effect of bankroll tracking)
      if (!prev.victoryShown &&
          prev.bankroll >= prev.initialDeposit * TAKE_PROFIT_MULTIPLIER &&
          prev.initialDeposit > 0) {
        setShowVictory(true)
        haptics.victory()
        return { ...next, victoryShown: true }
      }
      return next
    })
  }, [setState])

  // Update engine after spin (reads latest state from ref)
  const addSpinAndRun = useCallback((number: number) => {
    addSpin(number)
    // Use setTimeout 0 to get the updated spins from the next render cycle
    setTimeout(() => {
      _setState(current => {
        runEngine(current.spins, current.bankroll, current.initialDeposit)
        return current
      })
    }, 0)
  }, [addSpin, runEngine])

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
