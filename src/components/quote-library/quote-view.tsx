'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { QuoteData, QuoteFloorPoint } from '@/lib/quote-library-types';

interface QuoteViewProps {
  data: QuoteData;
}

function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return value.toFixed(2);
}

export function QuoteView({ data }: QuoteViewProps) {
  const summary = data.summary;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{summary.title || '报价汇总'}</CardTitle>
        <CardDescription>含税合计：{formatNumber(summary.totals.taxable_total)} 元</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目名称</TableHead>
                <TableHead>规格/型号/参数</TableHead>
                <TableHead>单位</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead className="text-right">单价</TableHead>
                <TableHead className="text-right">含税单价(6%)</TableHead>
                <TableHead className="text-right">铁建含税(6%)</TableHead>
                <TableHead className="text-right">移动含税(8%)</TableHead>
                <TableHead className="text-right">含税合计</TableHead>
                <TableHead className="text-right">铁建合计</TableHead>
                <TableHead className="text-right">移动合计</TableHead>
                <TableHead>备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-4">暂无明细</TableCell>
                </TableRow>
              )}
              {summary.items.map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell>{it.spec ?? '-'}</TableCell>
                  <TableCell>{it.unit ?? '-'}</TableCell>
                  <TableCell className="text-right tabular-nums">{it.quantity ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(it.unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(it.taxable_unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(it.tiejiang_taxable_unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(it.yidong_taxable_unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatNumber(it.total_taxable)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(it.tiejiang_total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(it.yidong_total)}</TableCell>
                  <TableCell>{it.remark ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">含税合计</div>
            <div className="text-lg font-semibold">{formatNumber(summary.totals.taxable_total)}</div>
          </div>
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">铁建合计</div>
            <div className="text-lg font-semibold">{formatNumber(summary.totals.tiejiang_taxable_total)}</div>
          </div>
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">移动合计</div>
            <div className="text-lg font-semibold">{formatNumber(summary.totals.yidong_taxable_total)}</div>
          </div>
        </div>

        {summary.note && (
          <div className="rounded border-l-4 border-primary bg-primary/5 p-3 text-sm">
            <strong>说明：</strong>{summary.note}
          </div>
        )}

        {data.points && data.points.floors.length > 0 && (
          <PointsView points={data.points.floors} />
        )}
      </CardContent>
    </Card>
  );
}

function PointsView({ points }: { points: QuoteFloorPoint[] }) {
  const maxCounts = Math.max(0, ...points.map((p) => p.counts.length));
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">点位表</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>楼层</TableHead>
              {Array.from({ length: maxCounts }).map((_, i) => (
                <TableHead key={i} className="text-right">点位 {i + 1}</TableHead>
              ))}
              <TableHead>AP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((p, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium">{p.name}</TableCell>
                {Array.from({ length: maxCounts }).map((_, i) => (
                  <TableCell key={i} className="text-right tabular-nums">{p.counts[i] ?? ''}</TableCell>
                ))}
                <TableCell>{p.ap ? <Badge variant="outline">{p.ap}</Badge> : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}