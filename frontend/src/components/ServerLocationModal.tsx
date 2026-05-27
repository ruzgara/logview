import { useState } from 'react'
import { pb } from '../pocketbase'
import { COUNTRY_COORDS } from './ConnectionGlobe'

const COUNTRY_NAMES: Record<string, string> = {
  AE: 'United Arab Emirates', AF: 'Afghanistan', AL: 'Albania',
  AO: 'Angola', AR: 'Argentina', AT: 'Austria', AU: 'Australia',
  AZ: 'Azerbaijan', BD: 'Bangladesh', BE: 'Belgium', BG: 'Bulgaria',
  BR: 'Brazil', CA: 'Canada', CD: 'Congo (DRC)', CH: 'Switzerland',
  CL: 'Chile', CN: 'China', CO: 'Colombia', CZ: 'Czech Republic',
  DE: 'Germany', DK: 'Denmark', DZ: 'Algeria', EG: 'Egypt',
  ES: 'Spain', ET: 'Ethiopia', FI: 'Finland', FR: 'France',
  GB: 'United Kingdom', GH: 'Ghana', GR: 'Greece', HK: 'Hong Kong',
  HU: 'Hungary', ID: 'Indonesia', IE: 'Ireland', IL: 'Israel',
  IN: 'India', IQ: 'Iraq', IR: 'Iran', IT: 'Italy',
  JP: 'Japan', KE: 'Kenya', KH: 'Cambodia', KR: 'South Korea',
  KW: 'Kuwait', KZ: 'Kazakhstan', LB: 'Lebanon', LK: 'Sri Lanka',
  LT: 'Lithuania', MA: 'Morocco', MX: 'Mexico', MY: 'Malaysia',
  NG: 'Nigeria', NL: 'Netherlands', NO: 'Norway', NZ: 'New Zealand',
  PA: 'Panama', PE: 'Peru', PH: 'Philippines', PK: 'Pakistan',
  PL: 'Poland', PT: 'Portugal', QA: 'Qatar', RO: 'Romania',
  RS: 'Serbia', RU: 'Russia', SA: 'Saudi Arabia', SE: 'Sweden',
  SG: 'Singapore', SK: 'Slovakia', TH: 'Thailand', TN: 'Tunisia',
  TR: 'Turkey', TW: 'Taiwan', UA: 'Ukraine', US: 'United States',
  UZ: 'Uzbekistan', VE: 'Venezuela', VN: 'Vietnam', YE: 'Yemen',
  ZA: 'South Africa', ZM: 'Zambia',
}

export type ServerLocation = { country?: string; lat?: number; lng?: number }

type Props = {
  current: ServerLocation
  recordId: string
  onSave: (loc: ServerLocation) => void
  onClose: () => void
}

const sortedCountries = Object.keys(COUNTRY_COORDS)
  .map((code) => ({ code, name: COUNTRY_NAMES[code] ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name))

function ServerLocationModal({ current, recordId, onSave, onClose }: Props) {
  const initialMode: 'country' | 'coords' =
    current.lat !== undefined ? 'coords' : 'country'

  const [mode, setMode] = useState<'country' | 'coords'>(initialMode)
  const [selectedCountry, setSelectedCountry] = useState(current.country ?? '')
  const [latInput, setLatInput] = useState(
    current.lat !== undefined ? String(current.lat) : '',
  )
  const [lngInput, setLngInput] = useState(
    current.lng !== undefined ? String(current.lng) : '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      if (mode === 'country') {
        if (!selectedCountry) {
          setError('Please select a country.')
          setSaving(false)
          return
        }
        await pb.collection('settings').update(recordId, {
          value: { country_code: selectedCountry },
        })
        onSave({ country: selectedCountry })
      } else {
        const lat = parseFloat(latInput)
        const lng = parseFloat(lngInput)
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
          setError('Latitude must be a number between -90 and 90.')
          setSaving(false)
          return
        }
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
          setError('Longitude must be a number between -180 and 180.')
          setSaving(false)
          return
        }
        await pb.collection('settings').update(recordId, {
          value: { lat_long: `${lat},${lng}` },
        })
        onSave({ lat, lng })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal location-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Server Location</h2>
            <p className="modal-subtitle">
              Set where your server should be located
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="location-tabs">
            <button
              type="button"
              className={`btn btn-ghost location-tab${mode === 'country' ? ' active' : ''}`}
              onClick={() => setMode('country')}
            >
              Country
            </button>
            <button
              type="button"
              className={`btn btn-ghost location-tab${mode === 'coords' ? ' active' : ''}`}
              onClick={() => setMode('coords')}
            >
              Coordinates
            </button>
          </div>

          {mode === 'country' && (
            <div className="location-field">
              <label className="location-label" htmlFor="country-select">
                Country
              </label>
              <select
                id="country-select"
                className="location-select"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
              >
                <option value="">— Select a country —</option>
                {sortedCountries.map(({ code, name }) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'coords' && (
            <div className="location-coords">
              <div className="location-field">
                <label className="location-label" htmlFor="lat-input">
                  Latitude
                </label>
                <input
                  id="lat-input"
                  type="number"
                  className="location-input"
                  placeholder="e.g. 41.7255"
                  min={-90}
                  max={90}
                  step="any"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                />
              </div>
              <div className="location-field">
                <label className="location-label" htmlFor="lng-input">
                  Longitude
                </label>
                <input
                  id="lng-input"
                  type="number"
                  className="location-input"
                  placeholder="e.g. -49.9469"
                  min={-180}
                  max={180}
                  step="any"
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && <p className="location-error">{error}</p>}

          <div className="location-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ServerLocationModal
