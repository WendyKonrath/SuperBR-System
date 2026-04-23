import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaBatteryFull, FaEye, FaEyeSlash } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import { authService } from '../services/auth'

function Login() {
  const navigate = useNavigate()
  const { login, loading, error: authError } = useAuth()
  const [loginValue, setLoginValue] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [primeiroAcesso, setPrimeiroAcesso] = useState(false)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loginFornecido, setLoginFornecido] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { usuario } = useAuth()

  useEffect(() => {
    if (usuario) {
      const target = usuario.perfil === 'vendas' ? '/vendas' : '/dashboard'
      navigate(target)
    }
  }, [usuario, navigate])

  // Sincroniza erros globais (como Rate Limit) para a tela de login
  useEffect(() => {
    if (authError) {
      setError(authError)
    }
  }, [authError])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!loginValue || !senha) {
      setError('Informe login e senha')
      return
    }

    const result = await login(loginValue, senha)

    if (result.primeiroAcesso) {
      setPrimeiroAcesso(true)
      setLoginFornecido(loginValue)
      return
    }

    if (result.success) {
      const target = result.perfil === 'vendas' ? '/vendas' : '/dashboard'
      navigate(target)
    } else {
      // Prioriza erro vindo do resultado da api
      setError(result.error || 'Erro ao realizar login')
    }
  }

  const handlePrimeiroAcesso = async (e) => {
    e.preventDefault()
    setError('')

    if (!novaSenha || novaSenha.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres')
      return
    }

    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem')
      return
    }

    try {
      const response = await authService.primeiroAcesso(loginFornecido, novaSenha)
      authService.setToken(response.token)
      // Recarrega para limpar estados e carregar perfil correto
      window.location.href = response.perfil === 'vendas' ? '/vendas' : '/dashboard'
    } catch (err) {
      setError(err.message || 'Erro ao definir senha')
    }
  }

  if (primeiroAcesso) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <FaBatteryFull className="login-brand__icon" style={{ fontSize: '48px', color: 'var(--primary-color)' }} />
            <h1 className="login-brand__name">Baterias SuperBR</h1>
          </div>
          <h2 className="login-brand__subtitle">Defina sua senha inicial</h2>
          <p style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>
            Olá, {loginFornecido}! Esta é seu primeiro acesso. Crie uma senha com no mínimo 8 caracteres.
          </p>
          <form onSubmit={handlePrimeiroAcesso}>
            <div className="form-group">
              <label htmlFor="novaSenha">Nova Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="novaSenha"
                  placeholder="Mínimo 8 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  minLength={8}
                  required
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="confirmarSenha">Confirmar Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="confirmarSenha"
                  placeholder="Repita a senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  minLength={8}
                  required
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            {error && (
              <div className="login-error" style={{ 
                color: '#dc2626', 
                backgroundColor: '#fee2e2', 
                padding: '12px', 
                borderRadius: '8px', 
                marginBottom: '16px',
                textAlign: 'center',
                fontSize: '0.9rem',
                fontWeight: '600',
                border: '1px solid #fecaca',
                display: 'block'
              }}>
                {error}
              </div>
            )}
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Definindo senha...' : 'Definir Senha'}
            </button>
            <button type="button" className="login-btn" style={{ background: '#666', marginTop: '10px' }} onClick={() => setPrimeiroAcesso(false)}>
              Voltar
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <FaBatteryFull className="login-brand__icon" style={{ fontSize: '48px', color: 'var(--primary-color)' }} />
          <h1 className="login-brand__name">Baterias SuperBR</h1>
        </div>
        <h2 className="login-brand__subtitle">Acesse sua conta</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Usuário</label>
            <input
              type="text"
              id="username"
              placeholder="Digite seu usuário"
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                required
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          {error && (
            <div className="login-error" style={{ 
              color: '#dc2626', 
              backgroundColor: '#fee2e2', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: '16px',
              textAlign: 'center',
              fontSize: '0.9rem',
              fontWeight: '600',
              border: '1px solid #fecaca',
              display: 'block'
            }}>
              {error}
            </div>
          )}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login