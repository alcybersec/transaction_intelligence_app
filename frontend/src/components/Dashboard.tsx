/**
 * Dashboard component with analytics, charts, and budget overview.
 */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { fetchDashboardAnalytics, fetchSpendingTimeSeries, DashboardAnalyticsResponse } from '../api/analytics'
import { fetchBudgets, BudgetProgress } from '../api/budgets'
import { exportTransactionsCsv, downloadBlob } from '../api/reports'

const COLORS = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#E91E63', '#607D8B', '#FF5722', '#00BCD4']

export function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Calculate period dates from selected month
  const { periodStart, periodEnd, monthName } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0)
    return {
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0],
      monthName: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    }
  }, [selectedMonth])

  // Fetch dashboard analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['dashboard-analytics', periodStart, periodEnd],
    queryFn: () => fetchDashboardAnalytics({ period_start: periodStart, period_end: periodEnd }),
  })

  // Fetch time series
  const { data: timeSeries } = useQuery({
    queryKey: ['spending-timeseries', periodStart, periodEnd],
    queryFn: () => fetchSpendingTimeSeries({ period_start: periodStart, period_end: periodEnd }),
  })

  // Fetch budgets
  const { data: budgets } = useQuery({
    queryKey: ['budgets', periodStart],
    queryFn: () => fetchBudgets({ month: periodStart }),
  })

  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number)
    let newYear = year
    let newMonth = month + (direction === 'next' ? 1 : -1)

    if (newMonth > 12) {
      newMonth = 1
      newYear++
    } else if (newMonth < 1) {
      newMonth = 12
      newYear--
    }

    setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`)
  }

  const handleExportCsv = async () => {
    try {
      const blob = await exportTransactionsCsv({
        start_date: periodStart,
        end_date: periodEnd,
      })
      downloadBlob(blob, `transactions_${selectedMonth}.csv`)
    } catch (error) {
      console.error('Failed to export:', error)
    }
  }

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
  }

  // Prepare chart data
  const categoryChartData = useMemo(() => {
    if (!analytics?.top_categories) return []
    return analytics.top_categories.map((cat) => ({
      name: cat.category_name,
      value: parseFloat(cat.total_amount),
      color: cat.category_color || COLORS[0],
    }))
  }, [analytics])

  const timeSeriesData = useMemo(() => {
    if (!timeSeries?.daily_data) return []
    return timeSeries.daily_data.map((day) => ({
      date: new Date(day.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      spending: parseFloat(day.debit_amount),
      income: parseFloat(day.credit_amount),
    }))
  }, [timeSeries])

  if (analyticsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 rounded-md hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{monthName}</span>
          </div>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 rounded-md hover:bg-muted"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg hover:bg-muted"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Balance */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Wallet className="h-4 w-4" />
            <span className="text-sm">Total Balance</span>
          </div>
          <div className="text-2xl font-bold">
            {analytics?.total_balance ? formatCurrency(analytics.total_balance) : 'N/A'}
          </div>
        </div>

        {/* Spending */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm">Spending</span>
          </div>
          <div className="text-2xl font-bold text-red-600">
            {analytics ? formatCurrency(analytics.total_spending) : '0'}
          </div>
          {analytics?.monthly_comparison && (
            <div className={`text-sm mt-1 flex items-center gap-1 ${
              parseFloat(analytics.monthly_comparison.change_amount) > 0 ? 'text-red-500' : 'text-green-500'
            }`}>
              {parseFloat(analytics.monthly_comparison.change_amount) > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {analytics.monthly_comparison.change_percentage !== null && (
                <span>{Math.abs(analytics.monthly_comparison.change_percentage).toFixed(1)}% vs last month</span>
              )}
            </div>
          )}
        </div>

        {/* Income */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <ArrowDownCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">Income</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {analytics ? formatCurrency(analytics.total_income) : '0'}
          </div>
        </div>

        {/* Net Change */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            {parseFloat(analytics?.net_change || '0') >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">Net Change</span>
          </div>
          <div className={`text-2xl font-bold ${
            parseFloat(analytics?.net_change || '0') >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {analytics ? formatCurrency(analytics.net_change) : '0'}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {analytics?.transaction_count || 0} transactions
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="p-4 rounded-lg border bg-card">
          <h3 className="font-semibold mb-4">Spending by Category</h3>
          {categoryChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No spending data for this period
            </div>
          )}
        </div>

        {/* Daily Spending Trend */}
        <div className="p-4 rounded-lg border bg-card">
          <h3 className="font-semibold mb-4">Daily Spending Trend</h3>
          {timeSeriesData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="spending" stroke="#ef4444" name="Spending" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="income" stroke="#22c55e" name="Income" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No transaction data for this period
            </div>
          )}
        </div>
      </div>

      {/* Budget Progress */}
      {budgets && budgets.budgets.length > 0 && (
        <div className="p-4 rounded-lg border bg-card">
          <h3 className="font-semibold mb-4">Budget Progress</h3>
          <div className="space-y-4">
            {budgets.budgets.map((budget) => (
              <BudgetProgressBar key={budget.id} budget={budget} />
            ))}
          </div>
        </div>
      )}

      {/* Top Vendors */}
      <div className="p-4 rounded-lg border bg-card">
        <h3 className="font-semibold mb-4">Top Merchants</h3>
        {analytics?.top_vendors && analytics.top_vendors.length > 0 ? (
          <div className="space-y-3">
            {analytics.top_vendors.map((vendor, index) => (
              <div key={vendor.vendor_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                  <div>
                    <div className="font-medium">{vendor.vendor_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {vendor.category_name || 'Uncategorized'} · {vendor.transaction_count} transactions
                    </div>
                  </div>
                </div>
                <div className="text-right font-medium">
                  {formatCurrency(vendor.total_amount)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground">No vendor data for this period</div>
        )}
      </div>
    </div>
  )
}

function BudgetProgressBar({ budget }: { budget: BudgetProgress }) {
  const percentage = Math.min(budget.percentage_used, 100)
  const isOverBudget = budget.is_over_budget

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: budget.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(value))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{budget.category_name}</span>
          {isOverBudget && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>
        <div className="text-sm">
          <span className={isOverBudget ? 'text-red-600 font-medium' : ''}>
            {formatCurrency(budget.spent_amount)}
          </span>
          <span className="text-muted-foreground"> / {formatCurrency(budget.limit_amount)}</span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOverBudget ? 'bg-red-500' : budget.percentage_used > 80 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isOverBudget && (
        <div className="text-xs text-red-500 mt-1">
          Over budget by {formatCurrency(String(Math.abs(parseFloat(budget.remaining_amount))))}
        </div>
      )}
    </div>
  )
}
