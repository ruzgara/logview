// Temporary overrides for demo visitors. The demo account is read-only on the
// backend, so location and agent changes are kept in memory instead: they are
// never shared and reset when the page reloads.

import type { ServerLocation } from './components/ServerLocationModal'
import type { Agent } from './types'

type DemoState = {
  location?: ServerLocation
  createdAgents: Agent[]
  deletedAgentIds: string[]
}

let state: DemoState = { createdAgents: [], deletedAgentIds: [] }

const update = (fn: (s: DemoState) => DemoState) => {
  state = fn(state)
}

export const getDemoLocation = () => state.location

export const setDemoLocation = (location: ServerLocation) =>
  update((s) => ({ ...s, location }))

// Applies this session's created/deleted agents on top of the server's list
export const applyDemoAgents = (serverAgents: Agent[]): Agent[] =>
  [...state.createdAgents, ...serverAgents].filter(
    (agent) => !state.deletedAgentIds.includes(agent.id),
  )

export const createDemoAgent = (type: string, source: string) => {
  const created = new Date().toISOString()
  const agent: Agent = { id: `demo_${crypto.randomUUID()}`, type, source, created }
  update((s) => ({ ...s, createdAgents: [agent, ...s.createdAgents] }))
  const random = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) =>
    b.toString(36).padStart(2, '0'),
  ).join('').slice(0, 35)
  return { created_at: created, key: `lv_demo_${random}` }
}

export const deleteDemoAgent = (id: string) =>
  update((s) => ({
    ...s,
    createdAgents: s.createdAgents.filter((agent) => agent.id !== id),
    deletedAgentIds: id.startsWith('demo_') ? s.deletedAgentIds : [...s.deletedAgentIds, id],
  }))
