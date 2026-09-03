/**
 * Normalizes case hearings timeline and deduplicates by hearing date and purpose.
 */
export class HearingNormalizer {
  static normalize(rawHearings = []) {
    const list = [];
    const seen = new Set();

    const normalizeDate = (val) => {
      if (!val) return null;
      try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
      } catch {
        return null;
      }
    };

    const hearingsArray = Array.isArray(rawHearings) ? rawHearings : [rawHearings];

    for (const h of hearingsArray) {
      if (!h) continue;

      const hearingDate = normalizeDate(h.hearing_date || h.hearingDate || h.date);
      if (!hearingDate) continue;

      const businessPurpose = (h.business_purpose || h.businessPurpose || h.purpose || 'Arguments').trim();
      const courtHallNumber = h.court_hall_number || h.courtHallNumber || h.courtHall || 'Court Hall 1';
      const judgeName = (h.judge_name || h.judgeName || h.judge || '').trim();
      const nextHearingDate = normalizeDate(h.next_hearing_date || h.nextHearingDate);
      const nextPurpose = (h.next_purpose || h.nextPurpose || '').trim();

      const key = `${hearingDate}:${businessPurpose.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      list.push({
        hearingDate,
        businessPurpose,
        courtHallNumber,
        judgeName: judgeName || 'Hon\'ble Bench',
        nextHearingDate,
        nextPurpose: nextPurpose || null,
      });
    }

    // Sort chronologically ascending
    return list.sort((a, b) => new Date(a.hearingDate) - new Date(b.hearingDate));
  }
}
