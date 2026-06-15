'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Download,
  Loader2,
  FileText,
  CheckCircle,
  AlertCircle,
  Copy,
  Eye,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuoteReportDevice {
  id: string;
  name: string;
  model?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice: number;
  category?: string;
  specs?: Record<string, string>;
  serviceYears?: number;
  regionCoefficient?: number;
}

export interface QuoteReportSLA {
  level: string;
  responseTime: string;
  resolutionTime: string;
  price?: number;
}

export interface QuoteReportData {
  quoteId: string;
  quoteNumber: string;
  version: string;
  title: string;
  clientName: string;
  clientCompany?: string;
  clientContact?: string;
  clientEmail?: string;
  clientPhone?: string;
  projectName?: string;
  projectAddress?: string;
  salesRep?: string;
  salesEmail?: string;
  preparedDate: string;
  validUntil?: string;
  devices: QuoteReportDevice[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  discountAmount?: number;
  grandTotal: number;
  currency?: string;
  sla?: QuoteReportSLA;
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  notes?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyLogoUrl?: string;
  signatureName?: string;
  signatureTitle?: string;
}

export interface ProfessionalReportProps {
  quoteData: QuoteReportData;
  onExport?: (format: 'docx' | 'pdf' | 'html') => Promise<Blob>;
  isExporting?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'CNY'): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── HTML Report Template ─────────────────────────────────────────────────────

function buildHtmlReport(data: QuoteReportData): string {
  const devicesRows = data.devices
    .map(
      (d, i) => `
      <tr>
        <td style="border:1px solid #ddd;padding:8px;text-align:center;">${i + 1}</td>
        <td style="border:1px solid #ddd;padding:8px;">${d.name}${d.model ? `<br><small>${d.model}</small>` : ''}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:center;">${d.category ?? '—'}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:center;">${d.quantity}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:right;">${d.unitPrice != null ? formatCurrency(d.unitPrice, data.currency) : '—'}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:right;">${formatCurrency(d.totalPrice, data.currency)}</td>
      </tr>`,
    )
    .join('');

  const hasTax = data.taxRate != null;
  const hasDiscount = data.discountAmount != null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${data.quoteNumber} - ${data.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', 'SimHei', sans-serif; font-size: 12px; color: #1a1a1a; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
  .company-info { font-size: 11px; color: #666; }
  .quote-meta { text-align: right; }
  .quote-number { font-size: 18px; font-weight: bold; color: #2563eb; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 14px; font-weight: bold; border-left: 4px solid #2563eb; padding-left: 8px; margin-bottom: 12px; color: #1a1a1a; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 40px; }
  .info-item { display: flex; gap: 8px; }
  .info-label { font-weight: bold; min-width: 90px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  th { background: #2563eb; color: white; padding: 10px 8px; text-align: left; }
  .totals-table { width: auto; margin-left: auto; }
  .totals-table td { padding: 6px 16px; }
  .totals-table .grand-total td { background: #2563eb; color: white; font-weight: bold; font-size: 14px; }
  .terms-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .term-box { border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px; }
  .term-box h4 { font-size: 12px; margin-bottom: 6px; color: #2563eb; }
  .sla-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px; padding: 12px; margin-bottom: 24px; }
  .notes { background: #fefce8; border: 1px solid #fef08a; border-radius: 4px; padding: 12px; white-space: pre-wrap; }
  .signature-area { display: flex; justify-content: flex-end; gap: 60px; margin-top: 60px; }
  .signature-box { text-align: center; width: 200px; }
  .signature-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 4px; }
  .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 12px; text-align: center; font-size: 10px; color: #888; }
  .page-break { page-break-after: always; }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="header">
  <div>
    ${data.companyLogoUrl ? `<img src="${data.companyLogoUrl}" height="50" style="margin-bottom:8px;">` : ''}
    <div class="company-info">
      <strong style="font-size:14px;color:#1a1a1a;">${data.companyName ?? 'ITS Solutions Ltd.'}</strong><br>
      ${data.companyAddress ?? ''}<br>
      ${data.companyPhone ? `Tel: ${data.companyPhone}<br>` : ''}
      ${data.companyEmail ? `Email: ${data.companyEmail}<br>` : ''}
      ${data.companyWebsite ? `Web: ${data.companyWebsite}` : ''}
    </div>
  </div>
  <div class="quote-meta">
    <div class="quote-number">${data.quoteNumber}</div>
    <div style="font-size:11px;color:#666;">Version ${data.version}</div>
    <div style="margin-top:8px;">
      <div>Date: ${formatDate(data.preparedDate)}</div>
      ${data.validUntil ? `<div>Valid Until: ${formatDate(data.validUntil)}</div>` : ''}
    </div>
  </div>
</div>

<h1 style="font-size:22px;text-align:center;margin-bottom:8px;color:#1a1a1a;">${data.title}</h1>
${data.projectName ? `<p style="text-align:center;color:#666;margin-bottom:30px;">Project: ${data.projectName}</p>` : ''}

<!-- CLIENT & SALES INFO -->
<div class="section">
  <div class="section-title">Client Information</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Client:</span><span>${data.clientName}</span></div>
    ${data.clientCompany ? `<div class="info-item"><span class="info-label">Company:</span><span>${data.clientCompany}</span></div>` : ''}
    ${data.clientContact ? `<div class="info-item"><span class="info-label">Contact:</span><span>${data.clientContact}</span></div>` : ''}
    ${data.clientEmail ? `<div class="info-item"><span class="info-label">Email:</span><span>${data.clientEmail}</span></div>` : ''}
    ${data.clientPhone ? `<div class="info-item"><span class="info-label">Phone:</span><span>${data.clientPhone}</span></div>` : ''}
    ${data.projectAddress ? `<div class="info-item"><span class="info-label">Address:</span><span>${data.projectAddress}</span></div>` : ''}
  </div>
</div>

${data.sla ? `
<div class="sla-box">
  <strong>Service Level Agreement (${data.sla.level})</strong><br>
  Response Time: ${data.sla.responseTime} &nbsp;|&nbsp; Resolution Time: ${data.sla.resolutionTime}
  ${data.sla.price != null ? ` &nbsp;|&nbsp; SLA Fee: ${formatCurrency(data.sla.price, data.currency)}` : ''}
</div>
` : ''}

<!-- DEVICE LIST -->
<div class="section">
  <div class="section-title">Device / Service List</div>
  <table>
    <thead>
      <tr>
        <th style="width:40px;text-align:center;">#</th>
        <th>Item Name</th>
        <th style="width:100px;text-align:center;">Category</th>
        <th style="width:60px;text-align:center;">Qty</th>
        <th style="width:100px;text-align:right;">Unit Price</th>
        <th style="width:120px;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${devicesRows}</tbody>
  </table>

  <!-- Totals -->
  <table class="totals-table">
    <tr><td style="text-align:right;padding:6px 16px;">Subtotal:</td><td style="text-align:right;font-weight:bold;">${formatCurrency(data.subtotal, data.currency)}</td></tr>
    ${hasDiscount ? `<tr><td style="text-align:right;padding:6px 16px;">Discount:</td><td style="text-align:right;color:#dc2626;">-${formatCurrency(data.discountAmount!, data.currency)}</td></tr>` : ''}
    ${hasTax ? `<tr><td style="text-align:right;padding:6px 16px;">Tax (${(data.taxRate! * 100).toFixed(0)}%):</td><td style="text-align:right;">${formatCurrency(data.taxAmount!, data.currency)}</td></tr>` : ''}
    <tr class="grand-total"><td style="padding:10px 16px;">Grand Total:</td><td style="padding:10px 16px;">${formatCurrency(data.grandTotal, data.currency)}</td></tr>
  </table>
</div>

<div class="page-break"></div>

<!-- TERMS -->
<div class="section">
  <div class="section-title">Terms & Conditions</div>
  <div class="terms-grid">
    <div class="term-box">
      <h4>Payment Terms</h4>
      <p>${data.paymentTerms ?? 'Payment terms as agreed in the master service agreement.'}</p>
    </div>
    <div class="term-box">
      <h4>Delivery Terms</h4>
      <p>${data.deliveryTerms ?? 'Delivery terms as agreed in the master service agreement.'}</p>
    </div>
    <div class="term-box">
      <h4>Warranty</h4>
      <p>${data.warrantyTerms ?? 'Standard manufacturer warranty applies.'}</p>
    </div>
  </div>
</div>

${data.notes ? `
<div class="section">
  <div class="section-title">Notes</div>
  <div class="notes">${data.notes}</div>
</div>
` : ''}

<!-- SIGNATURE AREA -->
<div class="signature-area">
  <div class="signature-box">
    <p style="font-size:11px;color:#666;">Prepared By</p>
    <div class="signature-line">
      <p style="font-weight:bold;">${data.signatureName ?? data.salesRep ?? '________________'}</p>
      <p style="font-size:10px;color:#666;">${data.signatureTitle ?? 'Sales Representative'}</p>
    </div>
  </div>
  <div class="signature-box">
    <p style="font-size:11px;color:#666;">Client Acknowledgement</p>
    <div class="signature-line">
      <p style="font-weight:bold;">________________________</p>
      <p style="font-size:10px;color:#666;">Name & Company Stamp</p>
    </div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer">
  <p>${data.companyName ?? 'ITS Solutions Ltd.'} &mdash; This document is confidential and intended only for the named recipient.</p>
  <p>Page 1 of 2 &nbsp;|&nbsp; ${data.quoteNumber} &nbsp;|&nbsp; Generated on ${formatDate(new Date().toISOString())}</p>
</div>

</body>
</html>`;
}

// ─── Export Preview Dialog ─────────────────────────────────────────────────────

interface ExportPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  htmlContent: string;
  quoteNumber: string;
}

function ExportPreviewDialog({
  open,
  onClose,
  htmlContent,
  quoteNumber,
}: ExportPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Quote Report Preview</DialogTitle>
          <DialogDescription>
            Review the report before exporting. {quoteNumber}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden rounded-lg border">
          <iframe
            srcDoc={htmlContent}
            title="Quote Report Preview"
            className="h-[60vh] w-full"
            sandbox="allow-same-origin"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProfessionalReport({
  quoteData,
  onExport,
  isExporting = false,
}: ProfessionalReportProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'docx' | 'pdf' | 'html' | null>(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const htmlContent = buildHtmlReport(quoteData);

  const handleExport = useCallback(
    async (format: 'docx' | 'pdf' | 'html') => {
      if (onExport) {
        const blob = await onExport(format);
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setDownloadReady(true);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${quoteData.quoteNumber}-${quoteData.title.replace(/\s+/g, '_')}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // Default: download as HTML
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${quoteData.quoteNumber}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    },
    [onExport, htmlContent, quoteData],
  );

  const handleCopyLink = async () => {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    await navigator.clipboard.writeText(
      `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`,
    );
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Professional Report</h3>
            <p className="text-sm text-muted-foreground">
              Export {quoteData.quoteNumber} as a formatted document
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* HTML Export */}
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            onClick={() => handleExport('html')}
            disabled={isExporting}
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs font-medium">Export as HTML</span>
            <span className="text-xs text-muted-foreground">Open in browser / print to PDF</span>
          </Button>

          {/* DOCX Export */}
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            onClick={() => handleExport('docx')}
            disabled={isExporting}
          >
            <Download className="h-5 w-5" />
            <span className="text-xs font-medium">Export as DOCX</span>
            <span className="text-xs text-muted-foreground">Microsoft Word format</span>
          </Button>

          {/* Preview */}
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-5 w-5" />
            <span className="text-xs font-medium">Preview</span>
            <span className="text-xs text-muted-foreground">View report in browser</span>
          </Button>
        </div>

        {/* Report summary */}
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="text-sm font-medium">Report Summary</div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Quote Number:</span>
              <span className="font-medium text-foreground">{quoteData.quoteNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Version:</span>
              <span className="font-medium text-foreground">v{quoteData.version}</span>
            </div>
            <div className="flex justify-between">
              <span>Client:</span>
              <span className="font-medium text-foreground">{quoteData.clientName}</span>
            </div>
            <div className="flex justify-between">
              <span>Items:</span>
              <span className="font-medium text-foreground">{quoteData.devices.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Grand Total:</span>
              <span className="font-medium text-foreground">
                {formatCurrency(quoteData.grandTotal, quoteData.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span className="font-medium text-foreground">{formatDate(quoteData.preparedDate)}</span>
            </div>
          </div>
        </div>

        {isExporting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating {exportFormat?.toUpperCase()} document...
          </div>
        )}

        {downloadReady && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Download ready!
          </div>
        )}
      </div>

      <ExportPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        htmlContent={htmlContent}
        quoteNumber={quoteData.quoteNumber}
      />
    </>
  );
}

export default ProfessionalReport;
