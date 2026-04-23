import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Estoque from './pages/Estoque'
import Sucata from './pages/Sucata'
import Vendas from './pages/Vendas'
import Relatorios from './pages/Relatorios'
import Notificacoes from './pages/Notificacoes'
import Produtos from './pages/Produtos'
import Servicos from './pages/Servicos'
import Usuarios from './pages/Usuarios'
import Movimentacoes from './pages/Movimentacoes'
import Configuracoes from './pages/Configuracoes'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Navigate to="/" replace />} />

          <Route path="/dashboard" element={
            <ProtectedRoute allowedProfiles={['admin', 'gerente', 'financeiro']}>
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/estoque" element={
            <ProtectedRoute>
              <Layout><Estoque /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/sucata" element={
            <ProtectedRoute allowedProfiles={['admin', 'gerente', 'financeiro', 'vendas']}>
              <Layout><Sucata /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/vendas" element={
            <ProtectedRoute allowedProfiles={['admin', 'gerente', 'vendas', 'financeiro']}>
              <Layout><Vendas /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/relatorios" element={
            <ProtectedRoute allowedProfiles={['admin', 'gerente', 'financeiro']}>
              <Layout><Relatorios /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/notificacoes" element={
            <ProtectedRoute allowedProfiles={['admin', 'gerente']}>
              <Layout><Notificacoes /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/produtos" element={
            <ProtectedRoute>
              <Layout><Produtos /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/servicos" element={
            <ProtectedRoute>
              <Layout><Servicos /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/usuarios" element={
            <ProtectedRoute allowedProfiles={['admin']}>
              <Layout><Usuarios /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/movimentacoes" element={
            <ProtectedRoute allowedProfiles={['admin', 'gerente', 'financeiro']}>
              <Layout><Movimentacoes /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/configuracoes" element={
            <ProtectedRoute allowedProfiles={['admin', 'superadmin']}>
              <Layout><Configuracoes /></Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App