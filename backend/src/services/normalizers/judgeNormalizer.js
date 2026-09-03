/**
 * Normalizes judges, coram benches, and designations.
 */
export class JudgeNormalizer {
  static normalize(rawJudges, courtId = null) {
    const list = [];
    const seen = new Set();

    const addJudge = (item, role = 'PRESIDING_JUDGE') => {
      if (!item) return;

      let name = '';
      let designation = 'Judge';

      if (typeof item === 'string') {
        name = item.trim();
      } else {
        name = (item.name || item.judgeName || item.judge || '').trim();
        designation = item.designation || 'Hon\'ble Justice';
      }

      if (!name) return;

      // Clean prefix noise
      name = name.replace(/^(Hon'ble\s+(Mr\.|Ms\.|Mrs\.)?\s*Justice\s+|Justice\s+|Shri\s+|Mr\.\s+|Dr\.\s+)/i, '').trim();

      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      list.push({
        name,
        designation: designation || 'Hon\'ble Justice',
        courtId,
        role,
      });
    };

    if (Array.isArray(rawJudges)) {
      rawJudges.forEach((j, idx) => addJudge(j, idx === 0 ? 'PRESIDING_JUDGE' : 'MEMBER_JUDGE'));
    } else if (typeof rawJudges === 'string') {
      // Split bench strings e.g. "Hon'ble Mr. Justice A.K. Sikri and Hon'ble Ms. Justice Indira Banerjee"
      const parts = rawJudges.split(/,\s*|\s+and\s+|\s+&\s+/i);
      parts.forEach((p, idx) => addJudge(p, idx === 0 ? 'PRESIDING_JUDGE' : 'CORAM'));
    } else if (rawJudges && typeof rawJudges === 'object') {
      if (rawJudges.presidingJudge) addJudge(rawJudges.presidingJudge, 'PRESIDING_JUDGE');
      if (rawJudges.coram && Array.isArray(rawJudges.coram)) {
        rawJudges.coram.forEach((c) => addJudge(c, 'CORAM'));
      }
    }

    return list;
  }
}
