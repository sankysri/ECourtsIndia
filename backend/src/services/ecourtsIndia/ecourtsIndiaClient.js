import { env } from '../../config/env.js';
import { db } from '../../database/datastore.js';
import { logger } from '../../utils/logger.js';
import { RateLimiter } from './rateLimiter.js';
import { v4 as uuidv4 } from 'uuid';
import https from 'node:https';

function httpsRequest(urlString, { method = 'GET', headers = {}, body = null, timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const reqHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NyayaData/1.0',
        ...headers,
      };
      if (body) {
        const payload = typeof body === 'string' ? body : JSON.stringify(body);
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers: reqHeaders,
        timeout,
      }, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : null;
            resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: parsed, text: rawData });
          } catch (e) {
            resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: null, text: rawData });
          }
        });
      });

      req.on('error', (err) => reject(new Error(`HTTPS Request to ${url.hostname} failed: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Upstream request to ${url.hostname} timed out after ${timeout}ms`));
      });

      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Central eCourtsIndia API Client
 * Manages Auth, Retries, Timeouts, Rate Limiting, Request Logging & Error Normalization.
 */
export class ECourtsIndiaClient {
  constructor() {
    this.baseUrl = env.ECOURTS_API_BASE_URL;
    this.apiKey = env.ECOURTS_API_KEY;
    this.timeoutMs = 45000;
    this.maxRetries = 3;
    this.isMock = env.ECOURTS_USE_MOCK || !this.apiKey || this.apiKey.startsWith('mock') || !this.baseUrl.startsWith('http');
  }

  async _resolveConfig() {
    try {
      const dbKey = await db.getSettingByKey('ecourts_api_key');
      const dbUrl = await db.getSettingByKey('ecourts_api_base_url');
      const dbUseMock = await db.getSettingByKey('ecourts_use_mock');

      const apiKey = (dbKey?.value !== undefined && dbKey?.value !== '') ? dbKey.value : (env.ECOURTS_API_KEY || '');
      const baseUrl = (dbUrl?.value !== undefined && dbUrl?.value !== '') ? dbUrl.value : (env.ECOURTS_API_BASE_URL || 'https://api.ecourts.gov.in/v1');

      // Live mode is ONLY active if a non-empty, non-mock API key is provided and mock is not explicitly forced
      const hasLiveKey = Boolean(apiKey && !String(apiKey).startsWith('mock') && String(apiKey).trim() !== '');
      const forceMock = dbUseMock?.value === true || dbUseMock?.value === 'true' || env.ECOURTS_USE_MOCK;

      const isMock = forceMock || !hasLiveKey || !String(baseUrl).startsWith('http');

      return { apiKey, baseUrl, isMock };
    } catch {
      return {
        apiKey: this.apiKey,
        baseUrl: this.baseUrl,
        isMock: true,
      };
    }
  }

