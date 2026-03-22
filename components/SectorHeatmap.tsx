'use client'
/**
 * Sector Heatmap — SVG circular wheel (37 wedges)
 *
 * Visual layers (inside → out):
 *  1. Inner number cells (coloured by Z-score heat)
 *  2. Sector arc labels (Voisins / Tiers / Orphelins)
 *  3. Pulsing glow ring on the dominant sector
 */
import { useMemo, useRef, useEffect } from 'react'
import { WHEEL_ORDER, CYLINDER, SECTOR_COLORS, SECTOR_LABELS } from '@/lib/constants'
import type { SectorKey, EngineResult } from '@/lib/types'

// ── Geometry constants ────────────────────────────────────────
const CX = 160, CY = 160            // SVG centre
const R_INNER = 54                  // inner circle radius
const R_NUMBER = 100                // outer edge of number band
const R_SECTOR = 114                // outer edge of sector band
const R_GLOW   = 120                // glow ring

const TOTAL = 37
const STEP  = (2 * Math.PI) / TOTAL

// ── Helpers ───────────────────────────────────────────────────

function polarToXY(angle: number, r: number) {
  return {
    x: CX + r * Math.cos(angle),
    y: CY + r * Math.sin(angle),
  }
}

/** SVG arc path for a wedge between two angles, inner/outer radii */
function wedgePath(i: number, rInner: number, rOuter: number): string {
  // Start angle for slot i (top = -π/2)
  const a0 = i * STEP - Math.PI / 2 - STEP / 2
  const a1 = a0 + STEP
  const p0 = polarToXY(a0, rOuter)
  const p1 = polarToXY(a1, rOuter)
  const p2 = polarToXY(a1, rInner)
  const p3 = polarToXY(a0, rInner)
  const la = 0 // large-arc-flag (always 0 since STEP < π)
  return [
    `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${la} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${la} 0 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

/** Mid-angle for wheel position i */
function midAngle(i: number): number {
  return i * STEP - Math.PI / 2
}

/** Heat colour: blue (cold) → black (neutral) → orange → red (hot) */
function heatColor(z: number): string {
  const clamped = Math.max(-3, Math.min(3, z))
  if (clamped < -0.5) return '#1A2A4A'          // cold blue
  if (clamped < 0.5)  return '#1C1C1C'          // neutral
  if (clamped < 1.5)  return '#5C3000'          // warm orange-dark
  if (clamped < 2.5)  return '#FF9800'          // hot orange
  return '#FF3D00'                              // very hot red
}

/** Which sector arc indices belong to a sector key */
function sectorArcForKey(key: SectorKey): { startIdx: number; endIdx: number } {
  const nums   = CYLINDER[key]
  const indices = nums.map(n => WHEEL_ORDER.indexOf(n)).filter(i => i >= 0).sort((a,b)=>a-b)
  return { startIdx: indices[0], endIdx: indices[indices.length - 1] }
}

// ── Main component ────────────────────────────────────────────

interface Props {
  heat:          Record<number, number>   // number → Z-score
  engineResult:  EngineResult | null
  lastNumber:    number | null
}

export default function SectorHeatmap({ heat, engineResult, lastNumber }: Props) {
  const glowRef = useRef<SVGCircleElement>(null)
  const rafRef  = useRef<number>(0)

  // rAF-driven glow ring — 120Hz ProMotion aware
  useEffect(() => {
    const el = glowRef.current
    if (!el) return

    const status = engineResult?.status
    if (status !== 'PLAY' && status !== 'KILLER') {
      el.style.opacity = '0'
      return
    }

    const speed  = status === 'KILLER' ? 0.007 : 0.003  // rad/ms
    const minO   = 0.3
    const maxO   = status === 'KILLER' ? 1.0 : 0.7
    const blur   = status === 'KILLER' ? 12 : 6
    const color  = el.getAttribute('data-color') ?? '#00E676'
    let start = 0

    function tick(ts: number) {
      if (!start) start = ts
      const t = (ts - start) * speed
      const osc = (Math.sin(t) + 1) / 2                   // 0..1
      const o   = minO + osc * (maxO - minO)
      const b   = blur * osc
      el!.style.opacity = o.toFixed(3)
      el!.style.filter  = `drop-shadow(0 0 ${b.toFixed(1)}px ${color})`
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [engineResult?.status, engineResult?.recommendation?.target])

  // Determine dominant sector from engine result
  const dominantKey: SectorKey | null = useMemo(() => {
    if (!engineResult?.sectors) return null
    const status = engineResult.status
    if (status === 'WAIT' || status === 'NOISE') return null
    const best = (Object.keys(engineResult.sectors) as SectorKey[])
      .reduce((a, b) =>
        engineResult.sectors![a].confidence >= engineResult.sectors![b].confidence ? a : b)
    return best
  }, [engineResult])

  // Build sector arc data for the outer ring
  const sectorArcs = useMemo(() => {
    return (Object.keys(CYLINDER) as SectorKey[]).map(key => {
      const nums = CYLINDER[key]
      const wheelPositions = nums
        .map(n => WHEEL_ORDER.indexOf(n))
        .filter(i => i >= 0)
        .sort((a, b) => a - b)

      // Group consecutive positions into arc segments
      const segments: number[][] = []
      let seg: number[] = [wheelPositions[0]]
      for (let i = 1; i < wheelPositions.length; i++) {
        if (wheelPositions[i] - wheelPositions[i-1] <= 2) {
          seg.push(wheelPositions[i])
        } else {
          segments.push(seg)
          seg = [wheelPositions[i]]
        }
      }
      segments.push(seg)

      return { key, segments, color: SECTOR_COLORS[key] }
    })
  }, [])

  return (
    <svg
      viewBox="0 0 320 320"
      className="w-full h-full select-none"
      aria-label="Heatmap sectorielle"
    >
      {/* ── Background circle ── */}
      <circle cx={CX} cy={CY} r={R_SECTOR + 2} fill="#0A0A0A" />

      {/* ── Pulsing glow ring for dominant sector (rAF / 120Hz) ── */}
      {dominantKey && (
        <circle
          ref={glowRef}
          data-color={SECTOR_COLORS[dominantKey]}
          cx={CX} cy={CY} r={R_GLOW}
          fill="none"
          stroke={SECTOR_COLORS[dominantKey]}
          strokeWidth={engineResult?.status === 'KILLER' ? 3 : 1.5}
          style={{ willChange: 'opacity, filter' }}
        />
      )}

      {/* ── Sector arc bands (outer band) ── */}
      {sectorArcs.map(({ key, segments, color }) =>
        segments.map((seg, si) => {
          // Arc from first to last position in segment
          const a0 = seg[0] * STEP - Math.PI / 2 - STEP / 2
          const a1 = seg[seg.length-1] * STEP - Math.PI / 2 + STEP / 2
          const p0 = polarToXY(a0, R_SECTOR)
          const p1 = polarToXY(a1, R_SECTOR)
          const p2 = polarToXY(a1, R_NUMBER + 1)
          const p3 = polarToXY(a0, R_NUMBER + 1)
          const la = (a1 - a0) > Math.PI ? 1 : 0
          const path = [
            `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)}`,
            `A ${R_SECTOR} ${R_SECTOR} 0 ${la} 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`,
            `L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
            `A ${R_NUMBER+1} ${R_NUMBER+1} 0 ${la} 0 ${p3.x.toFixed(1)} ${p3.y.toFixed(1)}`,
            'Z',
          ].join(' ')
          return (
            <path
              key={`arc-${key}-${si}`}
              d={path}
              fill={color}
              opacity={key === dominantKey ? 0.55 : 0.18}
              className="transition-opacity duration-700"
            />
          )
        })
      )}

      {/* ── Number wedges (heat coloured) ── */}
      {WHEEL_ORDER.map((num, i) => {
        const z     = heat[num] ?? 0
        const fill  = heatColor(z)
        const isLast = num === lastNumber
        const mid   = midAngle(i)
        const textR = (R_INNER + R_NUMBER) / 2
        const tx    = CX + textR * Math.cos(mid)
        const ty    = CY + textR * Math.sin(mid)
        const textAngleDeg = (mid * 180 / Math.PI) + 90

        // Sector colour for text
        const sectorKey = (Object.keys(CYLINDER) as SectorKey[])
          .find(k => CYLINDER[k].includes(num))
        const baseTextColor = num === 0 ? '#00C853' : sectorKey ? SECTOR_COLORS[sectorKey] : '#FFF'

        return (
          <g key={num}>
            <path
              d={wedgePath(i, R_INNER, R_NUMBER)}
              fill={isLast ? '#00E676' : fill}
              stroke={isLast ? '#00E676' : '#111'}
              strokeWidth={isLast ? 1.5 : 0.5}
              className="heatmap-wedge"
              style={{
                filter: isLast ? 'drop-shadow(0 0 6px rgba(0,230,118,0.8))' :
                        z > 2 ? 'drop-shadow(0 0 4px rgba(255,152,0,0.6))' : undefined,
              }}
            />
            <text
              x={tx} y={ty}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={i === WHEEL_ORDER.indexOf(lastNumber ?? -1) ? 9 : 7.5}
              fontWeight="900"
              fill={isLast ? '#000' : baseTextColor}
              transform={`rotate(${textAngleDeg}, ${tx.toFixed(1)}, ${ty.toFixed(1)})`}
              style={{ fontFamily: 'monospace', pointerEvents: 'none' }}
            >
              {num}
            </text>
          </g>
        )
      })}

      {/* ── Centre: signal status ── */}
      <circle cx={CX} cy={CY} r={R_INNER - 2} fill="#000" />
      {engineResult && (
        <>
          <text
            x={CX} y={CY - 10}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fontWeight="900" letterSpacing={2}
            fill={
              engineResult.status === 'KILLER' ? '#FFD700' :
              engineResult.status === 'PLAY'   ? '#00E676' :
              engineResult.status === 'NOISE'  ? '#FF1744' : '#555'
            }
          >
            {engineResult.status}
          </text>
          <text
            x={CX} y={CY + 6}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={14} fontWeight="900"
            fill={
              engineResult.status === 'KILLER' ? '#FFD700' :
              engineResult.status === 'PLAY'   ? '#00E676' : '#555'
            }
          >
            {engineResult.confidence > 0 ? `${engineResult.confidence}%` : '—'}
          </text>
          <text
            x={CX} y={CY + 20}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={7} fill="#555" letterSpacing={1}
          >
            {SECTOR_LABELS[dominantKey as SectorKey] ?? 'EN ATTENTE'}
          </text>
        </>
      )}

      {/* ── Sector labels on the arc band ── */}
      {(Object.keys(CYLINDER) as SectorKey[]).map(key => {
        const nums = CYLINDER[key]
        const positions = nums.map(n => WHEEL_ORDER.indexOf(n)).filter(i => i >= 0)
        // Mean angle for the label
        const meanPos = positions.reduce((s, p) => s + p, 0) / positions.length
        const angle   = meanPos * STEP - Math.PI / 2
        const r       = R_SECTOR - 5
        const tx      = CX + r * Math.cos(angle)
        const ty      = CY + r * Math.sin(angle)
        const label   = key === 'voisins' ? 'V' : key === 'tiers' ? 'T' : 'O'
        return (
          <text
            key={`lbl-${key}`}
            x={tx.toFixed(1)} y={ty.toFixed(1)}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={7} fontWeight="900"
            fill={SECTOR_COLORS[key]}
            opacity={0.9}
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}
