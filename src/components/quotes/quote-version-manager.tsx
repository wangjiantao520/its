'use client';

import React, { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock,
  RotateCcw,
  GitCompare,
  FileText,
  ChevronRight,
  User,
  Calendar,
  Loader2,
  AlertTriangle,
  Check,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuoteVersion {
  id: string;
  version: string; // e.g. "1.0", "1.1", "2.0"
  createdAt: string; // ISO date string
  createdBy: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'archived';
  changesSummary?: string;
  totalAmount?: number;
  deviceCount?: number;
  isLocked?: boolean;
}

export interface VersionComparison {
  leftVersion: QuoteVersion;
  rightVersion: QuoteVersion;
  differences?: VersionDiff[];
}

export interface VersionDiff {
  field: string;
  oldValue: string | number;
  newValue: string | number;
}

export interface QuoteVersionManagerProps {
  quoteId: string;
  quoteType?: 'hardware' | 'service' | 'mixed';
  currentVersion: QuoteVersion;
  versions: QuoteVersion[];
  onRestore?: (version: QuoteVersion) => Promise<void>;
  onCompare?: (comparison: VersionComparison) => void;
  isLoading?: boolean;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(amount);
}

const STATUS_COLORS: Record<QuoteVersion['status'], string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  archived: 'bg-yellow-100 text-yellow-700',
};

// ─── Version Compare Dialog ────────────────────────────────────────────────────

interface CompareDialogProps {
  open: boolean;
  leftVersion: QuoteVersion | null;
  rightVersion: QuoteVersion | null;
  onClose: () => void;
  onConfirm?: () => void;
}

