'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const statusLabel = (s: string) =>
  s === 'not_started' ? '未着手' : s === 'in_progress' ? '進行中' : '完了'

export default function ShareProjectPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('projects')
        .select('*, category:categories(*), themes(*, tasks(*), blockers(*), decision_logs(*), progress_logs(*), milestones(*), theme_members(*, member:members(*)))')
        .eq('id', id)
        .single()
      setProject(data)
      setLoading(false)
    }
    fetch()
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500">Loading...</div>
  if (!project) return <div className="flex items-center justify-center h-screen text-slate-500">Projectが見つかりません</div>

  const themes = project.themes || []

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
          <div className="text-xs text-slate-400 mb-1">プロジェクト · Project · 閲覧専用</div>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          {project.category && <div className="text-sm text-slate-500 mt-1">{project.category.name}</div>}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { key: 'why', label: 'WHY' },
            { key: 'what', label: 'WHAT' },
            { key: 'how', label: 'HOW' },
            { key: 'so_what', label: 'SO WHAT' },
          ].map(f => (
            <div key={f.key} className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="text-xs font-bold text-blue-500 mb-2">{f.label}</div>
              <div className="text-sm text-slate-700">{project[f.key] || <span className="text-slate-400 italic">未入力</span>}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {themes.map((theme: any) => {
            const tasks = theme.tasks || []
            const done = tasks.filter((t: any) => t.status === 'done').length
            const progress = tasks.length === 0 ? 0 : Math.round(done / tasks.length * 100)
            const openIssues =
              (theme.blockers?.filter((b: any) => b.status === 'open').length || 0) +
              (theme.decision_logs?.filter((d: any) => d.status === 'open').length || 0)
            const latestLog = [...(theme.progress_logs || [])].sort((a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

            return (
              <div key={theme.id} className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{theme.name}</h2>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${theme.status === 'done' ? 'bg-green-100 text-green-700' : theme.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                      {statusLabel(theme.status)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-900">{progress}%</div>
                    <div className="text-xs text-slate-400">タスク消化率</div>
                  </div>
                </div>

                {latestLog && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mb-3">
                    <div className="text-xs text-slate-400 mb-1">最新進捗 · {new Date(latestLog.created_at).toLocaleDateString('ja-JP')}</div>
                    <div className="text-sm font-medium text-slate-700">{statusLabel(latestLog.status)} · {latestLog.progress_rate}%</div>
                    {latestLog.comment && <div className="text-sm text-slate-500 mt-1">{latestLog.comment}</div>}
                  </div>
                )}

                {openIssues > 0 && (
                  <div className="bg-red-50 rounded-lg px-3 py-2 border border-red-100 text-xs text-red-600">
                    ⚠ 未解消のIssue {openIssues}件
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-6 text-center text-xs text-slate-400">このページは閲覧専用です。編集はできません。</div>
      </div>
    </div>
  )
}