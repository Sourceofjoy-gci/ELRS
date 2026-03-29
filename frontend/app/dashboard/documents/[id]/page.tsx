'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api, Document, DocumentChunk } from '@/lib/api'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowLeft, Download, FileText, ChevronRight } from 'lucide-react'

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  amended: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  repealed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  act: 'Act',
  constitution: 'Constitutional',
  statutory_instrument: 'Statutory Instrument',
  bill: 'Bill',
  case_law: 'Case Law',
  regulation: 'Regulation',
  gazette: 'Gazette',
}

export default function DocumentDetailPage() {
  const params = useParams()
  const documentId = params.id as string
  
  const [document, setDocument] = useState<Document | null>(null)
  const [chunks, setChunks] = useState<DocumentChunk[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)

  useEffect(() => {
    const fetchDocument = async () => {
      setLoading(true)
      try {
        const data = await api.documents.get(documentId)
        setDocument(data)
        setChunks(data.chunks || [])
      } catch (error) {
        console.error('Failed to fetch document:', error)
      } finally {
        setLoading(false)
      }
    }
    if (documentId) {
      fetchDocument()
    }
  }, [documentId])

  const groupedChunks = chunks.reduce<Record<string, DocumentChunk[]>>((acc, chunk) => {
    const partHeading = chunk.part_heading || 'General'
    if (!acc[partHeading]) {
      acc[partHeading] = []
    }
    acc[partHeading].push(chunk)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Loading..." breadcrumb={['Dashboard', 'Documents', '...']} />
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading document...</p>
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="space-y-6">
        <Header title="Document Not Found" breadcrumb={['Dashboard', 'Documents']} />
        <div className="flex flex-col items-center justify-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500">Document not found</p>
          <Link href="/dashboard/documents">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Documents
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Header 
        title={document.title}
        breadcrumb={['Dashboard', 'Documents', document.title]}
      />

      <div className="flex gap-6">
        <aside className="w-72 flex-shrink-0">
          <Card className="bg-white dark:bg-gray-900 sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sections</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-16rem)] overflow-y-auto">
              <nav className="space-y-1">
                {Object.entries(groupedChunks).map(([part, partChunks]) => (
                  <div key={part}>
                    <button
                      onClick={() => setSelectedSection(selectedSection === part ? null : part)}
                      className="w-full text-left px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    >
                      {part}
                    </button>
                    {selectedSection === part && (
                      <div className="ml-4 space-y-1">
                        {partChunks.map((chunk) => (
                          <button
                            key={chunk.id}
                            onClick={() => {
                              setSelectedSection(part)
                              globalThis.document
                                .getElementById?.(`chunk-${chunk.id}`)
                                ?.scrollIntoView({ behavior: 'smooth' })
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg truncate"
                          >
                            {chunk.section_number
                              ? `s ${chunk.section_number}`
                              : `Part ${chunk.chunk_index + 1}`}
                            {chunk.section_heading && ` - ${chunk.section_heading}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </CardContent>
          </Card>
        </aside>

        <div className="flex-1 space-y-6">
          <Card className="bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {document.title}
                    </h2>
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                        STATUS_COLORS[document.status] || STATUS_COLORS.draft
                      )}
                    >
                      {document.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>{DOC_TYPE_LABELS[document.doc_type] || document.doc_type}</span>
                    {document.year && <span>Year: {document.year}</span>}
                    {document.act_number && <span>Act No: {document.act_number}</span>}
                    {document.ministry && <span>Ministry: {document.ministry}</span>}
                  </div>
                </div>
                {document.file_path && (
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="text-base">Document Content</CardTitle>
            </CardHeader>
            <CardContent>
              {chunks.length === 0 ? (
                <p className="text-gray-500">No content available</p>
              ) : (
                <div className="space-y-6">
                  {chunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      id={`chunk-${chunk.id}`}
                      className={cn(
                        'p-4 rounded-lg border transition-colors',
                        selectedSection === chunk.part_heading
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 dark:border-gray-700'
                      )}
                    >
                      {chunk.section_number && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-primary">
                            Section {chunk.section_number}
                          </span>
                          {chunk.section_heading && (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          {chunk.section_heading && (
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {chunk.section_heading}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