function CompareDialog({
  open,
  leftVersion,
  rightVersion,
  onClose,
}: CompareDialogProps) {
  if (!leftVersion || !rightVersion) return null;

  const fields: { key: keyof QuoteVersion; label: string }[] = [
    { key: 'version', label: 'Version' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Created At' },
    { key: 'createdBy', label: 'Created By' },
    { key: 'totalAmount', label: 'Total Amount' },
    { key: 'deviceCount', label: 'Device Count' },
    { key: 'changesSummary', label: 'Changes Summary' },
  ];

  const getDiff = (key: keyof QuoteVersion) => {
    const oldVal = leftVersion[key];
    const newVal = rightVersion[key];
    if (oldVal === newVal) return 'unchanged';
    if (key === 'createdAt') return 'changed';
    return 'changed';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Version Comparison
          </DialogTitle>
          <DialogDescription>
            Comparing <strong>{leftVersion.version}</strong> vs{' '}
            <strong>{rightVersion.version}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Left version */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline">{leftVersion.version}</Badge>
              <Badge className={STATUS_COLORS[leftVersion.status]}>
                {leftVersion.status}
              </Badge>
            </div>
            {fields.map(({ key, label }) => {
              const diff = getDiff(key);
              const val = leftVersion[key];
              return (
                <div key={key} className="text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <p className={diff === 'changed' ? 'text-red-600 line-through' : 'font-medium'}>
                    {key === 'createdAt' && val ? formatDate(val as string) : String(val ?? '—')}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right version */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline">{rightVersion.version}</Badge>
              <Badge className={STATUS_COLORS[rightVersion.status]}>
                {rightVersion.status}
              </Badge>
            </div>
            {fields.map(({ key, label }) => {
              const diff = getDiff(key);
              const val = rightVersion[key];
              return (
                <div key={key} className="text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <p className={diff === 'changed' ? 'text-green-700 font-medium' : 'font-medium'}>
                    {key === 'createdAt' && val ? formatDate(val as string) : String(val ?? '—')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Diff summary */}
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm font-medium">Changes Summary</p>
          <p className="text-sm text-muted-foreground">
            {rightVersion.changesSummary ?? 'No description provided.'}
          </p>
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

// ─── Restore Dialog ────────────────────────────────────────────────────────────

interface RestoreDialogProps {
  open: boolean;
  version: QuoteVersion | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function RestoreDialog({ open, version, onClose, onConfirm }: RestoreDialogProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [note, setNote] = useState('');

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsRestoring(false);
    }
  };

  if (!version) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Restore Version {version.version}
          </DialogTitle>
          <DialogDescription>
            This will create a new version based on version {version.version}. The current
            version will be archived.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="rounded-lg border p-3 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <Badge className={STATUS_COLORS[version.status]}>{version.status}</Badge>
              <span className="text-muted-foreground">by {version.createdBy}</span>
            </div>
            <p className="text-muted-foreground">{formatDate(version.createdAt)}</p>
            {version.totalAmount !== undefined && (
              <p className="font-medium">{formatCurrency(version.totalAmount)}</p>
            )}
          </div>
          <div>
            <Label htmlFor="restore-note">Note (optional)</Label>
            <Textarea
              id="restore-note"
              placeholder="Reason for restoring this version..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleRestore} disabled={isRestoring}>
            {isRestoring ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Restore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function QuoteVersionManager({
  quoteId,
  currentVersion,
  versions,
  onRestore,
  onCompare,
  isLoading = false,
}: QuoteVersionManagerProps) {
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [restoreTarget, setRestoreTarget] = useState<QuoteVersion | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[QuoteVersion, QuoteVersion] | null>(null);

  const toggleSelectForCompare = useCallback((id: string) => {
    setSelectedForCompare((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 2) {
        next.add(id);
      } else {
        // Replace the oldest selection
        const arr = Array.from(next);
        next.delete(arr[0]);
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCompare = () => {
    if (selectedForCompare.size === 2) {
      const selected = Array.from(selectedForCompare);
      const v1 = versions.find((v) => v.id === selected[0])!;
      const v2 = versions.find((v) => v.id === selected[1])!;
      setCompareVersions([v1, v2]);
      setCompareOpen(true);
    }
  };

  const handleRestore = async () => {
    if (restoreTarget && onRestore) {
      await onRestore(restoreTarget);
    }
    setRestoreTarget(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Version History</h3>
            <p className="text-sm text-muted-foreground">
              {versions.length} version{versions.length !== 1 ? 's' : ''} available
            </p>
          </div>

          {selectedForCompare.size === 2 && (
            <Button size="sm" onClick={handleCompare}>
              <GitCompare className="mr-1 h-4 w-4" />
              Compare Selected
            </Button>
          )}
        </div>

        {/* Current version banner */}
        {currentVersion && (
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {currentVersion.version}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Current Version</span>
                  <Badge className={STATUS_COLORS[currentVersion.status]}>
                    {currentVersion.status}
                  </Badge>
                  {currentVersion.isLocked && (
                    <Badge variant="outline">Locked</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(currentVersion.createdAt)} · {currentVersion.createdBy}
                </p>
              </div>
              {currentVersion.totalAmount !== undefined && (
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(currentVersion.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Version list */}
        <ScrollArea className="max-h-96 pr-4">
          <div className="space-y-2">
            {versions.map((version, index) => {
              const isCurrent = version.id === currentVersion.id;
              const isSelected = selectedForCompare.has(version.id);

              return (
                <div
                  key={version.id}
                  className={`group relative rounded-lg border p-4 transition-colors ${
                    isCurrent
                      ? 'border-primary/50 bg-primary/5'
                      : 'hover:bg-muted/50'
                  } ${isSelected ? 'border-primary ring-1 ring-primary' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Compare checkbox */}
                    {!isCurrent && !version.isLocked && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectForCompare(version.id)}
                        className="mt-0.5"
                      />
                    )}

                    {/* Version indicator */}
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                      {version.version}
                    </div>

                    {/* Info */}
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{version.version}</span>
                        {isCurrent && (
                          <Badge variant="default" className="text-xs">Current</Badge>
                        )}
                        <Badge className={`text-xs ${STATUS_COLORS[version.status]}`}>
                          {version.status}
                        </Badge>
                        {version.isLocked && (
                          <Badge variant="outline" className="text-xs">Locked</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(version.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {version.createdBy}
                        </span>
                        {version.totalAmount !== undefined && (
                          <span className="font-medium text-foreground">
                            {formatCurrency(version.totalAmount)}
                          </span>
                        )}
                        {version.deviceCount !== undefined && (
                          <span>{version.deviceCount} device{version.deviceCount !== 1 ? 's' : ''}</span>
                        )}
                      </div>

                      {version.changesSummary && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {version.changesSummary}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {!isCurrent && !version.isLocked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setRestoreTarget(version)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {versions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No version history available.</p>
          </div>
        )}
      </div>

      {/* Compare Dialog */}
      {compareVersions && (
        <CompareDialog
          open={compareOpen}
          leftVersion={compareVersions[0]}
          rightVersion={compareVersions[1]}
          onClose={() => {
            setCompareOpen(false);
            setSelectedForCompare(new Set());
          }}
        />
      )}

      {/* Restore Dialog */}
      <RestoreDialog
        open={restoreTarget !== null}
        version={restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestore}
      />
    </>
  );
}

export default QuoteVersionManager;
