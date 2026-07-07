import { useState } from 'react'
import { pb } from '../pocketbase'

type NewKeyInfo = {
    created_at: string
    key: string
}

type Props = {
    onCreated: () => void
    onCancel?: () => void
}

const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })

function AgentCreateForm({ onCreated, onCancel }: Props) {
    const [agentType, setAgentType] = useState('rest_api')
    const [agentSource, setAgentSource] = useState('traefik')
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const [newKey, setNewKey] = useState<NewKeyInfo | null>(null)
    const [copied, setCopied] = useState(false)

    const handleCreate = async () => {
        setCreating(true)
        setCreateError(null)
        try {
            const data = await pb.send<NewKeyInfo>('/api/generate_agent', {
                method: 'POST',
                body: JSON.stringify({ agent_type: agentType, agent_source: agentSource }),
            })
            setNewKey(data)
            setCopied(false)
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create agent.')
        } finally {
            setCreating(false)
        }
    }

    const handleCopy = () => {
        if (!newKey) return
        void navigator.clipboard.writeText(newKey.key).then(() => setCopied(true))
    }

    const handleDone = () => {
        setNewKey(null)
        onCreated()
    }

    return (
        <>
            <div className="agent-create-fields">
                <div className="location-field">
                    <label className="location-label" htmlFor="agent-type-select">
                        Agent Type
                    </label>
                    <select
                        id="agent-type-select"
                        className="location-select"
                        value={agentType}
                        onChange={(e) => setAgentType(e.target.value)}
                        disabled={creating}
                    >
                        <option value="rest_api">REST API</option>
                    </select>
                </div>
                <div className="location-field">
                    <label className="location-label" htmlFor="agent-source-select">
                        Agent Source
                    </label>
                    <select
                        id="agent-source-select"
                        className="location-select"
                        value={agentSource}
                        onChange={(e) => setAgentSource(e.target.value)}
                        disabled={creating}
                    >
                        <option value="traefik">Traefik</option>
                    </select>
                </div>
            </div>
            {createError && <p className="location-error">{createError}</p>}
            <div className="location-footer">
                {onCancel && (
                    <button type="button" className="btn btn-ghost" onClick={onCancel}>
                        Close
                    </button>
                )}
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleCreate()}
                    disabled={creating}
                >
                    {creating ? 'Creating…' : 'Create Agent'}
                </button>
            </div>

            {newKey && (
                <div className="modal-backdrop agent-key-backdrop">
                    <div className="modal agent-key-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>Agent Created</h2>
                                <p className="modal-subtitle">
                                    Created {formatDate(newKey.created_at)}
                                </p>
                            </div>
                        </div>
                        <div className="modal-body">
                            <p className="agent-key-warning">
                                This key will only be shown once. Copy and store it securely before closing.
                            </p>
                            <div className="agent-key-row">
                                <code className="agent-key-value">{newKey.key}</code>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={handleCopy}
                                >
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <div className="location-footer">
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleDone}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default AgentCreateForm
