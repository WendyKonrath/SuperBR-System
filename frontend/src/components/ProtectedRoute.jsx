import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, allowedProfiles }) {
  const { isAuthenticated, usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedProfiles && usuario && !allowedProfiles.includes(usuario.perfil) && usuario.perfil !== 'superadmin') {
    // Redirecionamento dinâmico para evitar loops: 
    // Vendedores vão para /vendas, demais para /dashboard (que é permitido para eles)
    const fallbackPath = usuario.perfil === 'vendas' ? '/vendas' : '/dashboard';
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}

export default ProtectedRoute;