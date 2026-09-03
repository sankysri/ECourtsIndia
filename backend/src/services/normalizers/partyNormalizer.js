/**
 * Normalizes case parties (Petitioners, Respondents, Accused, Complainants) with deduplication.
 */
export class PartyNormalizer {
  static normalize(rawParties = {}) {
    const parties = [];
    const seen = new Set();

    const addParty = (item, type, defaultIndex) => {
      if (!item) return;

      let name = '';
      let gender = null;
      let age = null;
      let address = null;
      let extra = {};

      if (typeof item === 'string') {
        name = item.trim();
      } else {
        name = (item.name || item.partyName || item.title || '').trim();
        gender = item.gender || null;
        age = item.age ? parseInt(item.age, 10) : null;
        address = item.address || null;
        extra = item.extraDetails || item.extra || {};
      }

      if (!name) return;

      // Clean prefix noise (1) Petitioner:, 1., etc.
      name = name.replace(/^(\d+[\.\)\s-]+)/, '').trim();

      const key = `${type}:${name.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);

      parties.push({
        partyType: type,
        partyNumber: defaultIndex,
        name,
        gender,
        age,
        address,
        extraDetails: extra,
      });
    };

    // 1. Process Petitioners / Appellants / Complainants
    const petitioners = rawParties.petitioners || rawParties.petitioner || rawParties.appellants || rawParties.complainants || [];
    const petitionerList = Array.isArray(petitioners) ? petitioners : [petitioners];
    petitionerList.forEach((p, idx) => addParty(p, 'PETITIONER', idx + 1));

    // 2. Process Respondents / Opponents / Accused
    const respondents = rawParties.respondents || rawParties.respondent || rawParties.defendants || rawParties.accused || [];
    const respondentList = Array.isArray(respondents) ? respondents : [respondents];
    respondentList.forEach((r, idx) => addParty(r, 'RESPONDENT', idx + 1));

    return parties;
  }
}
