import { ecourtsClient } from './ecourtsIndiaClient.js';
import { db } from '../../database/datastore.js';
import { logger } from '../../utils/logger.js';

export class CapabilitiesService {
  /**
   * Introspect upstream eCourts developer capabilities
   */
  static async getCapabilities() {
    const res = await ecourtsClient.request({
      endpoint: '/capabilities',
      method: 'GET',
    });
    return res.data;
  }
}

export class EnumService {
  /**
   * Synchronize dynamic reference enums from upstream API and persist into database
   */
  static async syncEnums() {
    logger.info('[EnumService] Synchronizing dynamic API reference enums...');
    const res = await ecourtsClient.request({
      endpoint: '/meta/enums',
      method: 'GET',
    });

    const categories = res?.data?.categories || {};
    let totalEnumsSynced = 0;

    for (const [category, items] of Object.entries(categories)) {
      for (const item of items) {
        await db.upsertApiEnum({
          category,
          code: item.code,
          label: item.label,
          metadata: item.metadata || {},
        });
        totalEnumsSynced++;
      }
    }

    logger.info(`[EnumService] Synchronized ${totalEnumsSynced} dynamic reference enums.`);
    return { enumsSynced: totalEnumsSynced };
  }

  /**
   * Retrieve dynamic enums grouped by category for frontend consumers
   */
  static async getGroupedEnums() {
    const all = await db.getApiEnums();
    const grouped = {};
    for (const item of all) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push({
        code: item.code,
        label: item.label,
        metadata: item.metadata,
      });
    }
    return grouped;
  }
}
