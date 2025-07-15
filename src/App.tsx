import { AudioSubtitleEditor } from './components/AudioSubtitleEditor'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <AudioSubtitleEditor />
    </ErrorBoundary>
  )
}

export default App