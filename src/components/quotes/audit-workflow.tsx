'use client';

import React, { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Archive,
  FileText,
  Loader2,
  MessageSquare,
  ChevronRight,
  Ban,
  RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditStatus =
  | 'draft'
  | 'pending-review'
  | 'in-review'
  | 'approved'
  | 'rejected'
  | 'sent'
  | 'archived';

export interface AuditHistoryEntry {
  id: string;
  action: AuditStatus;
  performedBy: string;
  performedAt: string; // ISO
  comment?: string;
  previousStatus?: AuditStatus;
}

export interface AuditWorkflowProps {
  quoteId: string;
  quoteType?: 'hardware' | 'service' | 'mixed';
  currentStatus: AuditStatus;
  auditHistory?: AuditHistoryEntry[];
  onAction?: (action: AuditAction, comment?: string) => Promise<void>;
  isLoading?: boolean;
}

export type AuditAction =
  | 'submit-for-review'
  | 'approve'
  | 'reject'
  | 'request-revision'
  | 'send'
  | 'archive'
  | 'restore';

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AuditStatus,
  { label: string; color: string; icon: React.ElementType; description: string }
> = {
  draft: {
    label: 'Draft',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: FileText,
    description: 'Quote is being prepared',
  },
  'pending-review': {
    label: 'Pending Review',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: Clock,
    description: 'Awaiting reviewer assignment',
  },
  'in-review': {
    label: 'In Review',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: RefreshCw,
    description: 'Currently under review',
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle2,
    description: 'Quote approved and ready to send',
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle,
    description: 'Quote rejected',
  },
  sent: {
    label: 'Sent',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: Send,
    description: 'Quote sent to client',
  },
  archived: {
    label: 'Archived',
    color: 'bg-stone-100 text-stone-500 border-stone-200',
    icon: Archive,
    description: 'Quote archived',
  },
};

// ─── Workflow Steps ───────────────────────────────────────────────────────────

const WORKFLOW_STEPS: AuditStatus[] = [
  'draft',
  'pending-review',
  'in-review',
  'approved',
  'sent',
];

function getStepIndex(status: AuditStatus): number {
  return WORKFLOW_STEPS.indexOf(status);
}

// ─── Reject Dialog ────────────────────────────────────────────────────────────

interface RejectDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void>;
  mode: 'reject' | 'request-revision';
}