  /**
   * Core request dispatcher with rate limiter, timeout, retries, and logging
   */
  async request({ endpoint, method = 'GET', data = null, params = {}, caseCnr = null, courtCode = null }) {
    const requestIdentifier = `req_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const startTime = Date.now();
    let attempt = 0;
    let lastError = null;

    const { apiKey, baseUrl, isMock } = await this._resolveConfig();

    logger.info(`[eCourtsClient] Initiating ${method} ${endpoint} (${requestIdentifier}) [Mode: ${isMock ? 'MOCK' : 'LIVE'}]`, {
      caseCnr,
      courtCode,
    });

    while (attempt < this.maxRetries) {
      attempt++;

      // 1. Enforce Central Rate Limiting
      const rateCheck = await RateLimiter.acquire();
      if (!rateCheck.allowed) {
        logger.warn(`[eCourtsClient] Rate limit throttled: ${rateCheck.reason}. Retrying after ${rateCheck.retryAfterMs}ms...`);
        if (attempt >= this.maxRetries) {
          const duration = Date.now() - startTime;
          await this._logRequest({
            endpoint,
            method,
            requestIdentifier,
            caseCnr,
            courtCode,
            statusCode: 429,
            success: false,
            responseTimeMs: duration,
            errorMessage: rateCheck.reason,
          });
          throw this._normalizeError(429, rateCheck.reason, 'RATE_LIMIT_EXCEEDED');
        }
        await new Promise((resolve) => setTimeout(resolve, rateCheck.retryAfterMs));
        continue;
      }

      try {
        let responsePayload;

        if (isMock) {
          // Process via developer mock provider with realistic latency simulation
          await new Promise((resolve) => setTimeout(resolve, 35));
          responsePayload = await this._handleMockResponse(endpoint, method, data, params, caseCnr);
        } else {
          // Process via live eCourtsIndia API adapter
          responsePayload = await this._handleLiveRequest(endpoint, method, data, params, caseCnr, baseUrl, apiKey);
        }

        const duration = Date.now() - startTime;
        const estimatedCost = this._calculateEstimatedCost(endpoint);

        // 2. Log successful request in database
        await this._logRequest({
          endpoint,
          method,
          requestIdentifier,
          caseCnr,
          courtCode,
          statusCode: 200,
          success: true,
          responseTimeMs: duration,
          estimatedCost,
          errorMessage: null,
        });

        logger.info(`[eCourtsClient] Completed ${method} ${endpoint} in ${duration}ms [200 OK]`);
        return responsePayload;
      } catch (err) {
        lastError = err;
        logger.warn(`[eCourtsClient] Attempt ${attempt}/${this.maxRetries} failed: ${err.message}`);

        if (attempt < this.maxRetries) {
          const backoffDelay = Math.pow(2, attempt) * 500;
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      } finally {
        await RateLimiter.release();
      }
    }

    // All retries failed
    const duration = Date.now() - startTime;
    await this._logRequest({
      endpoint,
      method,
      requestIdentifier,
      caseCnr,
      courtCode,
      statusCode: 502,
      success: false,
      responseTimeMs: duration,
      errorMessage: lastError?.message || 'Upstream service unavailable',
    });

    throw this._normalizeError(502, lastError?.message || 'Upstream request failed after retries', 'UPSTREAM_API_ERROR');
  }

  _calculateEstimatedCost(endpoint) {
    if (endpoint.includes('/judgments') || endpoint.includes('/orders')) return 0.0500;
    if (endpoint.includes('/cases/search') || endpoint.includes('/cases/detail')) return 0.0100;
    return 0.0020;
  }

  async _logRequest(logData) {
    try {
      await db.createApiRequestLog(logData);
    } catch (err) {
      logger.error('Failed to record API request log', err);
    }
  }

  _normalizeError(statusCode, message, code = 'ECOURTS_API_ERROR') {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.code = code;
    return err;
  }

  /**
   * Live request adapter for webapi.ecourtsindia.com
   */
  async _handleLiveRequest(endpoint, method, data, params, caseCnrParam, baseUrl, apiKey) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'NyayaData-Intelligence/1.0',
    };

    // 1. Court Master Hierarchy
    if (endpoint === '/courts/hierarchy' || endpoint === '/courts/master') {
      const statesRes = await httpsRequest(`${baseUrl}/api/partner/causelist/court-structure/states`, { headers });
      if (!statesRes.ok) {
        throw new Error(`Upstream states API returned HTTP ${statesRes.status}: ${statesRes.text}`);
      }
      const rawStates = statesRes.data;
      const statesList = Array.isArray(rawStates) ? rawStates : (rawStates?.data || []);

      const states = [];
      for (const s of statesList) {
        const stateCode = s.state || s.code || s.stateCode;
        const stateName = s.stateName || s.name || stateCode;

        states.push({
          code: stateCode,
          name: stateName,
          highCourts: [
            {
              code: `${stateCode}_HC_01`,
              name: `High Court of ${stateName}`,
              type: 'HIGH_COURT',
              status: 'ACTIVE',
            },
          ],
          districts: [
            {
              code: `${stateCode}_DIST_01`,
              name: `Principal District Court, ${stateName}`,
              courts: [
                {
                  code: `${stateCode}_COURT_01`,
                  name: `District Court Complex (${stateName})`,
                  type: 'DISTRICT_COURT',
                  status: 'ACTIVE',
                },
              ],
            },
          ],
        });
      }

      return {
        success: true,
        data: { states },
      };
    }

    // 2. Dynamic Enums
    if (endpoint === '/meta/enums' || endpoint === '/capabilities') {
      const enumsRes = await httpsRequest(`${baseUrl}/api/partner/enums`, { headers });
      if (!enumsRes.ok) throw new Error(`Upstream enums API returned HTTP ${enumsRes.status}: ${enumsRes.text}`);
      const rawEnums = enumsRes.data;
      const enums = rawEnums?.data?.enums || rawEnums?.enums || rawEnums;

      return {
        success: true,
        data: {
          categories: {
            court_types: (enums.courtType || []).map((e) => ({ code: e.code, label: e.description || e.code })),
            case_types: (enums.caseType || []).map((e) => ({ code: e.code, label: e.description || e.code })),
            case_statuses: (enums.caseStatus || []).map((e) => ({ code: e.code, label: e.description || e.code })),
            search_filters: [
              { code: 'CNR_NUMBER', label: '16-Digit CNR Number' },
              { code: 'CASE_NUMBER', label: 'Case Number & Year' },
              { code: 'PARTY_NAME', label: 'Petitioner / Respondent' },
              { code: 'ADVOCATE_NAME', label: 'Advocate' },
            ],
          },
        },
      };
    }

    // 3. Case Discovery Search
    if (endpoint === '/cases/search/discover' || endpoint.startsWith('/cases/search')) {
      const q = data?.partyName || data?.advocateName || data?.caseType || data?.courtCode || params?.query || params?.q || 'State';
      const page = parseInt(data?.page || params?.page || 1, 10);
      const limit = parseInt(data?.limit || params?.limit || 10, 10);

      const searchUrl = new URL(`${baseUrl}/api/partner/search`);
      searchUrl.searchParams.append('query', q);
      searchUrl.searchParams.append('page', String(page));
      searchUrl.searchParams.append('limit', String(limit));

      const searchRes = await httpsRequest(searchUrl.toString(), { headers });
      if (!searchRes.ok) {
        if (searchRes.status === 402 || searchRes.data?.error?.code === 'INSUFFICIENT_CREDITS') {
          throw new Error(`eCourts API credit balance is low or depleted: ${searchRes.data?.error?.message || 'Insufficient credits'}. Please top up your credits at ecourtsindia.com/dashboard/settings or enable Mock Mode in Settings.`);
        }
        throw new Error(`Upstream search API returned HTTP ${searchRes.status}: ${searchRes.data?.error?.message || searchRes.text}`);
      }
      const rawSearch = searchRes.data;
      const results = rawSearch?.data?.results || rawSearch?.results || [];
      const totalCount = rawSearch?.data?.totalCount || rawSearch?.totalCount || results.length;

      const cases = results.map((item) => ({
        cnr: item.cnr || item.id,
        caseNumber: item.registrationNumber || item.caseNumber || item.filingNumber || item.cnr,
        filingYear: item.filingDate ? new Date(item.filingDate).getFullYear() : (item.cnr ? parseInt(item.cnr.slice(-4), 10) : 2024),
        caseType: item.caseType || 'WP',
        title: item.title || (item.petitioners?.[0] ? `${item.petitioners[0]} vs. ${item.respondents?.[0] || 'State'}` : 'Case in eCourts'),
        status: item.caseStatus || 'PENDING',
        filingDate: item.filingDate || null,
        courtCode: item.courtCode || item.courtComplexCode || 'COURT_01',
        courtName: item.courtName || 'District Court',
      }));

      return {
        success: true,
        data: {
          courtCode: data?.courtCode || 'ALL',
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit) || 1,
          totalRecords: totalCount,
          cases,
        },
      };
    }

    // 4. Case Detail & Ingestion by CNR
    if (endpoint.startsWith('/cases/detail/') || endpoint.startsWith('/cases/')) {
      const cnr = endpoint.replace('/cases/detail/', '').replace('/cases/orders/', '').replace('/cases/judgments/', '').replace('/cases/', '') || caseCnrParam;
      const normalizedCnr = String(cnr).toUpperCase().trim();

      const caseRes = await httpsRequest(`${baseUrl}/api/partner/case/${normalizedCnr}`, { headers });
      if (!caseRes.ok) {
        if (caseRes.status === 402 || caseRes.data?.error?.code === 'INSUFFICIENT_CREDITS') {
          throw new Error(`eCourts API credit balance is low or depleted: ${caseRes.data?.error?.message || 'Insufficient credits'}. Please top up your credits at ecourtsindia.com/dashboard/settings or enable Mock Mode in Settings.`);
        }
        if (caseRes.status === 404 || caseRes.data?.error?.code === 'CASE_NOT_FOUND') {
          throw new Error(`Case CNR '${normalizedCnr}' was not found in upstream court records.`);
        }
        throw new Error(`Upstream case detail API responded with HTTP ${caseRes.status}: ${caseRes.data?.error?.message || caseRes.text}`);
      }
      const rawDetail = caseRes.data;
      const raw = rawDetail?.data || rawDetail;
      const courtCaseData = raw.courtCaseData || raw;

      const petitioners = raw.petitioners || courtCaseData.petitioners || [];
      const respondents = raw.respondents || courtCaseData.respondents || [];
      const petAdvocates = raw.petitionerAdvocates || courtCaseData.petitionerAdvocates || [];
      const respAdvocates = raw.respondentAdvocates || courtCaseData.respondentAdvocates || [];
      const judges = raw.judges || courtCaseData.judges || [];
      const rawHearings = courtCaseData.historyOfCaseHearings || raw.history || courtCaseData.history || raw.hearings || [];
      const rawOrders = [
        ...(courtCaseData.interimOrders || []),
        ...(courtCaseData.judgmentOrders || []),
        ...(raw.judgmentOrders || []),
        ...(raw.orders || [])
      ];

      const title = courtCaseData.title || (petitioners[0] ? `${typeof petitioners[0] === 'string' ? petitioners[0] : petitioners[0].name} vs. ${typeof respondents[0] === 'string' ? respondents[0] : respondents[0]?.name || 'State'}` : normalizedCnr);

      return {
        success: true,
        data: {
          cnr: normalizedCnr,
          case_number: courtCaseData.registrationNumber || courtCaseData.caseNumber || courtCaseData.filingNumber || normalizedCnr,
          case_type: courtCaseData.caseType || 'WP',
          filing_number: courtCaseData.filingNumber || '',
          filing_date: courtCaseData.filingDate || null,
          registration_number: courtCaseData.registrationNumber || courtCaseData.caseNumber || '',
          registration_date: courtCaseData.registrationDate || null,
          first_hearing_date: courtCaseData.firstHearingDate || null,
          next_hearing_date: courtCaseData.nextHearingDate || null,
          decision_date: courtCaseData.decisionDate || null,
          status: courtCaseData.caseStatus || 'PENDING',
          case_status: courtCaseData.caseStatus || 'PENDING',
          court_code: courtCaseData.cnrCourtCode || courtCaseData.courtComplexCode || 'COURT_01',
          court_name: courtCaseData.courtName || `${courtCaseData.district || 'District'} Court`,
          under_acts: courtCaseData.actsAndSections || raw.actsAndSections || 'N/A',
          title,
          parties: {
            petitioners: petitioners.map((p, idx) => ({
              partyNumber: idx + 1,
              name: typeof p === 'string' ? p : p.name,
              gender: p.gender || null,
              address: p.address || null,
            })),
            respondents: respondents.map((r, idx) => ({
              partyNumber: idx + 1,
              name: typeof r === 'string' ? r : r.name,
              gender: r.gender || null,
              address: r.address || null,
            })),
          },
          advocates: [
            ...petAdvocates.map((a) => ({
              name: typeof a === 'string' ? a : a.name,
              partyType: 'PETITIONER',
              barRegistrationNumber: a.barRegistrationNumber || null,
            })),
            ...respAdvocates.map((a) => ({
              name: typeof a === 'string' ? a : a.name,
              partyType: 'RESPONDENT',
              barRegistrationNumber: a.barRegistrationNumber || null,
            })),
          ],
          judges: judges.map((j) => ({
            name: typeof j === 'string' ? j : j.name,
            designation: j.designation || 'Hon\'ble Presiding Officer',
            role: 'PRESIDING',
          })),
          hearings: rawHearings.map((h) => ({
            hearingDate: h.hearingDate || h.businessOnDate || h.date,
            courtHallNumber: h.courtOf || h.courtHallNumber || 'Court Hall',
            judgeName: h.judgeName || '-',
            businessPurpose: h.purposeOfListing || h.business || h.businessPurpose || 'Proceedings',
            nextHearingDate: h.nextHearingDate || null,
            nextPurpose: h.nextPurpose || null,
          })),
          orders: rawOrders.map((o, idx) => ({
            orderNumber: idx + 1,
            orderDate: o.orderDate || o.date || new Date().toISOString().split('T')[0],
            orderType: o.orderType || o.description || 'Order',
            judgeName: o.judgeName || '-',
            documentUrl: o.orderUrl || o.url || '#',
          })),
          raw_payload: raw,
        },
      };
    }

    // Generic live fetch for other direct endpoints
    const url = new URL(`${baseUrl}${endpoint}`);
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.append(k, v));
    const res = await httpsRequest(url.toString(), {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) {
      throw new Error(`Upstream API returned HTTP ${res.status}: ${res.text}`);
    }
    return res.data;
  }

  /**
   * Built-in Mock Provider for authentic Indian Court structures, discovery & full case dockets
   */
  async _handleMockResponse(endpoint, method, data, params, caseCnrParam) {
    // 1. Court Master Hierarchy
    if (endpoint === '/courts/hierarchy' || endpoint === '/courts/master') {
      return {
        success: true,
        data: {
          states: [
            {
              code: 'MH',
              name: 'Maharashtra',
              highCourts: [
                {
                  code: 'BOM_HC_BOMBAY',
                  name: 'High Court of Bombay (Principal Bench)',
                  type: 'HIGH_COURT',
                  status: 'ACTIVE',
                  metadata: { established: 1862, jurisdiction: 'Maharashtra & Goa' },
                },
                {
                  code: 'BOM_HC_NAGPUR',
                  name: 'High Court of Bombay at Nagpur',
                  type: 'HIGH_COURT',
                  status: 'ACTIVE',
                  parentCourtCode: 'BOM_HC_BOMBAY',
                },
                {
                  code: 'BOM_HC_AURANGABAD',
                  name: 'High Court of Bombay at Aurangabad',
                  type: 'HIGH_COURT',
                  status: 'ACTIVE',
                  parentCourtCode: 'BOM_HC_BOMBAY',
                },
              ],
              districts: [
                {
                  code: 'MH_MUM',
                  name: 'Mumbai City Civil & Sessions',
                  courts: [
                    { code: 'MH_MUM_CIVIL_01', name: 'City Civil Court, Dindoshi', type: 'CITY_CIVIL_COURT', status: 'ACTIVE' },
                    { code: 'MH_MUM_CMM_01', name: 'Chief Metropolitan Magistrate Court, Esplanade', type: 'CHIEF_METROPOLITAN_MAGISTRATE', status: 'ACTIVE' },
                    { code: 'MH_MUM_FAMILY_01', name: 'Family Court, Bandra Kurla Complex', type: 'FAMILY_COURT', status: 'ACTIVE' },
                  ],
                },
                {
                  code: 'MH_PUN',
                  name: 'Pune Judicial District',
                  courts: [
                    { code: 'MH_PUN_DIST_01', name: 'District & Sessions Court, Shivajinagar', type: 'DISTRICT_COURT', status: 'ACTIVE' },
                    { code: 'MH_PUN_COMM_01', name: 'Special Commercial Court, Pune', type: 'COMMERCIAL_COURT', status: 'ACTIVE' },
                  ],
                },
              ],
            },
            {
              code: 'DL',
              name: 'Delhi (NCT)',
              highCourts: [
                {
                  code: 'DL_HC_DELHI',
                  name: 'High Court of Delhi',
                  type: 'HIGH_COURT',
                  status: 'ACTIVE',
                  metadata: { established: 1966, jurisdiction: 'National Capital Territory of Delhi' },
                },
              ],
              districts: [
                {
                  code: 'DL_CENTRAL',
                  name: 'Central District (Tis Hazari)',
                  courts: [
                    { code: 'DL_TIS_HAZARI_01', name: 'Tis Hazari District Court Complex', type: 'DISTRICT_COURT', status: 'ACTIVE' },
                  ],
                },
              ],
            },
          ],
        },
      };
    }

    // 2. Dynamic Reference Enums
    if (endpoint === '/meta/enums' || endpoint === '/capabilities') {
      return {
        success: true,
        data: {
          categories: {
            court_types: [
              { code: 'HIGH_COURT', label: 'High Court' },
              { code: 'DISTRICT_COURT', label: 'District & Sessions Court' },
              { code: 'CITY_CIVIL_COURT', label: 'City Civil Court' },
              { code: 'CHIEF_METROPOLITAN_MAGISTRATE', label: 'Chief Metropolitan Magistrate' },
              { code: 'FAMILY_COURT', label: 'Family Court' },
              { code: 'COMMERCIAL_COURT', label: 'Commercial Court' },
              { code: 'TRIBUNAL', label: 'Specialized Tribunal' },
            ],
            case_types: [
              { code: 'WP', label: 'Writ Petition' },
              { code: 'CS', label: 'Civil Suit' },
              { code: 'CC', label: 'Criminal Case' },
              { code: 'BAIL_APPL', label: 'Bail Application' },
              { code: 'ARB_PET', label: 'Arbitration Petition' },
              { code: 'CONT_CAS', label: 'Contempt Case' },
            ],
            case_statuses: [
              { code: 'PENDING', label: 'Pending' },
              { code: 'DISPOSED', label: 'Disposed' },
              { code: 'QUASHED', label: 'Quashed' },
              { code: 'TRANSFERRED', label: 'Transferred' },
            ],
            search_filters: [
              { code: 'CNR_NUMBER', label: 'CNR Number' },
              { code: 'CASE_NUMBER', label: 'Case Number & Year' },
              { code: 'PARTY_NAME', label: 'Party Name' },
              { code: 'ADVOCATE_NAME', label: 'Advocate Name' },
            ],
          },
        },
      };
    }

    // 3. Paginated Case Discovery Endpoint (M3)
    if (endpoint === '/cases/search/discover') {
      const courtCode = data?.courtCode || 'BOM_HC_BOMBAY';
      const year = data?.filingYear || 2024;
      const caseType = data?.caseType || 'WP';
      const page = parseInt(data?.page || 1, 10);
      const limit = parseInt(data?.limit || 10, 10);
      const totalPages = parseInt(data?.customTotalPages || 3, 10);

      const statePrefix = courtCode.startsWith('DL') ? 'DL' : 'MH';
      const courtPrefix = courtCode.includes('HC') ? 'HC01' : 'CC01';

      const cases = [];
      const startIndex = (page - 1) * limit;

      for (let i = 0; i < limit; i++) {
        const seq = String(startIndex + i + 1).padStart(6, '0');
        const cnr = `${statePrefix}${courtPrefix}${seq}${year}`;
        cases.push({
          cnr,
          caseNumber: `${caseType}/${startIndex + i + 1}/${year}`,
          filingYear: year,
          caseType,
          title: `Petitioner ${startIndex + i + 1} vs. State of Maharashtra & Ors`,
          status: i % 4 === 0 ? 'DISPOSED' : 'PENDING',
          filingDate: `${year}-01-${String((i % 28) + 1).padStart(2, '0')}`,
        });
      }

      return {
        success: true,
        data: {
          courtCode,
          page,
          limit,
          totalPages,
          totalRecords: totalPages * limit,
          cases,
        },
      };
    }

    // 4. Full Case Detail Ingestion (M4)
    if (endpoint.startsWith('/cases/detail/')) {
      const cnr = endpoint.replace('/cases/detail/', '') || caseCnrParam || 'MHHC010000012024';
      const year = cnr.slice(-4) || '2024';

      return {
        success: true,
        data: {
          cnr,
          case_number: `WP/${cnr.slice(6, 12).replace(/^0+/, '') || '101'}/${year}`,
          case_type: 'WP',
          filing_number: `FIL/${cnr.slice(6, 12)}/${year}`,
          filing_date: `${year}-02-15`,
          registration_number: `REG/${cnr.slice(6, 12)}/${year}`,
          registration_date: `${year}-02-18`,
          first_hearing_date: `${year}-03-01`,
          next_hearing_date: `${year}-11-20`,
          status: 'PENDING',
          sub_category: 'Civil - Constitutional Writs (Art. 226)',
          under_acts: 'Constitution of India, Art. 226 & Art. 227; Code of Civil Procedure, 1908',
          under_sections: 'Article 226; Section 151 CPC',
          police_station: 'Azad Maidan Police Station, Mumbai',
          fir_number: `FIR-${cnr.slice(8, 12)}/${year}`,
          fir_year: parseInt(year, 10),
          title: 'M/s Sovereign Infrastructure Pvt Ltd vs. State of Maharashtra & Urban Development Dept',
          parties: {
            petitioners: [
              {
                name: 'M/s Sovereign Infrastructure Pvt Ltd',
                gender: 'COMPANY',
                age: null,
                address: 'Maker Chambers VI, Nariman Point, Mumbai 400021',
                extra: { pan: 'AAACS1234F', authorizedSignatory: 'Rajesh Sharma' },
              },
              {
                name: 'Rajesh Sharma',
                gender: 'MALE',
                age: 48,
                address: 'Bandra West, Mumbai',
              },
            ],
            respondents: [
              {
                name: 'State of Maharashtra, through Principal Secretary',
                gender: 'GOVERNMENT',
                address: 'Urban Development Department, Mantralaya, Mumbai 400032',
              },
              {
                name: 'Municipal Corporation of Greater Mumbai (MCGM)',
                gender: 'STATUTORY_BODY',
                address: 'Chhatrapati Shivaji Maharaj Terminus, Mumbai',
              },
            ],
          },
          advocates: {
            petitionerAdvocates: [
              {
                name: 'Adv. Harish Salve',
                barReg: 'MAH/1042/1986',
                phone: '+91 9820011223',
                email: 'h.salve@chambers.in',
              },
              {
                name: 'Adv. Mukul Rohatgi',
                barReg: 'DEL/204/1982',
              },
            ],
            respondentAdvocates: [
              {
                name: 'Adv. Birendra Saraf',
                barReg: 'MAH/3321/1995',
                email: 'advocate.general@maharashtra.gov.in',
              },
            ],
          },
          judges: [
            { name: 'Hon\'ble Mr. Justice Devendra Kumar Upadhyaya', designation: 'Chief Justice' },
            { name: 'Hon\'ble Mr. Justice Arif S. Doctor', designation: 'Puisne Judge' },
          ],
          hearings: [
            {
              hearing_date: `${year}-03-01`,
              business_purpose: 'Fresh Admission & Urgent Ad-Interim Relief',
              court_hall_number: 'Court Hall 1',
              judge_name: 'Chief Justice & Justice Arif Doctor',
              next_hearing_date: `${year}-04-15`,
              next_purpose: 'Filing of Affidavit in Reply by State',
            },
            {
              hearing_date: `${year}-04-15`,
              business_purpose: 'Interim Injunction Hearing & Rejoinder',
              court_hall_number: 'Court Hall 1',
              judge_name: 'Chief Justice & Justice Arif Doctor',
              next_hearing_date: `${year}-06-20`,
              next_purpose: 'Final Arguments & Submissions',
            },
            {
              hearing_date: `${year}-06-20`,
              business_purpose: 'Hearing Concluded - Reserved for Orders',
              court_hall_number: 'Court Hall 1',
              judge_name: 'Chief Justice & Justice Arif Doctor',
              next_hearing_date: `${year}-11-20`,
              next_purpose: 'Pronouncement of Order',
            },
          ],
          orders: [
            {
              order_number: '1',
              order_date: `${year}-03-01`,
              order_type: 'INTERIM',
              judge_name: 'Division Bench',
              document_url: `https://ecourts.gov.in/orders/${cnr}_01.pdf`,
              storage_path: `orders/${year}/${cnr}_01.pdf`,
              file_size_bytes: 245600,
            },
            {
              order_number: '2',
              order_date: `${year}-04-15`,
              order_type: 'INJUNCTION',
              judge_name: 'Division Bench',
              document_url: `https://ecourts.gov.in/orders/${cnr}_02.pdf`,
              storage_path: `orders/${year}/${cnr}_02.pdf`,
              file_size_bytes: 184200,
            },
          ],
          judgments: [],
        },
      };
    }

    // Default mock response
    return { success: true, data: { message: `Mock response for ${endpoint}`, endpoint, params, data } };
  }
}

export const ecourtsClient = new ECourtsIndiaClient();
