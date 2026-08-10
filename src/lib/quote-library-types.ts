/**
 * 报价资料库共享类型定义。
 *
 * 报价单 quote_data 的数据结构对应 `康海物流固话线路整改报价V2.xlsx` 的「汇总」Sheet：
 *   - 第 1 行：表头标题（如"康海物流固话线路整改报价"）
 *   - 第 2 行：列标题（项目名称、规格/型号/参数、单位、数量、单价、含税单价 6%、
 *                铁建含税单价（管理费 6%）、移动含税单价（管理费 8%）、
 *                总价含税、铁建总价、移动总价、备注）
 *   - 第 3..N 行：明细行
 *   - 最后一行：「合计」
 *   - 末尾：「说明：」
 */

export const QUOTE_LIBRARY_TEMPLATE_VERSION = 'engineering-quote-v1';

export interface QuoteItem {
  /** 项目名称（必填） */
  name: string;
  /** 规格/型号/参数 */
  spec?: string;
  /** 单位 */
  unit?: string;
  /** 数量 */
  quantity: number;
  /** 单价（不含税） */
  unit_price: number;
  /** 含税单价（6%） */
  taxable_unit_price?: number;
  /** 铁建含税单价（管理费 6%） */
  tiejiang_taxable_unit_price?: number;
  /** 移动含税单价（管理费 8%） */
  yidong_taxable_unit_price?: number;
  /** 含税合计（taxable_unit_price × quantity） */
  total_taxable?: number;
  /** 铁建总价（tiejiang_taxable_unit_price × quantity） */
  tiejiang_total?: number;
  /** 移动总价（yidong_taxable_unit_price × quantity） */
  yidong_total?: number;
  /** 备注 */
  remark?: string;
}

export interface QuoteSummary {
  /** 表头标题 */
  title: string;
  /** 报价明细 */
  items: QuoteItem[];
  /** 合计行（与明细独立，因为源表合计行为单独一行） */
  totals: {
    taxable_total: number;
    tiejiang_taxable_total: number;
    yidong_taxable_total: number;
  };
  /** 备注 / 说明 */
  note?: string;
}

export interface QuoteFloorPoint {
  /** 楼层名称（如 "2楼"） */
  name: string;
  /** 各列计数 */
  counts: number[];
  /** AP 信息（可选，如 "AP1 / 34 / AP2 / 43"） */
  ap?: string;
}

export interface QuoteData {
  template: typeof QUOTE_LIBRARY_TEMPLATE_VERSION;
  summary: QuoteSummary;
  /** 点位表（对应 Sheet2），可选 */
  points?: {
    floors: QuoteFloorPoint[];
  };
}

/** 附件类别 */
export type QuoteLibraryAttachmentCategory = 'survey_photo' | 'other';

export interface QuoteLibraryAttachment {
  id: string;
  category: QuoteLibraryAttachmentCategory;
  original_name: string;
  stored_path: string;
  /** 可访问的相对 URL，例如 /uploads/quote-library/... */
  url: string;
  mime_type?: string | null;
  file_size?: number | null;
  uploaded_by?: number | string | null;
  created_at: string;
}

export interface QuoteLibraryRecord {
  id: string;
  user_id?: number | string | bigint | null;
  uploader_name?: string | null;
  title: string;
  client_name?: string | null;
  project_name?: string | null;
  project_description: string;
  quote_data: QuoteData;
  total_amount: number;
  currency: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  attachments?: QuoteLibraryAttachment[];
}

export interface QuoteLibraryListResponse {
  records: QuoteLibraryRecord[];
  total: number;
  page: number;
  page_size: number;
}

/** 附件白名单 */
export const SURVEY_PHOTO_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export const OTHER_FILE_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
  // CAD 常见 MIME（部分浏览器识别为 octet-stream，通过扩展名兜底）
  'application/octet-stream',
];

export const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024; // 单文件 20MB
export const MAX_QUOTE_DATA_BYTES = 1 * 1024 * 1024; // 报价 JSON 1MB
export const MAX_ATTACHMENTS_PER_RECORD = 30;