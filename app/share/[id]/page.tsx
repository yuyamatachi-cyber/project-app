'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SharePortfolioPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('projects')
        .select('*, category:categories(*), themes(*, tasks(*), blockers(*), decision_logs(*))')
        .order('created_at')
      setProjects(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500">Loading...</div>

  const taskProgress = (p: any) => {
    const tasks = p.themes?.flatMap((t: any) => t.tasks || []) || []
    if (tasks.length === 0) return 0
    return Math.round(tasks.filter((t: any) => t.status === 'done').length / tasks.length * 100)
  }

  const openIssues = (p: any) =>
    p.themes?.reduce((sum: number, t: any) =>
      sum + (t.blockers?.filter((b: any) => b.status === 'open').length || 0) +
      (t.decision_logs?.filter((d: any) => d.status === 'open').length || 0), 0) || 0

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
          <div className="text-xs text-slate-400 mb-1">プロジェクト · Portfolio</div>
          <h1 className="text-2xl font-bold text-slate-900">Project一覧</h1>
          <div className="text-xs text-slate-400 mt-1">閲覧専用 · 常に最新の状態を表示</div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '進行中PJ', value: projects.filter(p => p.themes?.some((t: any) => t.status === 'in_progress')).length },
            { label: '要注意', value: projects.filter(p => p.health === 'red').length },
            { label: '意思決定待ち', value: projects.filter(p => openIssues(p) > 0).length },
            { label: '平均進捗率', value: `${projects.length === 0 ? 0 : Math.round(projects.reduce((s, p) => s + taskProgress(p), 0) / projects.length)}%` },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="text-xs text-slate-400 mb-1">{k.label}</div>
              <div className="text-2xl font-bold text-slate-900">{k.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Project名</th>
                <th className="text-left px-4 py-3">カテゴリー</th>
                <th className="text-center px-4 py-3">Health</th>
                <th className="text-center px-4 py-3">進捗</th>
                <th className="text-center px-4 py-3">Risk</th>
                <th className="text-center px-4 py-3">Decision</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} className="border-b border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500">{p.category?.name || '—'}</td>
                  <td className="px-4 py-3 text-center text-lg">{p.health === 'red' ? '🔴' : p.health === 'yellow' ? '🟡' : '🟢'}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{taskProgress(p)}%</td>
                  <td className="px-4 py-3 text-center text-lg">{p.risk === 'red' ? '🔴' : p.risk === 'yellow' ? '🟡' : '🟢'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${openIssues(p) > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                      {openIssues(p) > 0 ? `open ${openIssues(p)}件` : 'clear'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-center text-xs text-slate-400">このページは閲覧専用です。編集はできません。</div>
      </div>
    </div>
  )
}