'use client';

import React, { useState, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  Edit3,
  ChevronDown,
  Check,
  X,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatchSelectableItem {
  id: string;
  name: string;
  quantity?: number;
  serviceYears?: number;
  regionCoefficient?: number;
  slaConfig?: string;
  selected?: boolean;
}

export interface BatchOperationsProps<T extends BatchSelectableItem = BatchSelectableItem> {
  selectedItems: T[];
  onBatchAction: (action: BatchAction, payload?: BatchPayload) => void;
  onSelectAll?: (select: boolean) => void;
  onClearSelection?: () => void;
  allItems?: T[];
  isLoading?: boolean;
}

export type BatchAction =
  | 'edit-quantity'
  | 'edit-service-years'
  | 'edit-region-coefficient'
  | 'apply-sla'
  | 'delete';

export interface BatchPayload {
  quantity?: number;
  serviceYears?: number;
  regionCoefficient?: number;
  slaConfig?: string;
}

// ─── SLA Config Options ───────────────────────────────────────────────────────

const SLA_CONFIGS = [
  { value: 'sla-bronze', label: 'SLA Bronze (4h Response)' },
  { value: 'sla-silver', label: 'SLA Silver (2h Response)' },
  { value: 'sla-gold', label: 'SLA Gold (1h Response)' },
  { value: 'sla-platinum', label: 'SLA Platinum (30min Response)' },
];

// ─── Batch Edit Dialog ────────────────────────────────────────────────────────

interface BatchEditDialogProps {
  open: boolean;
  title: string;
  description: string;
  field: 'quantity' | 'serviceYears' | 'regionCoefficient' | 'slaConfig';
  onConfirm: (value: number | string) => void;
  onCancel: () => void;
}

function BatchEditDialog({
  open,
  title,
  description,
  field,
  onConfirm,
  onCancel,
}: BatchEditDialogProps) {
  const [value, setValue] = useState('');

  const handleConfirm = () => {
    if (field === 'quantity' || field === 'serviceYears') {
      const num = parseInt(value, 10);
      if (!isNaN(num)) onConfirm(num);
    } else if (field === 'regionCoefficient') {
      const num = parseFloat(value);
      if (!isNaN(num)) onConfirm(num);
    } else {
      onConfirm(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {field === 'slaConfig' ? (
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger>
                <SelectValue placeholder="Select SLA config" />
              </SelectTrigger>
              <SelectContent>
                {SLA_CONFIGS.map((sla) => (
                  <SelectItem key={sla.value} value={sla.value}>
                    {sla.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={field === 'regionCoefficient' ? 'number' : 'number'}
              step={field === 'regionCoefficient' ? '0.01' : '1'}
              min={field === 'quantity' ? 1 : 0}
              placeholder={
                field === 'quantity'
                  ? 'Enter quantity'
                  : field === 'serviceYears'
                  ? 'Enter service years (1-5)'
                  : 'Enter region coefficient (e.g. 1.0)'
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              value === '' ||
              (field !== 'slaConfig' && isNaN(Number(value)))
            }
          >
            Apply to {0} Items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BatchOperations<T extends BatchSelectableItem = BatchSelectableItem>({
  selectedItems,
  onBatchAction,
  onSelectAll,
  onClearSelection,
  allItems = [],
  isLoading = false,
}: BatchOperationsProps<T>) {
  const count = selectedItems.length;

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    field: BatchPayload;
    title: string;
    description: string;
  }>({
    open: false,
    field: {} as BatchPayload,
    title: '',
    description: '',
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const openEditDialog = (
    field: 'quantity' | 'serviceYears' | 'regionCoefficient' | 'slaConfig',
    title: string,
    description: string,
  ) => {
    setEditDialog({ open: true, field: { [field]: undefined } as BatchPayload, title, description });
  };

  const handleEditConfirm = (value: number | string) => {
    const field = Object.keys(editDialog.field)[0] as keyof BatchPayload;
<<<<<<< HEAD
=======
<<<<<<< HEAD
    onBatchAction(`edit-${field === 'quantity' ? 'quantity' : field === 'serviceYears' ? 'service-years' : field}` as any, {
      [field]: value,
    });
=======
>>>>>>> bde36429f3f891b8547edd102e5452f260447f1d
    const fieldMap: Record<string, BatchAction> = {
      quantity: 'edit-quantity',
      serviceYears: 'edit-service-years',
      regionCoefficient: 'edit-region-coefficient',
    };
    const action = fieldMap[field as string] || 'edit-quantity';
    onBatchAction(action, { [field]: value });
<<<<<<< HEAD
=======
>>>>>>> dev-0602-zwj
>>>>>>> bde36429f3f891b8547edd102e5452f260447f1d
    setEditDialog((d) => ({ ...d, open: false }));
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      onBatchAction('delete');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleSelectAll = () => {
    if (count === allItems.length) {
      onSelectAll?.(false);
    } else {
      onSelectAll?.(true);
    }
  };

  if (count === 0 && allItems.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
        {/* Selection count */}
        <div className="flex items-center gap-2 text-sm font-medium">
          {count > 0 ? (
            <>
              <Badge variant="secondary" className="text-xs">
                {count} selected
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground"
                onClick={onClearSelection}
              >
                <X className="mr-1 h-3 w-3" />
                Clear
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">No items selected</span>
          )}
        </div>

        {allItems.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            onClick={handleSelectAll}
          >
            {count === allItems.length ? (
              <>
                <X className="mr-1 h-3 w-3" />
                Deselect All
              </>
            ) : (
              <>
                <Check className="mr-1 h-3 w-3" />
                Select All
              </>
            )}
          </Button>
        )}

        {/* Divider */}
        {count > 0 && (
          <div className="h-4 w-px bg-border" aria-hidden />
        )}

        {/* Batch actions */}
        {count > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Edit quantity */}
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() =>
                openEditDialog('quantity', 'Batch Edit Quantity', 'Update the quantity for all selected items.')
              }
            >
              <Edit3 className="mr-1 h-3 w-3" />
              Quantity
            </Button>

            {/* Edit service years */}
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() =>
                openEditDialog(
                  'serviceYears',
                  'Batch Edit Service Years',
                  'Update the service years for all selected items.',
                )
              }
            >
              <Edit3 className="mr-1 h-3 w-3" />
              Service Years
            </Button>

            {/* Edit region coefficient */}
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() =>
                openEditDialog(
                  'regionCoefficient',
                  'Batch Edit Region Coefficient',
                  'Update the region coefficient for all selected items.',
                )
              }
            >
              <Edit3 className="mr-1 h-3 w-3" />
              Region
            </Button>

            {/* Apply SLA */}
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() =>
                openEditDialog(
                  'slaConfig',
                  'Apply SLA Config',
                  'Apply an SLA configuration to all selected items.',
                )
              }
            >
              <ShieldCheck className="mr-1 h-3 w-3" />
              SLA Config
            </Button>

            {/* Delete */}
            <Button
              variant="destructive"
              size="sm"
              className="h-7"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isLoading}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Batch Edit Dialog */}
      <BatchEditDialog
        open={editDialog.open}
        title={editDialog.title}
        description={editDialog.description}
        field={Object.keys(editDialog.field)[0] as 'quantity' | 'serviceYears' | 'regionCoefficient' | 'slaConfig'}
        onConfirm={handleEditConfirm}
        onCancel={() => setEditDialog((d) => ({ ...d, open: false }))}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {count} Item{count !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {count} selected item{count !== 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete {count} Item{count !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BatchOperations;