function RejectDialog({ open, onClose, onConfirm, mode }: RejectDialogProps) {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!comment.trim()) return;
    setIsSubmitting(true);
    try {
      await onConfirm(comment);
      setComment('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'reject' ? 'Reject Quote' : 'Request Revision'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'reject'
              ? 'Please provide a reason for rejecting this quote.'
              : 'Describe what changes are needed before this quote can be approved.'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <Label htmlFor="audit-comment">Comment {mode === 'reject' ? '(required)' : '(optional)'}</Label>
          <Textarea
            id="audit-comment"
            placeholder={
              mode === 'reject'
                ? 'Enter rejection reason...'
                : 'Describe the required changes...'
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={mode === 'reject' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={mode === 'reject' && !comment.trim()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'reject' ? 'Reject Quote' : 'Request Revision'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AuditWorkflow({
  quoteId,
  currentStatus,
  auditHistory = [],
  onAction,
  isLoading = false,
}: AuditWorkflowProps) {
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    mode: 'reject' | 'request-revision';
  }>({ open: false, mode: 'reject' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localHistory, setLocalHistory] = useState<AuditHistoryEntry[]>(auditHistory);

  const allHistory = auditHistory.length > 0 ? auditHistory : localHistory;
  const config = STATUS_CONFIG[currentStatus];
  const currentStepIndex = getStepIndex(currentStatus);
  const progressPct = Math.round(((currentStepIndex + 1) / WORKFLOW_STEPS.length) * 100);

  const handleAction = useCallback(
    async (action: AuditAction, comment?: string) => {
      if (!onAction) return;
      setIsSubmitting(true);
      try {
        await onAction(action, comment);

        // Optimistically update local history
        const newEntry: AuditHistoryEntry = {
          id: `entry-${Date.now()}`,
          action: getNextStatus(action, currentStatus),
          performedBy: 'Current User',
          performedAt: new Date().toISOString(),
          comment,
          previousStatus: currentStatus,
        };
        setLocalHistory((prev) => [newEntry, ...prev]);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onAction, currentStatus],
  );

  const handleRejectConfirm = async (comment: string) => {
    await handleAction('reject', comment);
    setRejectDialog({ open: false, mode: 'reject' });
  };

  const handleRevisionConfirm = async (comment: string) => {
    await handleAction('request-revision', comment);
    setRejectDialog({ open: false, mode: 'request-revision' });
  };

  const CurrentIcon = config.icon;

  return (
    <>
      <div className="space-y-6">
        {/* Status Badge + Description */}
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 ${config.color.split(' ')[0]} ${config.color.split(' ')[2]}`}>
            <CurrentIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold">{config.label}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>

        {/* Progress Indicator */}
        {!['rejected', 'archived'].includes(currentStatus) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Approval Progress</span>
              <span>{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <div className="flex justify-between">
              {WORKFLOW_STEPS.map((step, idx) => {
                const stepConfig = STATUS_CONFIG[step];
                const StepIcon = stepConfig.icon;
                const isComplete = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                return (
                  <div key={step} className="flex flex-col items-center gap-1">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        isComplete
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? stepConfig.color
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <StepIcon className="h-3 w-3" />
                      )}
                    </div>
                    <span className={`text-xs ${isCurrent ? 'font-medium' : 'text-muted-foreground'}`}>
                      {stepConfig.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Available Actions
          </Label>
          <div className="flex flex-wrap gap-2">
            {currentStatus === 'draft' && (
              <Button
                size="sm"
                onClick={() => handleAction('submit-for-review')}
                disabled={isSubmitting || isLoading}
              >
                <Send className="mr-1 h-4 w-4" />
                Submit for Review
              </Button>
            )}

            {(currentStatus === 'pending-review' || currentStatus === 'in-review') && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleAction('approve')}
                  disabled={isSubmitting || isLoading}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectDialog({ open: true, mode: 'request-revision' })}
                  disabled={isSubmitting || isLoading}
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Request Revision
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setRejectDialog({ open: true, mode: 'reject' })}
                  disabled={isSubmitting || isLoading}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}

            {currentStatus === 'approved' && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleAction('send')}
                  disabled={isSubmitting || isLoading}
                >
                  <Send className="mr-1 h-4 w-4" />
                  Send to Client
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction('archive')}
                  disabled={isSubmitting || isLoading}
                >
                  <Archive className="mr-1 h-4 w-4" />
                  Archive
                </Button>
              </>
            )}

            {currentStatus === 'rejected' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction('restore')}
                disabled={isSubmitting || isLoading}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                Restore to Draft
              </Button>
            )}

            {currentStatus === 'sent' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction('archive')}
                disabled={isSubmitting || isLoading}
              >
                <Archive className="mr-1 h-4 w-4" />
                Archive
              </Button>
            )}

            {isSubmitting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </div>
            )}
          </div>
        </div>

        {/* Audit History Timeline */}
        {allHistory.length > 0 && (
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Audit History
            </Label>
            <div className="relative space-y-0">
              {/* Vertical line */}
              <div className="absolute left-3 top-3 bottom-3 w-px bg-border" />

              <div className="space-y-3">
                {allHistory.map((entry, idx) => {
                  const entryConfig = STATUS_CONFIG[entry.action];
                  const EntryIcon = entryConfig.icon;
                  const isLatest = idx === 0;

                  return (
                    <div key={entry.id} className="relative flex gap-3 pl-0">
                      {/* Icon */}
                      <div
                        className={`relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs ${
                          entry.action === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : entry.action === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        <EntryIcon className="h-3 w-3" />
                      </div>

                      {/* Content */}
                      <div
                        className={`flex-1 rounded-lg border p-3 ${
                          isLatest ? 'bg-primary/5 border-primary/20' : 'bg-card'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-medium">{entryConfig.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {entry.performedBy}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.performedAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        {entry.comment && (
                          <div className="mt-2 flex items-start gap-2 rounded bg-muted p-2">
                            <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{entry.comment}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {allHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed">
            <Clock className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No audit history yet.</p>
          </div>
        )}
      </div>

      {/* Reject / Revision Dialog */}
      <RejectDialog
        open={rejectDialog.open}
        mode={rejectDialog.mode}
        onClose={() => setRejectDialog({ open: false, mode: 'reject' })}
        onConfirm={rejectDialog.mode === 'reject' ? handleRejectConfirm : handleRevisionConfirm}
      />
    </>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getNextStatus(action: AuditAction, current: AuditStatus): AuditStatus {
  switch (action) {
    case 'submit-for-review':
      return 'pending-review';
    case 'approve':
      return 'approved';
    case 'reject':
      return 'rejected';
    case 'request-revision':
      return 'draft';
    case 'send':
      return 'sent';
    case 'archive':
      return 'archived';
    case 'restore':
      return 'draft';
    default:
      return current;
  }
}

export default AuditWorkflow;
