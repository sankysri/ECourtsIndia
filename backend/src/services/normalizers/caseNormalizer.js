import { z } from 'zod';

/**
 * Normalizes root case metadata, dates, filing numbers, acts, and police station information.
 */
export class CaseNormalizer {
  static normalize(rawCase, courtId) {
    if (!rawCase || !rawCase.cnr) {
      throw new Error('Case normalizer requires valid raw case with CNR');
    }

    const cnr = String(rawCase.cnr).toUpperCase().trim();
    const caseNumber = (rawCase.case_number || rawCase.caseNumber || '').trim();
    const caseType = (rawCase.case_type || rawCase.caseType || 'WP').trim();
    const filingNumber = (rawCase.filing_number || rawCase.filingNumber || '').trim();
    const registrationNumber = (rawCase.registration_number || rawCase.registrationNumber || caseNumber).trim();

    const normalizeDate = (val) => {
      if (!val) return null;
      try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
      } catch {
        return null;
      }
    };

    const filingDate = normalizeDate(rawCase.filing_date || rawCase.filingDate);
    const registrationDate = normalizeDate(rawCase.registration_date || rawCase.registrationDate || filingDate);
    const firstHearingDate = normalizeDate(rawCase.first_hearing_date || rawCase.firstHearingDate);
    const nextHearingDate = normalizeDate(rawCase.next_hearing_date || rawCase.nextHearingDate);
    const decisionDate = normalizeDate(rawCase.decision_date || rawCase.decisionDate);

    // Normalize Status
    let caseStatus = (rawCase.status || rawCase.case_status || 'PENDING').toUpperCase().trim();
    if (!['PENDING', 'DISPOSED', 'QUASHED', 'TRANSFERRED', 'DECREED'].includes(caseStatus)) {
      caseStatus = decisionDate ? 'DISPOSED' : 'PENDING';
    }

    const natureOfDisposal = rawCase.nature_of_disposal || rawCase.natureOfDisposal || (caseStatus === 'DISPOSED' ? 'Disposed on Merits' : null);
    const subCategory = rawCase.sub_category || rawCase.subCategory || null;
    const underActs = rawCase.under_acts || rawCase.underActs || rawCase.acts || 'Constitution of India, Art. 226';
    const underSections = rawCase.under_sections || rawCase.underSections || rawCase.sections || 'Section 151 CPC';

    const policeStation = rawCase.police_station || rawCase.policeStation || null;
    const firNumber = rawCase.fir_number || rawCase.firNumber || null;
    const firYear = rawCase.fir_year ? parseInt(rawCase.fir_year, 10) : null;

    const title = rawCase.title || (rawCase.parties ? `${rawCase.parties.petitioners?.[0]?.name || 'Petitioner'} vs. ${rawCase.parties.respondents?.[0]?.name || 'Respondent'}` : `${caseType} in Court`);

    return {
      cnr,
      courtId,
      caseNumber,
      caseType,
      filingNumber,
      filingDate,
      registrationNumber,
      registrationDate,
      firstHearingDate,
      nextHearingDate,
      decisionDate,
      caseStatus,
      natureOfDisposal,
      subCategory,
      underActs,
      underSections,
      policeStation,
      firNumber,
      firYear,
      title,
      metadata: rawCase.metadata || {},
    };
  }
}
