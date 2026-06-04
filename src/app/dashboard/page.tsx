'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  FileText,
  Clock,
  AlertTriangle,
  TrendingUp,
  Plus,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';

// Mock data for statistics
const stats = {
  totalQuotes: 156,
  thisMonth: 23,
  pendingReview: 8,
  expiringSoon: 5,
};

// Mock data for monthly trends (last 6 months)
const monthlyTrends = [
  { month: 'Jan', quotes: 18 },
  { month: 'Feb', quotes: 24 },
  { month: 'Mar', quotes: 21 },
  { month: 'Apr', quotes: 32 },
  { month: 'May', quotes: 28 },
  { month: 'Jun', quotes: 23 },
];

// Mock data for recent activity
const recentActivity = [
  {
    id: 1,
    action: 'Quote approved',
    quote: 'Q-2024-0156',
    client: 'TechCorp Inc.',
    time: '2 hours ago',
    type: 'approved',
  },
  {
    id: 2,
    action: 'New quote created',
    quote: 'Q-2024-0155',
    client: 'Global Solutions',
    time: '4 hours ago',
    type: 'created',
  },
  {
    id: 3,
    action: 'Quote rejected',
    quote: 'Q-2024-0154',
    client: 'StarTech Ltd.',
    time: '6 hours ago',
    type: 'rejected',
  },
  {
    id: 4,
    action: 'Quote pending review',
    quote: 'Q-2024-0153',
    client: 'Alpha Industries',
    time: '8 hours ago',
    type: 'pending',
  },
  {
    id: 5,
    action: 'Quote sent to client',
    quote: 'Q-2024-0152',
    client: 'Beta Corporation',
    time: '1 day ago',
    type: 'sent',
  },
];

// Mock data for expiring items
const expiringItems = [
  {
    id: 1,
    type: 'contract',
    name: 'Office Network Upgrade',
    client: 'TechCorp Inc.',
    expiryDate: '2024-07-15',
    daysLeft: 12,
  },
  {
    id: 2,
    type: 'device',
    name: 'Server Maintenance Contract',
    client: 'DataSystems Co.',
    expiryDate: '2024-07-20',
    daysLeft: 17,
  },
  {
    id: 3,
    type: 'contract',
    name: 'Security System Installation',
    client: 'SecureNet LLC',
    expiryDate: '2024-07-25',
    daysLeft: 22,
  },
];

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'approved':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'rejected':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'created':
    case 'sent':
      return <FileText className="h-4 w-4 text-blue-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

const getActivityBadge = (type: string) => {
  switch (type) {
    case 'approved':
      return <Badge variant="default" className="bg-green-500">Approved</Badge>;
    case 'rejected':
      return <Badge variant="destructive">Rejected</Badge>;
    case 'created':
      return <Badge variant="secondary">Created</Badge>;
    case 'sent':
      return <Badge variant="outline">Sent</Badge>;
    case 'pending':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your quotation system
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Quote
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Quotes
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuotes}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              This Month
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground">
              +5 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingReview}</div>
            <p className="text-xs text-muted-foreground">
              3 awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Expiring Soon
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiringSoon}</div>
            <p className="text-xs text-muted-foreground">
              Next 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Activity Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Monthly Trends Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Monthly Quote Trends</CardTitle>
            <CardDescription>
              Number of quotes created per month (last 6 months)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar
                    dataKey="quotes"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name="Quotes"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expiring Items */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" />
              Expiring Soon
            </CardTitle>
            <CardDescription>
              Contracts and devices expiring within 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expiringItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.client}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge
                        variant="outline"
                        className={
                          item.daysLeft <= 14
                            ? 'border-orange-500 text-orange-600'
                            : 'border-yellow-500 text-yellow-600'
                        }
                      >
                        {item.daysLeft} days left
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest actions on your quotes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {activity.action}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {activity.quote}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {activity.client}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getActivityBadge(activity.type)}
                    <span className="text-xs text-muted-foreground">
                      {activity.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="default" className="w-full justify-start">
              <Plus className="mr-2 h-4 w-4" />
              Create New Quote
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Eye className="mr-2 h-4 w-4" />
              View Pending Quotes
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Download className="mr-2 h-4 w-4" />
              Export Reports
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <FileText className="mr-2 h-4 w-4" />
              Manage Templates
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
