import api from './api';

export const dashboardService = {
  async obterEstatisticas() {
    return await api.get('/dashboard/stats');
  }
};

export default dashboardService;
