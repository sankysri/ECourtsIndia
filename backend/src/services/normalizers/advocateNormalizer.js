/**
 * Normalizes advocate records, removes prefixes (Adv., Shri, Mr., Ms.), and links representation.
 */
export class AdvocateNormalizer {
  static normalize(rawAdvocates = {}) {
    const list = [];
    const seen = new Set();

    const processAdvocate = (item, partyType, isLead = false) => {
      if (!item) return;

      let name = '';
      let barReg = null;
      let phone = null;
      let email = null;

      if (typeof item === 'string') {
        name = item.trim();
      } else {
        name = (item.name || item.advocateName || '').trim();
        barReg = item.barRegistrationNumber || item.bar_reg_no || item.barReg || null;
        phone = item.phone || null;
        email = item.email || null;
      }

      if (!name) return;

      // Clean honorific prefixes
      name = name.replace(/^(Adv(\.|\s)+|Shri\s+|Mr(\.|\s)+|Ms(\.|\s)+|Mrs(\.|\s)+|Senior Adv(\.|\s)+)/i, '').trim();

      const key = `${partyType}:${name.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);

      list.push({
        name,
        barRegistrationNumber: barReg,
        phone,
        email,
        partyType,
        isLead,
      });
    };

    // Petitioners' Advocates
    const petAdv = rawAdvocates.petitionerAdvocates || rawAdvocates.petitioners || rawAdvocates.petitioner_advocate || [];
    const petList = Array.isArray(petAdv) ? petAdv : [petAdv];
    petList.forEach((a, idx) => processAdvocate(a, 'PETITIONER', idx === 0));

    // Respondents' Advocates
    const resAdv = rawAdvocates.respondentAdvocates || rawAdvocates.respondents || rawAdvocates.respondent_advocate || [];
    const resList = Array.isArray(resAdv) ? resAdv : [resAdv];
    resList.forEach((a, idx) => processAdvocate(a, 'RESPONDENT', idx === 0));

    return list;
  }
}
