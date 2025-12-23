// src/App.jsx
import AppProviders from './app/AppProviders.jsx'
import AppShell from './app/AppShell.jsx'
import './index.css'

function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  )
}

export default App
