import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import type { ConnectionRecord } from '../types'
import { COUNTRY_COORDS } from '../countryCoords'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ArcDatum = {
  id: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  country: string
  color: string
  createdAt: number
}

type PointDatum = {
  lat: number
  lng: number
  size: number
  color: string
  isServer: boolean
}

// ---------------------------------------------------------------------------
// Palette — flat, saturated, cartoon-friendly
// ---------------------------------------------------------------------------
const DEST_LAT = 51.5074
const DEST_LNG = -0.1278
// One-shot travel time in ms — arc is removed from state once the streak finishes
const ARC_TRAVEL_MS = 1800
// Extra buffer so the arc is fully off-screen before being removed from state
const ARC_REMOVAL_BUFFER_MS = 400
const MAX_ARCS = 60

// Vivid flat colors per country (hashed)
const FLAT_PALETTE = [
  '#FF6B6B', // coral red
  '#FFD93D', // sunny yellow
  '#6BCB77', // mint green
  '#4D96FF', // sky blue
  '#FF922B', // tangerine
  '#CC5DE8', // violet
  '#20C997', // teal
  '#F06595', // pink
]

const pickColor = (country: string): string => {
  let hash = 0
  for (let i = 0; i < country.length; i++) hash = (hash * 31 + country.charCodeAt(i)) >>> 0
  return FLAT_PALETTE[hash % FLAT_PALETTE.length]
}

