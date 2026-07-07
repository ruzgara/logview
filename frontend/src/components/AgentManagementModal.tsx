import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { pb } from '../pocketbase'
import Modal from './Modal'
import AgentCreateForm from './AgentCreateForm'

type Agent = {
    id: string
    type: string
    source: string
    created: string
}

type Props = {
    onClose: () => void
}

const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })

function AgentManagementModal({ onClose }: Props) {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [refreshTick, setRefreshTick] = useState(0)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        let active = true
        pb.collection('agents')
            .getList<Agent>(1, 200, { sort: '-created' })
            .then((result) => {
                if (!active) return
                setAgents(result.items)
                setError(null)
                setLoading(false)
            })
            .catch((err) => {
                if (!active) return
                setError(err instanceof Error ? err.message : 'Failed to load agents.')
                setLoading(false)
            })
        return () => { active = false }
    }, [refreshTick])

    const handleDelete = async () => {
        if (!confirmDeleteId) return
        setDeleting(true)
        try {
            await pb.collection('agents').delete(confirmDeleteId)
            setConfirmDeleteId(null)
            setRefreshTick((t) => t + 1)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete agent.')
            setConfirmDeleteId(null)
        } finally {
            setDeleting(false)
        }
    }

    return (
        <>
            <Modal
                title="Agents"
                subtitle="Manage your API agents"
                onClose={onClose}
                className="agent-modal"
            >
                <div className="agent-table-wrapper">
                    {loading && <p className="modal-state">Loading agents…</p>}
                    {!loading && error && (
                        <p className="modal-state location-error">{error}</p>
                    )}
                    {!loading && !error && agents.length === 0 && (
                        <p className="modal-state" style={{ textAlign: 'center' }}>No agents yet.</p>
                    )}
                    {!loading && !error && agents.length > 0 && (
                        <table className="agent-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Source</th>
                                    <th>Created</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {agents.map((agent) => (
                                    <tr key={agent.id}>
                                        <td>{agent.type}</td>
                                        <td>{agent.source}</td>
                                        <td>{formatDate(agent.created)}</td>
                                        <td className="agent-table-actions">
                                            <button
                                                type="button"
                                                className="agent-delete-btn"
                                                aria-label="Delete agent"
                                                onClick={() => setConfirmDeleteId(agent.id)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="agent-create-section">
                    <h3 className="agent-create-title">Create Agent</h3>
                    <AgentCreateForm
                        onCreated={() => setRefreshTick((t) => t + 1)}
                        onCancel={onClose}
                    />
                </div>
            </Modal>

            {confirmDeleteId && (
                <div className="modal-backdrop agent-key-backdrop">
                    <div className="modal agent-key-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>Delete Agent</h2>
                                <p className="modal-subtitle">This action cannot be undone.</p>
                            </div>
                        </div>
                        <div className="modal-body">
                            <p className="agent-key-warning">
                                Are you sure you want to delete this agent? Any integrations using its key will stop working immediately.
                            </p>
                            <div className="location-footer">
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => setConfirmDeleteId(null)}
                                    disabled={deleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={() => void handleDelete()}
                                    disabled={deleting}
                                >
                                    {deleting ? 'Deleting…' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default AgentManagementModal
