import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import type { ConnectionRecord } from '../types'

// ---------------------------------------------------------------------------
// Country centroids
// ---------------------------------------------------------------------------
const COUNTRY_COORDS: Record<string, [number, number]> = {
  AF: [33.93911, 67.709953], AL: [41.153332, 20.168331], DZ: [28.033886, 1.659626],
  AO: [-11.202692, 17.873887], AR: [-38.416097, -63.616672], AU: [-25.274398, 133.775136],
  AT: [47.516231, 14.550072], AZ: [40.143105, 47.576927], BD: [23.684994, 90.356331],
  BE: [50.503887, 4.469936], BR: [-14.235004, -51.92528], BG: [42.733883, 25.48583],
  KH: [12.565679, 104.990963], CA: [56.130366, -106.346771], CL: [-35.675147, -71.542969],
  CN: [35.86166, 104.195397], CO: [4.570868, -74.297333], CD: [-4.038333, 21.758664],
  CZ: [49.817492, 15.472962], DK: [56.26392, 9.501785], EG: [26.820553, 30.802498],
  ET: [9.145, 40.489673], FI: [61.92411, 25.748151], FR: [46.227638, 2.213749],
  DE: [51.165691, 10.451526], GH: [7.946527, -1.023194], GR: [39.074208, 21.824312],
  HK: [22.396428, 114.109497], HU: [47.162494, 19.503304], IN: [20.593684, 78.96288],
  ID: [-0.789275, 113.921327], IR: [32.427908, 53.688046], IQ: [33.223191, 43.679291],
  IE: [53.41291, -8.24389], IL: [31.046051, 34.851612], IT: [41.87194, 12.56738],
  JP: [36.204824, 138.252924], KZ: [48.019573, 66.923684], KE: [-0.023559, 37.906193],
  KR: [35.907757, 127.766922], KW: [29.31166, 47.481766], LB: [33.854721, 35.862285],
  LT: [55.169438, 23.881275], MY: [4.210484, 101.975766], MX: [23.634501, -102.552784],
  MA: [31.791702, -7.09262], NL: [52.132633, 5.291266], NZ: [-40.900557, 174.885971],
  NG: [9.081999, 8.675277], NO: [60.472024, 8.468946], PK: [30.375321, 69.345116],
  PA: [8.537981, -80.782127], PE: [-9.189967, -75.015152], PH: [12.879721, 121.774017],
  PL: [51.919438, 19.145136], PT: [39.399872, -8.224454], QA: [25.354826, 51.183884],
  RO: [45.943161, 24.96676], RU: [61.52401, 105.318756], SA: [23.885942, 45.079162],
  RS: [44.016521, 21.005859], SG: [1.352083, 103.819836], SK: [48.669026, 19.699024],
  ZA: [-30.559482, 22.937506], ES: [40.463667, -3.74922], LK: [7.873054, 80.771797],
  SE: [60.128161, 18.643501], CH: [46.818188, 8.227512], TW: [23.69781, 120.960515],
  TH: [15.870032, 100.992541], TN: [33.886917, 9.537499], TR: [38.963745, 35.243322],
  UA: [48.379433, 31.16558], AE: [23.424076, 53.847818], GB: [55.378051, -3.435973],
  US: [37.09024, -95.712891], UZ: [41.377491, 64.585262], VE: [6.42375, -66.58973],
  VN: [14.058324, 108.277199], YE: [15.552727, 48.516388], ZM: [-13.133897, 27.849332],
}

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
const DEST_LAT = 48.8566
const DEST_LNG = 2.3522
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
  ctx.fillStyle = isDark ? '#0a1628' : '#c8e3f5'
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

  // ── Load GeoJSON countries ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('https://unpkg.com/world-atlas@2/countries-110m.json')
      .then((r) => r.json())
      .then((world) => {
        // world-atlas is TopoJSON; convert inline via simple fetch of geojson instead
      })
      .catch(() => {/* silent — polygons optional */})

    // Use a direct GeoJSON source instead
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then((r) => r.json())
      .then((geo) => setCountries(geo))
      .catch(() => {/* polygons are decorative; fail silently */})
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

  // ── Globe canvas texture (repaints on theme change) ───────────────────────
  const globeCanvas = useMemo(() => makeGlobeCanvas(isDark), [isDark])

  // ── Spawn one arc per new connection (newest record is always connections[0]) ──
  const latestId = connections[0]?.id
  useEffect(() => {
    const conn = connections[0]
    if (!conn) return

    const countryCode = conn.country?.toUpperCase() ?? ''
    const coords = COUNTRY_COORDS[countryCode]
    if (!coords) return

    const jitterLat = (Math.random() - 0.5) * 3
    const jitterLng = (Math.random() - 0.5) * 3
    const now = Date.now()

    const arc: ArcDatum = {
      id: conn.id,
      startLat: coords[0] + jitterLat,
      startLng: coords[1] + jitterLng,
      endLat: serverLat,
      endLng: serverLng,
      country: countryCode || 'XX',
      color: pickColor(countryCode),
      createdAt: now,
    }

    setArcs((prev) => [arc, ...prev].slice(0, MAX_ARCS))

    // Remove arc once the streak has fully exited (travel + buffer).
    // No cleanup — each arc manages its own removal independently.
    setTimeout(() => {
      setArcs((prev) => prev.filter((a) => a.id !== arc.id))
    }, ARC_TRAVEL_MS + ARC_REMOVAL_BUFFER_MS)
  }, [latestId, serverLat, serverLng])

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
    () => isDark ? 'rgba(30,60,100,0.75)' : 'rgba(180,210,240,0.80)',
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
    ((d: ArcDatum) => [d.color, `${d.color}00`]) as (d: object) => string[],
    [],
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
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor={bgColor}
        // ── Surface: custom painted canvas ──
        globeImageUrl={globeCanvas.toDataURL()}
        showAtmosphere={false}
        onGlobeReady={handleGlobeReady}
        // ── Country polygons ──
        polygonsData={countries.features}
        polygonCapColor={polyColor}
        polygonSideColor={polySideColor}
        polygonStrokeColor={polyStroke}
        polygonAltitude={0.008}
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