/**
 * Normalizes case orders and judgments.
 */
export class OrderNormalizer {
  static normalizeOrders(rawOrders = []) {
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

    const ordersArray = Array.isArray(rawOrders) ? rawOrders : [rawOrders];

    for (let i = 0; i < ordersArray.length; i++) {
      const o = ordersArray[i];
      if (!o) continue;

      const orderDate = normalizeDate(o.order_date || o.orderDate || o.date);
      if (!orderDate) continue;

      const orderNumber = String(o.order_number || o.orderNumber || i + 1).trim();
      const orderType = (o.order_type || o.orderType || o.type || 'INTERIM').toUpperCase().trim();
      const judgeName = (o.judge_name || o.judgeName || o.judge || '').trim();
      const docUrl = o.document_url || o.documentUrl || o.pdfUrl || `https://ecourts.gov.in/orders/${orderNumber}.pdf`;
      const storagePath = o.storage_path || o.storagePath || `orders/${orderDate}_${orderNumber}.pdf`;
      const fileSizeBytes = o.file_size_bytes || o.fileSizeBytes || 145200;

      const key = `${orderDate}:${orderNumber}`;
      if (seen.has(key)) continue;
      seen.add(key);

      list.push({
        orderNumber,
        orderDate,
        orderType,
        judgeName: judgeName || 'Hon\'ble Bench',
        documentUrl: docUrl,
        storagePath,
        fileSizeBytes,
      });
    }

    return list.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
  }

  static normalizeJudgments(rawJudgments = []) {
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

    const judgmentsArray = Array.isArray(rawJudgments) ? rawJudgments : [rawJudgments];

    for (const j of judgmentsArray) {
      if (!j) continue;

      const judgmentDate = normalizeDate(j.judgment_date || j.judgmentDate || j.date);
      if (!judgmentDate) continue;

      const judgmentType = (j.judgment_type || j.judgmentType || 'ALLOWED').toUpperCase().trim();
      const authorJudge = (j.author_judge || j.authorJudge || j.judge || '').trim();
      const docUrl = j.document_url || j.documentUrl || `https://ecourts.gov.in/judgments/final.pdf`;
      const storagePath = j.storage_path || j.storagePath || `judgments/${judgmentDate}_final.pdf`;
      const fileSizeBytes = j.file_size_bytes || j.fileSizeBytes || 320400;

      const key = `${judgmentDate}:${judgmentType}`;
      if (seen.has(key)) continue;
      seen.add(key);

      list.push({
        judgmentDate,
        judgmentType,
        authorJudge: authorJudge || 'Hon\'ble Bench',
        documentUrl: docUrl,
        storagePath,
        fileSizeBytes,
      });
    }

    return list.sort((a, b) => new Date(b.judgmentDate) - new Date(a.judgmentDate));
  }
}
