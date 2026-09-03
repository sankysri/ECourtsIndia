import { ecourtsClient } from './ecourtsIndiaClient.js';

export class CaseDetailService {
  /**
   * Fetches full case details from the eCourts API
   */
  static async getCaseDetail(cnrNumber) {
    if (!cnrNumber) {
      throw new Error('Case CNR number is required to fetch details');
    }

    const normalizedCnr = String(cnrNumber).toUpperCase().trim();

    return ecourtsClient.request({
      endpoint: `/cases/detail/${normalizedCnr}`,
      method: 'GET',
      caseCnr: normalizedCnr,
    });
  }

  static async getCaseOrders(cnrNumber) {
    const normalizedCnr = String(cnrNumber).toUpperCase().trim();
    return ecourtsClient.request({
      endpoint: `/cases/orders/${normalizedCnr}`,
      method: 'GET',
      caseCnr: normalizedCnr,
    });
  }

  static async getCaseJudgments(cnrNumber) {
    const normalizedCnr = String(cnrNumber).toUpperCase().trim();
    return ecourtsClient.request({
      endpoint: `/cases/judgments/${normalizedCnr}`,
      method: 'GET',
      caseCnr: normalizedCnr,
    });
  }
}
