import { httpClient } from './http-client'
import { ApiError } from './errors'

export interface Document {
  id: string
  title: string
  doc_type: 'act' | 'statutory_instrument' | 'constitution' | 'bill' | 'case_law' | 'regulation' | 'gazette'
  act_number?: string
  year?: number
  chapter?: string
  ministry?: string
  status: 'active' | 'repealed' | 'amended' | 'draft'
  commencement_date?: string
  source_url?: string
  file_path?: string
  metadata?: Record<string, unknown>
  chunks_count?: number
  created_at: string
  updated_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  chunk_index: number
  content: string
  section_heading?: string
  section_number?: string
  part_heading?: string
  chapter_heading?: string
  token_count?: number
  metadata?: Record<string, unknown>
}

export interface DocumentFilters {
  doc_type?: string
  year_min?: number
  year_max?: number
  ministry?: string
  status?: string
  q?: string
}

export interface DocumentListResponse {
  documents: Document[]
  total: number
  page: number
  page_size: number
}

export interface DocumentDetailResponse extends Document {
  chunks: DocumentChunk[]
}

export interface CorpusStats {
  acts_indexed: number
  statutory_instruments: number
  constitutional_sections: number
  last_updated: string
}

export interface DocumentListResponseWithStats extends DocumentListResponse {
  stats?: CorpusStats
}

class DocumentService {
  private readonly baseEndpoint = '/api/v1/documents'

  async list(
    filters?: DocumentFilters,
    page = 1,
    pageSize = 25
  ): Promise<DocumentListResponseWithStats> {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('page_size', String(pageSize))

    if (filters?.doc_type) params.set('doc_type', filters.doc_type)
    if (filters?.year_min) params.set('year_min', String(filters.year_min))
    if (filters?.year_max) params.set('year_max', String(filters.year_max))
    if (filters?.ministry) params.set('ministry', filters.ministry)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.q) params.set('q', filters.q)

    return httpClient.get<DocumentListResponseWithStats>(
      `${this.baseEndpoint}?${params.toString()}`
    )
  }

  async getStats(): Promise<CorpusStats> {
    const response = await this.list()
    if (response.stats) {
      return response.stats
    }
    return {
      acts_indexed: response.documents.filter(d => d.doc_type === 'act').length,
      statutory_instruments: response.documents.filter(d => d.doc_type === 'statutory_instrument').length,
      constitutional_sections: response.documents.filter(d => d.doc_type === 'constitution').length,
      last_updated: new Date().toISOString(),
    }
  }

  async getById(id: string): Promise<DocumentDetailResponse> {
    try {
      return await httpClient.get<DocumentDetailResponse>(`${this.baseEndpoint}/${id}`)
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound()) {
        throw new ApiError('Document not found', 404, {
          detail: 'The requested document could not be found.',
        })
      }
      throw error
    }
  }

  async getChunks(documentId: string): Promise<DocumentChunk[]> {
    const doc = await this.getById(documentId)
    return doc.chunks || []
  }

  async getSection(
    documentId: string,
    sectionNumber: string
  ): Promise<DocumentChunk | undefined> {
    const chunks = await this.getChunks(documentId)
    return chunks.find(
      (chunk) => chunk.section_number === sectionNumber
    )
  }

  async getDistinctMinistries(): Promise<string[]> {
    const response = await this.list()
    const ministries = response.documents
      .map((doc) => doc.ministry)
      .filter((m): m is string => !!m)
    return [...new Set(ministries)]
  }

  async search(query: string, filters?: DocumentFilters): Promise<Document[]> {
    const response = await this.list({ ...filters, q: query })
    return response.documents
  }

  async ingest(
    file: File,
    metadata: {
      title: string
      doc_type: string
      year?: number
      ministry?: string
      act_number?: string
      status?: string
    }
  ): Promise<{ job_id: string }> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', metadata.title)
    formData.append('doc_type', metadata.doc_type)
    if (metadata.year) formData.append('year', String(metadata.year))
    if (metadata.ministry) formData.append('ministry', metadata.ministry)
    if (metadata.act_number) formData.append('act_number', metadata.act_number)
    if (metadata.status) formData.append('status', metadata.status)

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${this.baseEndpoint}/ingest`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('elri_auth_token')}`,
        },
        body: formData,
      }
    )

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw ApiError.fromResponse(response, body)
    }

    return response.json()
  }
}

export const documentService = new DocumentService()
export default DocumentService
