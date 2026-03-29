'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { api, Session } from '@/lib/api'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { History, MessageSquare, ChevronRight } from 'lucide-react'

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await api.chat.sessions()
        setSessions(data.sessions)
      } catch (error) {
        console.error('Failed to fetch sessions:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  return (
    <div className="space-y-6">
      <Header title="Research History" breadcrumb={['Dashboard', 'History']} />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading history...</p>
        </div>
      ) : sessions.length === 0 ? (
        <Card className="bg-white dark:bg-gray-900">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Research History
            </h3>
            <p className="text-gray-500 text-center max-w-md">
              Your research sessions will appear here once you start asking questions
              about Eswatini law.
            </p>
            <Link
              href="/dashboard/research"
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Start Research
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/dashboard/history/${session.id}`}
              className="block"
            >
              <Card className="bg-white dark:bg-gray-900 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <MessageSquare className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {session.session_title || 'Untitled Session'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {formatDate(session.created_at)}
                          {session.model_used && ` • ${session.model_used}`}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
