import { ecourtsClient } from './ecourtsIndiaClient.js';

export class CaseSearchService {
  /**
   * Paginated Case Discovery Search
   */
  static async discoverCases({ courtCode, filingYear = 2024, caseType = 'WP', partyName = '', advocateName = '', page = 1, limit = 10, customTotalPages = 3 }) {
    return ecourtsClient.request({
      endpoint: '/cases/search/discover',
      method: 'POST',
      data: {
        courtCode,
        filingYear,
        caseType,
        partyName,
        advocateName,
        page,
        limit,
        customTotalPages,
      },
      courtCode,
    });
  }

  static async searchByCnr(cnrNumber) {
    return ecourtsClient.request({
      endpoint: '/cases/search/cnr',
      method: 'POST',
      data: { cnr: cnrNumber },
      caseCnr: cnrNumber,
    });
  }

  static async searchByParty(courtCode, partyName, filingYear) {
    return ecourtsClient.request({
      endpoint: '/cases/search/party',
      method: 'POST',
      data: { courtCode, partyName, filingYear },
      courtCode,
    });
  }

  static async searchByAdvocate(courtCode, advocateName, filingYear) {
    return ecourtsClient.request({
      endpoint: '/cases/search/advocate',
      method: 'POST',
      data: { courtCode, advocateName, filingYear },
      courtCode,
    });
  }
}
