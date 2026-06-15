'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Link2, Loader2, Eye, Ban, Check, Calendar, Trash2, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShareLink {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
  isActive: boolean;
}

export interface QuoteShareDialogProps {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  quoteNumber: string;
  onGenerateLink?: (expiry: string) => Promise<ShareLink>;
  onRevokeLink?: (linkId: string) => Promise<void>;
  existingLinks?: ShareLink[];
  isLoading?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getDaysUntilExpiry(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getExpiryColor(daysLeft: number): string {
  if (daysLeft <= 0) return 'bg-red-100 text-red-700';
  if (daysLeft <= 7) return 'bg-orange-100 text-orange-700';
  if (daysLeft <= 30) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
}

function buildShareUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/share/quote/${token}`;
}

// ─── Custom Expiry Dialog ─────────────────────────────────────────────────────

interface CustomExpiryDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (date: string) => void;
}

function CustomExpiryDialog({ open, onClose, onConfirm }: CustomExpiryDialogProps) {
  const [date, setDate] = useState('');

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  const handleConfirm = () => {
    if (date) onConfirm(date);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Custom Expiry Date</DialogTitle>
          <DialogDescription>
            Set a specific date when this link will expire.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="custom-expiry">Expiry Date</Label>
          <Input
            id="custom-expiry"
            type="date"
            min={minDateStr}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!date}>Generate Link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QuoteShareDialog({
  open,
  onClose,
  quoteId,
  quoteNumber,
  onGenerateLink,
  onRevokeLink,
  existingLinks = [],
  isLoading = false,
}: QuoteShareDialogProps) {
  const [selectedExpiry, setSelectedExpiry] = useState<string>('30');
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<ShareLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [localLinks, setLocalLinks] = useState<ShareLink[]>(existingLinks);

  const allLinks = existingLinks.length > 0 ? existingLinks : localLinks;

  const handleGenerate = async (expiry: string) => {
    setGenerating(true);
    try {
      if (onGenerateLink) {
        const link = await onGenerateLink(expiry);
        setGeneratedLink(link);
        setLocalLinks((prev) => [link, ...prev]);
      } else {
        // Mock link for demo
        const mockLink: ShareLink = {
          id: `link-${Date.now()}`,
          token: Math.random().toString(36).substring(2),
          createdAt: new Date().toISOString(),
          expiresAt: expiry.includes('T')
            ? expiry
            : new Date(Date.now() + parseInt(expiry) * 24 * 60 * 60 * 1000).toISOString(),
          viewCount: 0,
          isActive: true,
        };
        setGeneratedLink(mockLink);
        setLocalLinks((prev) => [mockLink, ...prev]);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = async (link: ShareLink) => {
    const url = buildShareUrl(link.token);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (linkId: string) => {
    setRevokingId(linkId);
    try {
      if (onRevokeLink) {
        await onRevokeLink(linkId);
      }
      setLocalLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, isActive: false } : l)));
    } finally {
      setRevokingId(null);
    }
  };

  const handleCustomExpiry = (date: string) => {
    setCustomDateOpen(false);
    handleGenerate(date);
  };

  const activeLinks = allLinks.filter((l) => l.isActive);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Share Quote
            </DialogTitle>
            <DialogDescription>
              Generate secure, time-limited links to share quote {quoteNumber} with clients.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Expiry selector */}
            <div className="space-y-2">
              <Label>Link Expiry</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: '7', label: '7 days' },
                  { value: '30', label: '30 days' },
                  { value: '90', label: '90 days' },
                  { value: 'custom', label: 'Custom' },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    variant={selectedExpiry === opt.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setSelectedExpiry(opt.value);
                      if (opt.value === 'custom') setCustomDateOpen(true);
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              {selectedExpiry !== 'custom' && selectedExpiry !== '' && (
                <Button
                  size="sm"
                  className="mt-1"
                  onClick={() => handleGenerate(selectedExpiry)}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="mr-2 h-4 w-4" />
                  )}
                  Generate Link
                </Button>
              )}
            </div>

            {/* Generated link */}
            {generatedLink && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Link Generated</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => handleCopyLink(generatedLink)}
                  >
                    {copied ? (
                      <Check className="mr-1 h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="mr-1 h-3 w-3" />
                    )}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <Input
                  readOnly
                  value={buildShareUrl(generatedLink.token)}
                  className="h-8 text-xs font-mono"
                />
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Expires: {formatDate(generatedLink.expiresAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {generatedLink.viewCount} view{generatedLink.viewCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Existing links */}
            {activeLinks.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">
                  Active Links
                </Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {activeLinks.map((link) => {
                    const daysLeft = getDaysUntilExpiry(link.expiresAt);
                    return (
                      <div key={link.id} className="flex items-center gap-2 rounded-lg border p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                              {buildShareUrl(link.token)}
                            </span>
                            <Badge className={`text-xs ${getExpiryColor(daysLeft)}`}>
                              {daysLeft <= 0
                                ? 'Expired'
                                : `${daysLeft}d left`}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(link.expiresAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {link.viewCount} view{link.viewCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleCopyLink(link)}
                            title="Copy link"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleRevoke(link.id)}
                            disabled={revokingId === link.id}
                            title="Revoke link"
                          >
                            {revokingId === link.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Ban className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeLinks.length === 0 && !generatedLink && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Link2 className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No active share links for this quote.
                </p>
                <p className="text-xs text-muted-foreground">
                  Generate a link above to share with your client.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomExpiryDialog
        open={customDateOpen}
        onClose={() => setCustomDateOpen(false)}
        onConfirm={handleCustomExpiry}
      />
    </>
  );
}

export default QuoteShareDialog;