// ---------------------------------------------------------------------------
// Custom globe surface — painted onto a canvas texture
// ---------------------------------------------------------------------------
function makeGlobeCanvas(isDark: boolean): HTMLCanvasElement {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Ocean — flat solid colour, no grid
  ctx.fillStyle = isDark ? '#0a1628' : '#beddf2'
  ctx.fillRect(0, 0, size, size)

  return canvas
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
type ConnectionGlobeProps = {
  connections: ConnectionRecord[]
  /** Explicit lat/lng coords for the server destination */
  serverLat?: number
  serverLng?: number
  /** Country code (e.g. "DE") — looked up in COUNTRY_COORDS; takes precedence over serverLat/serverLng */
  serverCountry?: string
  theme?: 'light' | 'dark'
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function ConnectionGlobe({
  connections,
  serverLat: serverLatProp = DEST_LAT,
  serverLng: serverLngProp = DEST_LNG,
  serverCountry,
  theme = 'dark',
  className,
}: ConnectionGlobeProps) {
  const serverCoords = (serverCountry && COUNTRY_COORDS[serverCountry.toUpperCase()]) || null
  const serverLat = serverCoords ? serverCoords[0] : serverLatProp
  const serverLng = serverCoords ? serverCoords[1] : serverLngProp

  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [arcs, setArcs] = useState<ArcDatum[]>([])
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [countries, setCountries] = useState<{ features: object[] }>({ features: [] })

  const isDark = theme === 'dark'

  // ── Load GeoJSON countries (bundled locally, served from public/) ──────────
  useEffect(() => {
    const controller = new AbortController()
    fetch('/world.geojson', { signal: controller.signal })
      .then((r) => r.json())
      .then((geo) => setCountries(geo))
      .catch(() => {/* polygons are decorative; fail silently */ })
    return () => controller.abort()
  }, [])

  // ── Responsive sizing ──────────────────────────────────────────────────────
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        setDimensions({ width, height })
      }
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // ── Initial camera — centre on server location ───────────────────────────
  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    globe.controls().autoRotate = false
    globe.controls().enableZoom = true
    globe.controls().zoomSpeed = 0.5
    globe.controls().enableDamping = true
    globe.controls().dampingFactor = 0.08
    globe.pointOfView({ lat: serverLat, lng: serverLng, altitude: 2.0 }, 0)
  }, [serverLat, serverLng])

  // ── Globe surface texture as a data URL (repaints on theme change) ─────────
  const globeImage = useMemo(() => makeGlobeCanvas(isDark).toDataURL(), [isDark])

  // ── Spawn arcs for newly seen realtime events ──────────────────────────────
  useEffect(() => {
    if (connections.length === 0) {
      return
    }

    const now = Date.now()
    const newArcs = connections
      .map((connection, index) => {
        const countryCode = connection.country?.toUpperCase() ?? ''
        const coords = COUNTRY_COORDS[countryCode]
        if (!coords) return null

        const jitterLat = (Math.random() - 0.5) * 3
        const jitterLng = (Math.random() - 0.5) * 3
        const parsed = connection.created ? Date.parse(connection.created) : NaN
        const createdAt = Number.isFinite(parsed) ? parsed : now + index

        return {
          id: connection.id,
          startLat: coords[0] + jitterLat,
          startLng: coords[1] + jitterLng,
          endLat: serverLat,
          endLng: serverLng,
          country: countryCode || 'XX',
          color: pickColor(countryCode),
          createdAt,
        } satisfies ArcDatum
      })
      .filter((arc): arc is ArcDatum => arc !== null)

    if (newArcs.length > 0) {
      // Deliberately bridging a prop change into an imperative animation
      // lifecycle — these arcs are time-bound visuals, not derived state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setArcs((prev) => [...newArcs, ...prev].slice(0, MAX_ARCS))
    }
  }, [connections, serverLat, serverLng])

  // ── Prune arcs by age (prevents lingering streaks during bursts) ──────────
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const cutoff = Date.now() - (ARC_TRAVEL_MS + ARC_REMOVAL_BUFFER_MS)
      setArcs((prev) => {
        const next = prev.filter((arc) => arc.createdAt >= cutoff)
        // Keep the same reference when nothing expired — avoids an idle re-render
        return next.length === prev.length ? prev : next
      })
    }, 300)

    return () => window.clearInterval(intervalId)
  }, [])

  // ── Points data: source dots (from arcs) + always-present server beacon ────
  const serverPoint = useMemo<PointDatum[]>(
    () => [{ lat: serverLat, lng: serverLng, size: 0.7, color: '#ffffff', isServer: true }],
    [serverLat, serverLng],
  )
  const points = useMemo<PointDatum[]>(() => {
    const sourceDots: PointDatum[] = arcs.map((a) => ({
      lat: a.startLat,
      lng: a.startLng,
      size: 0.35,
      color: a.color,
      isServer: false,
    }))
    return [...sourceDots, ...serverPoint]
  }, [arcs, serverPoint])

  // ── Country polygon color ─────────────────────────────────────────────────
  const polyColor = useCallback(
    () => isDark ? 'rgba(30,60,100,0.75)' : 'rgba(219, 223, 227, 0.41)',
    [isDark],
  )
  const polySideColor = useCallback(
    () => isDark ? 'rgba(20,50,90,0.4)' : 'rgba(140,180,220,0.4)',
    [isDark],
  )
  const polyStroke = useCallback(
    () => isDark ? 'rgba(80,160,230,0.55)' : 'rgba(60,130,200,0.55)',
    [isDark],
  )

  // ── Arc color: solid flat color, fades at tail ────────────────────────────
  const arcColor = useCallback(
    (d: object) => {
      const arc = d as ArcDatum
      return [arc.color, `${arc.color}00`]
    },
    []
  )

  // ── Kill specular glare on the globe sphere ───────────────────────────────
  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current
    if (!globe) return
    // Access the underlying Three.js globe mesh material and flatten it
    const globeObj = (globe as unknown as { __threeObj?: { children?: { material?: Record<string, unknown> }[] } }).__threeObj
    const mesh = globeObj?.children?.find(
      (c) => c.material && 'shininess' in c.material,
    )
    if (mesh?.material) {
      mesh.material.shininess = 0
      mesh.material.specular = { r: 0, g: 0, b: 0 }
    }
  }, [])

  // ── Atmosphere & bg ────────────────────────────────────────────────────────
  const bgColor = 'rgba(0,0,0,0)'

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'visible' }}
    >
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor={bgColor}
        // ── Surface: custom painted canvas ──
        globeImageUrl={globeImage}
        showAtmosphere={false}
        onGlobeReady={handleGlobeReady}
        // ── Country polygons ──
        polygonsData={countries.features}
        polygonCapColor={polyColor}
        polygonSideColor={polySideColor}
        polygonStrokeColor={polyStroke}
        polygonAltitude={0.006}
        // ── Arcs ──
        arcsData={arcs}
        arcStartLat={(d) => (d as ArcDatum).startLat}
        arcStartLng={(d) => (d as ArcDatum).startLng}
        arcEndLat={(d) => (d as ArcDatum).endLat}
        arcEndLng={(d) => (d as ArcDatum).endLng}
        arcColor={arcColor}
        arcDashLength={0.15}
        arcDashGap={1}
        arcDashInitialGap={0}
        arcDashAnimateTime={ARC_TRAVEL_MS}
        arcStroke={1.4}
        arcAltitude={0.28}
        // ── Source + server dots ──
        pointsData={points}
        pointLat={(d) => (d as PointDatum).lat}
        pointLng={(d) => (d as PointDatum).lng}
        pointAltitude={0.015}
        pointRadius={(d) => (d as PointDatum).size}
        pointColor={(d) => (d as PointDatum).color}
        pointsMerge={false}

      />

      {/* Arc count badge */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          fontFamily: "'DM Mono', 'Fira Mono', 'Courier New', monospace",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: isDark ? 'rgba(180,220,255,0.5)' : 'rgba(30,90,160,0.5)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
      </div>
    </div>
  )
}

export default ConnectionGlobe
