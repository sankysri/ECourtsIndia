import { ecourtsClient } from './ecourtsIndiaClient.js';
import { db } from '../../database/datastore.js';
import { logger } from '../../utils/logger.js';

export class CourtService {
  /**
   * Fetch raw court hierarchy from upstream eCourts developer API
   */
  static async fetchUpstreamCourtHierarchy() {
    return ecourtsClient.request({
      endpoint: '/courts/hierarchy',
      method: 'GET',
    });
  }

  /**
   * Synchronize full national court master into PostgreSQL using idempotent upsert logic.
   */
  static async syncCourtHierarchy() {
    logger.info('[CourtService] Starting court hierarchy synchronization...');
    const response = await this.fetchUpstreamCourtHierarchy();
    const states = response?.data?.states || [];

    let totalStatesSynced = 0;
    let totalDistrictsSynced = 0;
    let totalCourtsSynced = 0;

    // Temporary map for parent court resolution (parentCourtCode -> courtId)
    const codeToIdMap = new Map();

    // Step 1: Upsert States and High Courts
    for (const stateData of states) {
      const state = await db.upsertState({
        code: stateData.code,
        name: stateData.name,
      });
      totalStatesSynced++;

      // Upsert High Courts
      if (stateData.highCourts) {
        for (const hc of stateData.highCourts) {
          const court = await db.upsertCourt({
            stateId: state.id,
            districtId: null,
            code: hc.code,
            name: hc.name,
            type: hc.type || 'HIGH_COURT',
            parentCourtId: null, // resolved in step 3
            status: hc.status || 'ACTIVE',
            metadata: hc.metadata || {},
          });
          codeToIdMap.set(hc.code, court.id);
          totalCourtsSynced++;
        }
      }

      // Step 2: Upsert Districts & Subordinate Courts
      if (stateData.districts) {
        for (const distData of stateData.districts) {
          const district = await db.upsertDistrict({
            stateId: state.id,
            code: distData.code,
            name: distData.name,
          });
          totalDistrictsSynced++;

          if (distData.courts) {
            for (const c of distData.courts) {
              const court = await db.upsertCourt({
                stateId: state.id,
                districtId: district.id,
                code: c.code,
                name: c.name,
                type: c.type || 'DISTRICT_COURT',
                parentCourtId: null,
                status: c.status || 'ACTIVE',
                metadata: c.metadata || {},
              });
              codeToIdMap.set(c.code, court.id);
              totalCourtsSynced++;
            }
          }
        }
      }
    }

    // Step 3: Second pass to resolve parent court links (e.g. Nagpur Bench parent -> Bombay HC)
    for (const stateData of states) {
      if (stateData.highCourts) {
        for (const hc of stateData.highCourts) {
          if (hc.parentCourtCode && codeToIdMap.has(hc.parentCourtCode)) {
            const parentId = codeToIdMap.get(hc.parentCourtCode);
            const state = await db.findStateByCode(stateData.code);
            await db.upsertCourt({
              stateId: state.id,
              districtId: null,
              code: hc.code,
              name: hc.name,
              type: hc.type || 'HIGH_COURT',
              parentCourtId: parentId,
              status: hc.status || 'ACTIVE',
              metadata: hc.metadata || {},
            });
          }
        }
      }
    }

    logger.info(`[CourtService] Successfully synchronized: ${totalStatesSynced} states, ${totalDistrictsSynced} districts, ${totalCourtsSynced} courts.`);
    return {
      statesSynced: totalStatesSynced,
      districtsSynced: totalDistrictsSynced,
      courtsSynced: totalCourtsSynced,
    };
  }
}
