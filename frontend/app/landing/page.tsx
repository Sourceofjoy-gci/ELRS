'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, CorpusStats } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Shield,
  Cpu,
  Scale,
  Search,
  Brain,
  FileCheck,
  Lock,
} from 'lucide-react'

const EXAMPLE_QUERIES = [
  'What does section 35 of the Employment Act say about termination?',
  'What are the constitutional rights to fair trial in Eswatini?',
  'Compare the Land Act and Deeds Registry Act on property transfer.',
]

const FEATURES = [
  {
    icon: Search,
    title: 'Hybrid Search',
    description:
      'Combines vector similarity and keyword search for precise legal document retrieval.',
  },
  {
    icon: Brain,
    title: 'Multi-Agent Reasoning',
    description:
      'Specialized AI agents collaborate to analyze constitutional, statutory, and case law.',
  },
  {
    icon: FileCheck,
    title: 'Verified Citations',
    description:
      'Every answer includes traceable citations to official Eswatini legislation.',
  },
  {
    icon: Lock,
    title: 'Air-Gapped Privacy',
    description:
      'All processing happens locally. No data ever leaves the server.',
  },
]

export default function LandingPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [currentQueryIndex, setCurrentQueryIndex] = useState(0)
  const [stats, setStats] = useState<CorpusStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.documents.list({ stats: true })
        setStats(data.stats || null)
      } catch {
        setStats(null)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQueryIndex((prev) => (prev + 1) % EXAMPLE_QUERIES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/login?redirect=/dashboard/research?query=${encodeURIComponent(query)}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-surface to-white dark:from-gray-900 dark:to-gray-950">
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Scale className="w-6 h-6 text-accent-gold" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-primary dark:text-white">
                ELRI
              </h1>
              <p className="text-xs text-gray-500">Eswatini Legal Research</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="container mx-auto max-w-4xl relative">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-gold/10 text-accent-gold text-sm font-medium">
              <Lock className="w-4 h-4" />
              100% Local AI Processing
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
              Legal Intelligence for the{' '}
              <span className="text-primary">Kingdom of Eswatini</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Query Acts of Parliament, the Constitution, and case law using natural
              language. Every query is processed entirely on local hardware — no data
              ever leaves the server.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder={EXAMPLE_QUERIES[currentQueryIndex]}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-14 pl-12 pr-32 text-lg rounded-xl shadow-lg border-2 focus:border-primary transition-colors"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-6"
                >
                  Search
                </Button>
              </div>
            </form>

            <div className="flex items-center justify-center gap-6 pt-4">
              <span className="text-sm text-gray-500">Try:</span>
              {EXAMPLE_QUERIES.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuery(q)}
                  className={cn(
                    'text-sm text-primary hover:underline',
                    idx === currentQueryIndex && 'font-medium'
                  )}
                >
                  {q.length > 40 ? q.slice(0, 40) + '...' : q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-white dark:bg-gray-900">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  🔒 100% Local AI
                </p>
                <p className="text-sm text-gray-500">No external API calls</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Cpu className="w-8 h-8 text-accent-gold" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  🐳 Docker-Native
                </p>
                <p className="text-sm text-gray-500">Single-command deployment</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Scale className="w-8 h-8 text-accent-crimson" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ⚖️ Eswatini Law Corpus
                </p>
                <p className="text-sm text-gray-500">Official legal documents</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {stats && (
        <section className="py-16 px-6 bg-primary-surface dark:bg-gray-800">
          <div className="container mx-auto max-w-6xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Card className="bg-white dark:bg-gray-900">
                <CardContent className="pt-6 text-center">
                  <p className="text-4xl font-bold text-primary">
                    {stats.acts_indexed}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Acts Indexed</p>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-900">
                <CardContent className="pt-6 text-center">
                  <p className="text-4xl font-bold text-primary">
                    {stats.statutory_instruments}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Statutory Instruments
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-900">
                <CardContent className="pt-6 text-center">
                  <p className="text-4xl font-bold text-primary">
                    {stats.constitutional_sections}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Constitutional Sections
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-900">
                <CardContent className="pt-6 text-center">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {stats.last_updated
                      ? new Date(stats.last_updated).toLocaleDateString()
                      : 'N/A'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Last Updated</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      <section className="py-24 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Platform Features
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Built on state-of-the-art AI technology, designed specifically for
              Eswatini legal research.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((feature, idx) => (
              <Card
                key={idx}
                className="bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow"
              >
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-primary text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Begin Your Research?</h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Siyinqaba — We are the fortress. Your legal research is protected by
            complete data sovereignty.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="bg-white text-primary hover:bg-gray-100"
            >
              Begin Research
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-8 px-6 border-t bg-white dark:bg-gray-900">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Scale className="w-5 h-5 text-primary" />
              <span className="font-semibold text-gray-900 dark:text-white">
                ELRI
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Built for the Kingdom of Eswatini. No data leaves the server.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
