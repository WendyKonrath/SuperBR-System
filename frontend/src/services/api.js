import Cookies from 'js-cookie';
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

class ApiService {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = Cookies.get("token");
    this.logoutCallback = null;
  }

  setLogoutCallback(callback) {
    this.logoutCallback = callback;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      // Cookie expira em 7 dias por padrão
      Cookies.set("token", token, { expires: 7, path: '/' });
    } else {
      Cookies.remove("token", { path: '/' });
    }
  }

  getToken() {
    return this.token || Cookies.get("token");
  }

  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Se for na rota de login, não fazemos o logout automático para deixar o erro de "Senha incorreta" aparecer
        if (endpoint.includes("/auth/login")) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.erro || "Credenciais inválidas");
        }

        console.warn("Sessão expirada ou não autorizada. Deslogando...");
        this.setToken(null);
        if (this.logoutCallback) {
          this.logoutCallback();
        }
        throw new Error("Sessão expirada. Por favor, faça login novamente.");
      }

      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.erro || "Muitas tentativas. Aguarde um momento.");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.erro || `Erro ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      if (error.message === "Failed to fetch") {
        throw new Error(
          "Não foi possível conectar ao servidor. Verifique se o back-end está em execução.",
        );
      }
      throw error;
    }
  }

  get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: "GET" });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }
}

export const api = new ApiService();
export default api;
