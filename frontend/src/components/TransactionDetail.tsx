/**
 * Transaction detail component with evidence display.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  Mail,
  MessageSquare,
  FileText,
  Edit2,
  Save,
  X,
} from 'lucide-react'
import { fetchTransaction, updateTransactionNotes } from '../api/transactions'

interface TransactionDetailProps {
  transactionId: string
  onBack: () => void
}

export function TransactionDetail({ transactionId, onBack }: TransactionDetailProps) {
  const queryClient = useQueryClient()
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')

  const {
    data: transaction,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => fetchTransaction(transactionId, true),
    onSuccess: (data) => {
      setNotesValue(data.notes || '')
    },
  })

  const notesMutation = useMutation({
    mutationFn: (notes: string | null) => updateTransactionNotes(transactionId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction', transactionId] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setIsEditingNotes(false)
    },
  })

  const formatAmount = (amount: string, currency: string) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency,
    }).format(parseFloat(amount))
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleSaveNotes = () => {
    notesMutation.mutate(notesValue.trim() || null)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </button>
        <div className="text-center py-8 text-muted-foreground">Loading transaction...</div>
      </div>
    )
  }

  if (error || !transaction) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </button>
        <div className="text-center py-8 text-destructive">Failed to load transaction</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </button>
      </div>

      {/* Main Info Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              transaction.direction === 'debit'
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
            }`}
          >
            {transaction.direction === 'debit' ? (
              <ArrowUpCircle className="h-7 w-7" />
            ) : (
              <ArrowDownCircle className="h-7 w-7" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">
              {transaction.vendor_name || transaction.vendor_raw || 'Unknown Vendor'}
            </h2>
            <p className="text-muted-foreground">{formatDateTime(transaction.occurred_at)}</p>
          </div>
          <div
            className={`text-2xl font-bold ${
              transaction.direction === 'debit' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
            }`}
          >
            {transaction.direction === 'debit' ? '-' : '+'}
            {formatAmount(transaction.amount, transaction.currency)}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Category</span>
            <p className="font-medium">{transaction.category_name || 'Uncategorized'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Status</span>
            <p className="font-medium capitalize">{transaction.status}</p>
          </div>
          {transaction.reference_id && (
            <div>
              <span className="text-muted-foreground">Reference</span>
              <p className="font-medium font-mono text-xs">{transaction.reference_id}</p>
            </div>
          )}
          {transaction.combined_balance_after && (
            <div>
              <span className="text-muted-foreground">Balance After</span>
              <p className="font-medium">
                {formatAmount(transaction.combined_balance_after, transaction.currency)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notes Section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium flex items-center gap-2">
            <Edit2 className="h-4 w-4" />
            Notes
          </h3>
          {!isEditingNotes ? (
            <button
              onClick={() => setIsEditingNotes(true)}
              className="text-sm text-primary hover:underline"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsEditingNotes(false)
                  setNotesValue(transaction.notes || '')
                }}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={notesMutation.isPending}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Save className="h-3 w-3" />
                Save
              </button>
            </div>
          )}
        </div>
        {isEditingNotes ? (
          <textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
            rows={3}
            placeholder="Add notes about this transaction..."
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {transaction.notes || 'No notes added'}
          </p>
        )}
      </div>

      {/* Evidence Section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-medium flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4" />
          Evidence ({transaction.evidence.length} source{transaction.evidence.length !== 1 ? 's' : ''})
        </h3>
        <div className="space-y-4">
          {transaction.evidence.map((ev) => (
            <div key={ev.id} className="rounded-md border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                {ev.source === 'sms' ? (
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                ) : (
                  <Mail className="h-4 w-4 text-purple-500" />
                )}
                <span className="font-medium capitalize">{ev.source}</span>
                <span className="text-muted-foreground">from {ev.sender}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDateTime(ev.observed_at)}
                </span>
              </div>
              {ev.raw_body && (
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap font-mono text-muted-foreground">
                  {ev.raw_body}
                </pre>
              )}
              <p className="text-xs text-muted-foreground mt-2 italic">
                Role: {ev.role} | Read-only evidence
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
