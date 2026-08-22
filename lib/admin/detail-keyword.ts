// lib/admin/detail-keyword.ts — 從管理員訊息抽出查詢關鍵字（編號或姓名）

/** 抽出預約編號或客人姓名；泛化列表句（無特定對象）回 null */
export function extractDetailKeyword(text: string): string | null {
  const t = text.trim();

  const byId = t.match(/(?:預約|編號|#)\s*#?\s*(\d+)/) ?? t.match(/#?\s*(\d+)\s*號?/);
  if (byId) return byId[1];

  if (/(列表|清單|列出|全部|所有|幾筆|總量|統計|排名|生意)/.test(t) && !/(電話|聯絡)/.test(t)) {
    return null;
  }

  const nameBeforePhone = t.match(/([\u4e00-\u9fff]{2,4})(?:小姐|先生)?(?:的)?(?:電話|手機|聯絡)/);
  if (nameBeforePhone) return nameBeforePhone[1];

  const nameOnly = t.match(/(?:查|找|搜)(?:一下)?([\u4e00-\u9fff]{2,4})(?:小姐|先生)?(?:的)?(?:預約|資料|資訊)?/);
  if (nameOnly) return nameOnly[1];

  const bareName = t.match(/^([\u4e00-\u9fff]{2,4})(?:小姐|先生)?$/);
  if (bareName) return bareName[1];

  return null;
}
