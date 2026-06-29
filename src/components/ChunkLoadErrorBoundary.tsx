import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChunkLoadError, reloadForStaleChunks } from '../utils/chunkLoadRecovery'

type Props = {
  children: ReactNode
}

type State = {
  pendingReload: boolean
  needsManualRefresh: boolean
}

function RefreshSpinner() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white px-4 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      <p className="text-sm text-gray-600">Loading the latest version…</p>
    </div>
  )
}

export class ChunkLoadErrorBoundary extends Component<Props, State> {
  state: State = { pendingReload: false, needsManualRefresh: false }

  static getDerivedStateFromError(error: unknown): Partial<State> | null {
    if (isChunkLoadError(error)) {
      return { pendingReload: true }
    }
    return null
  }

  componentDidCatch(error: unknown, _info: ErrorInfo): void {
    if (!isChunkLoadError(error)) return
    if (!reloadForStaleChunks()) {
      this.setState({ pendingReload: false, needsManualRefresh: true })
    }
  }

  render(): ReactNode {
    if (this.state.needsManualRefresh) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white px-4 text-center">
          <p className="text-gray-800">A new version of this page is available.</p>
          <button
            type="button"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </button>
        </div>
      )
    }
    if (this.state.pendingReload) {
      return <RefreshSpinner />
    }
    return this.props.children
  }
}
