'use client'

import { useState, useRef } from 'react'
import { api } from '@/lib/api'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Upload, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react'

const DOC_TYPES = [
  { value: 'act', label: 'Act' },
  { value: 'statutory_instrument', label: 'Statutory Instrument' },
  { value: 'constitution', label: 'Constitution' },
  { value: 'bill', label: 'Bill' },
  { value: 'case_law', label: 'Case Law' },
  { value: 'regulation', label: 'Regulation' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'amended', label: 'Amended' },
]

interface IngestionJob {
  id: string
  document_title: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  chunks_created: number
  error_message?: string
  created_at: string
}

export default function IngestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [metadata, setMetadata] = useState({
    title: '',
    doc_type: 'act',
    year: new Date().getFullYear(),
    ministry: '',
    act_number: '',
    status: 'active',
  })
  const [jobs, setJobs] = useState<IngestionJob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      if (!metadata.title) {
        setMetadata((prev) => ({
          ...prev,
          title: selectedFile.name.replace(/\.[^/.]+$/, ''),
        }))
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile && (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.docx'))) {
      setFile(droppedFile)
      if (!metadata.title) {
        setMetadata((prev) => ({
          ...prev,
          title: droppedFile.name.replace(/\.[^/.]+$/, ''),
        }))
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleIngest = async () => {
    if (!file || !metadata.title) return

    setUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', metadata.title)
      formData.append('doc_type', metadata.doc_type)
      formData.append('year', String(metadata.year))
      formData.append('ministry', metadata.ministry)
      formData.append('act_number', metadata.act_number)
      formData.append('status', metadata.status)

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90))
      }, 500)

      await api.documents.ingest(formData)

      clearInterval(progressInterval)
      setUploadProgress(100)

      setTimeout(() => {
        setUploading(false)
        setUploadProgress(0)
        setFile(null)
        setMetadata({
          title: '',
          doc_type: 'act',
          year: new Date().getFullYear(),
          ministry: '',
          act_number: '',
          status: 'active',
        })
      }, 1000)
    } catch (error) {
      console.error('Failed to ingest:', error)
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const getStatusIcon = (status: IngestionJob['status']) => {
    switch (status) {
      case 'done':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'processing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />
      default:
        return <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
    }
  }

  return (
    <div className="space-y-6">
      <Header title="Document Ingestion" breadcrumb={['Dashboard', 'Admin', 'Ingest']} />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                file
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-300 dark:border-gray-600 hover:border-primary'
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    Drag and drop your file here, or click to browse
                  </p>
                  <p className="text-sm text-gray-400">
                    Supports PDF and DOCX files
                  </p>
                </>
              )}
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Uploading...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Document Title</Label>
                <Input
                  id="title"
                  value={metadata.title}
                  onChange={(e) =>
                    setMetadata((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Employment Act, 1980"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select
                    value={metadata.doc_type}
                    onValueChange={(value) =>
                      setMetadata((prev) => ({ ...prev, doc_type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    value={metadata.year}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        year: parseInt(e.target.value) || new Date().getFullYear(),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="act_number">Act Number</Label>
                  <Input
                    id="act_number"
                    value={metadata.act_number}
                    onChange={(e) =>
                      setMetadata((prev) => ({ ...prev, act_number: e.target.value }))
                    }
                    placeholder="Act No. 5 of 1980"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={metadata.status}
                    onValueChange={(value) =>
                      setMetadata((prev) => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ministry">Ministry</Label>
                <Input
                  id="ministry"
                  value={metadata.ministry}
                  onChange={(e) =>
                    setMetadata((prev) => ({ ...prev, ministry: e.target.value }))
                  }
                  placeholder="Ministry of Labour"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleIngest}
                disabled={!file || !metadata.title || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Start Ingestion
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle>Ingestion Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No ingestion jobs yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {job.document_title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {job.chunks_created} chunks created
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 capitalize">
                      {job.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
