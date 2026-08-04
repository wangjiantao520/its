'use client';

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmOptions {
  title?: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  // 确认按钮样式（默认 destructive）
  variant?: 'destructive' | 'default';
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

/**
 * 通用确认对话框 Hook
 *
 * 用法：
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   if (!await confirm({ description: '确定删除？' })) return;
 *   // 执行删除...
 *
 * 在组件 JSX 中渲染 <ConfirmDialog /> 即可。
 *
 * 对比原生 confirm()：
 * - 不阻塞主线程
 * - 样式统一 shadcn
 * - 移动端友好
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    description: '',
    resolve: null,
  });
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({
        ...options,
        open: true,
        resolve,
      });
    });
  }, []);

  const handleAction = useCallback((result: boolean) => {
    const current = stateRef.current;
    current.resolve?.(result);
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  }, []);

  const ConfirmDialog = (
    <AlertDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) handleAction(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title ?? '请确认'}</AlertDialogTitle>
          <AlertDialogDescription>{state.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => handleAction(false)}
            className={state.variant === 'destructive' ? '' : ''}
          >
            {state.cancelText ?? '取消'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleAction(true)}
            className={
              state.variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }
          >
            {state.confirmText ?? '确认'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}
