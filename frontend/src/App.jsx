import React from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';
import AILab from './pages/AILab';
import Blueprints from './pages/Blueprints';
import Dashboard from './pages/Dashboard';
import DependencyAudit from './pages/DependencyAudit';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Register from './pages/Register';
import ScriptRepo from './pages/ScriptRepo';
import Settings from './pages/Settings';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
          <div className="max-w-2xl rounded-3xl border border-red-500/20 bg-red-500/10 p-8 shadow-2xl shadow-red-500/10">
            <h1 className="text-2xl font-bold mb-4">Application failed to render</h1>
            <p className="text-sm text-red-100 mb-4">An unrecoverable error occurred while rendering the app.</p>
            <pre className="text-xs text-red-200 whitespace-pre-wrap break-all bg-black/20 rounded-xl p-4">{String(this.state.error)}</pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <AppErrorBoundary>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/ai-lab" element={<AILab />} />
                <Route path="/blueprints" element={<Blueprints />} />
                <Route path="/repo" element={<ScriptRepo />} />
                <Route path="/audit" element={<DependencyAudit />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </AppErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
