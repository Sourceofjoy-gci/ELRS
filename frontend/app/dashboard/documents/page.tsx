'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { api, Document } from '@/lib/api'
import { Header } from '@/components/layout/Header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react'

const DOC_TYPE_LABELS: Record<string, string> = {
  act: 'Act',
  constitution: 'Constitutional',
  statutory_instrument: 'Statutory Instrument',
  bill: 'Bill',
  case_law: 'Case Law',
  regulation: 'Regulation',
  gazette: 'Gazette',
}

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  amended: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  repealed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 25

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true)
      try {
        const params: Parameters<typeof api.documents.list>[0] = {
          page,
        }
        if (docTypeFilter !== 'all') params.doc_type = docTypeFilter
        if (statusFilter !== 'all') params.status = statusFilter
        if (search) params.q = search

        const data = await api.documents.list(params)
        setDocuments(data.documents)
        setTotal(data.total)
      } catch (error) {
        console.error('Failed to fetch documents:', error)
        setDocuments([])
      } finally {
        setLoading(false)
      }
    }
    fetchDocuments()
  }, [search, docTypeFilter, statusFilter, page])

  const filteredDocuments = documents.filter((doc) =>
    search
      ? doc.title.toLowerCase().includes(search.toLowerCase()) ||
        doc.act_number?.toLowerCase().includes(search.toLowerCase())
      : true
  )

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <Header title="Document Library" breadcrumb={['Dashboard', 'Documents']} />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by title or act number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Document type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="amended">Amended</SelectItem>
              <SelectItem value="repealed">Repealed</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-white dark:bg-gray-900">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ministry
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Loading documents...
                    </td>
                  </tr>
                ) : filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No documents found
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/documents/${doc.id}`}
                          className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white hover:text-primary"
                        >
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span>{doc.title}</span>
                          {doc.act_number && (
                            <span className="text-xs text-gray-500">
                              ({doc.act_number})
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {doc.year || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                            STATUS_COLORS[doc.status] || STATUS_COLORS.draft
                          )}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {doc.ministry || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * pageSize + 1} to{' '}
                {Math.min(page * pageSize, total)} of {total} documents
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
