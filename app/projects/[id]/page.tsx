'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Project, Theme, Category } from '@/types'

const statusLabel = (s: string) =>
  s === 'not_started' ? '未着手' : s === 'in_progress' ? '進行中' : '完了'

const statusColor = (s: string) =>
  s === 'done' ? 'bg-green-900 text-green-300' : s === 'in_progress' ? 'bg-blue-900 text-blue-300' : 'bg-slate-100 text-slate-500'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [themes, setThemes] = useState<Theme[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [fieldValue, setFieldValue] = useState('')
  const [newThemeName, setNewThemeName] = useState('')
  const [addingTheme, setAddingTheme] = useState(false)

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    const [{ data: proj }, { data: thms }, { data: cats }] = await Promise.all([
      supabase.from('projects').select('*, category:categories(*)').eq('id', id).single(),
      supabase.from('themes').select('*, tasks(*), blockers(*), decision_logs(*)').eq('project_id', id).order('created_at'),
      supabase.from('categories').select('*').order('created_at'),
    ])
    setProject(proj)
    setThemes(thms || [])
    setCategories(cats || [])
    const { data: syncData } = await supabase.from('sync_statuses').select('*').eq('project_id', id).limit(1).then(r => ({ data: r.data?.[0] || null }))
    setSyncStatus(syncData)
    setLoading(false)
  }

  async function saveField(field: string, value: string) {
    await supabase.from('projects').update({ [field]: value }).eq('id', id)
    setEditingField(null)
    fetchAll()
  }

  async function deleteTheme(themeId: string) {
    if (!confirm('このThemeを削除しますか？')) return
    await supabase.from('themes').delete().eq('id', themeId)
    fetchAll()
  }

  async function updateThemeName(themeId: string, name: string) {
    await supabase.from('themes').update({ name }).eq('id', themeId)
    fetchAll()
  }

  async function addTheme() {
    if (!newThemeName.trim()) return
    await supabase.from('themes').insert({ project_id: id, name: newThemeName })
    setNewThemeName('')
    setAddingTheme(false)
    fetchAll()
  }

  async function createSnapshot() {
    const { data: fullProject } = await supabase
      .from('projects')
      .select('*, category:categories(*), themes(*, tasks(*), blockers(*), decision_logs(*), progress_logs(*), milestones(*), theme_members(*, member:members(*)))')
      .eq('id', id)
      .single()
    const { data: snap } = await supabase
      .from('snapshots')
      .insert({ project_id: id, data: fullProject })
      .select()
      .single()
    if (snap) {
      const url = `${window.location.origin}/share/${snap.id}`
      await navigator.clipboard.writeText(url)
      alert(`スナップショットURLをコピーしました:\n${url}`)
    }
  }

  async function updateProjectSyncStatus(field: string, value: number) {
    setSyncStatus((prev: any) => ({ ...(prev || {}), [field]: value }))
    if (syncStatus?.id) {
      await supabase.from('sync_statuses').update({ [field]: value }).eq('id', syncStatus.id)
    } else {
      const { data } = await supabase.from('sync_statuses').insert({ project_id: id, purpose: 3, granularity: 3, state: 3, priority: 3, interpretation: 3, [field]: value }).select().single()
      if (data) setSyncStatus(data)
    }
  }

  const issueCount = (t: Theme) =>
    (t.blockers?.filter((b: any) => b.status === 'open').length || 0) +
    (t.decision_logs?.filter((d: any) => d.status === 'open').length || 0)

  const taskProgress = (t: Theme) => {
    const tasks = t.tasks || []
    if (tasks.length === 0) return 0
    return Math.round((tasks as any[]).filter(t => t.status === 'done').length / tasks.length * 100)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500">Loading...</div>
  if (!project) return <div className="flex items-center justify-center h-screen text-slate-500">Project not found</div>

  const contextFields = [
    { key: 'why', label: 'WHY', placeholder: 'なぜやるか' },
    { key: 'what', label: 'WHAT', placeholder: '何をやるか' },
    { key: 'how', label: 'HOW', placeholder: 'どうやるか' },
    { key: 'so_what', label: 'SO WHAT', placeholder: '何が変わるか' },
  ]

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col p-4 gap-2">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">プロジェクト</div>
        <a href="/portfolio" className="text-slate-600 hover:bg-slate-100 px-3 py-2 rounded text-sm">← Portfolio</a>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">{project.category?.name || '—'}</div>
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(window.location.origin + '/share/project/' + id); alert('共有URLをコピーしました'); }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs px-4 py-2 rounded-lg border border-slate-200">🔗 共有
          </button>
        </div>

        {/* 文脈パネル */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {contextFields.map(f => (
            <div key={f.key} className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="text-xs font-bold text-blue-400 mb-2">{f.label}</div>
              {editingField === f.key ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    value={fieldValue}
                    onChange={e => setFieldValue(e.target.value)}
                    className="bg-slate-100 text-slate-900 text-sm px-3 py-2 rounded resize-none w-full"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveField(f.key, fieldValue)} className="bg-blue-600 text-slate-900 text-xs px-3 py-1 rounded">保存</button>
                    <button onClick={() => setEditingField(null)} className="text-slate-500 text-xs">キャンセル</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => { setEditingField(f.key); setFieldValue((project as any)[f.key] || '') }}
                  className="text-slate-600 text-sm cursor-pointer hover:text-slate-900 min-h-[60px]"
                >
                  {(project as any)[f.key] || <span className="text-slate-400 italic">{f.placeholder}（クリックして編集）</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* SYNC STATUS */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 mb-8">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">SYNC STATUS</h2>
          <div className="flex flex-col gap-3">
            {[
              { key: 'purpose', label: '目的同期' },
              { key: 'granularity', label: '粒度同期' },
              { key: 'state', label: '状態同期' },
              { key: 'priority', label: '優先度同期' },
              { key: 'interpretation', label: '解釈同期' },
            ].map(axis => {
              const val = syncStatus?.[axis.key] ?? 3
              return (
                <div key={axis.key} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-20 shrink-0">{axis.label}</span>
                  <div className="flex gap-2 flex-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        key={v}
                        onClick={() => updateProjectSyncStatus(axis.key, v)}
                        className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${v === val ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-slate-500 w-6 text-right">{val}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Theme一覧 */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Themes</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Theme名</th>
                <th className="text-center px-4 py-3">ステータス</th>
                <th className="text-center px-4 py-3">進捗率</th>
                <th className="text-center px-4 py-3">Issues</th>
                <th className="text-center px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {themes.map(t => (
                <tr key={t.id} className="border-b border-slate-200 hover:bg-slate-100 transition-colors">
                  <td className="px-4 py-3">
                    <a href={`/themes/${t.id}`} className="text-blue-400 hover:underline font-medium">{t.name}</a>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(t.status)}`}>
                      {statusLabel(t.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{taskProgress(t)}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${issueCount(t) > 0 ? 'bg-red-900 text-red-300' : 'bg-slate-100 text-slate-500'}`}>
                      {issueCount(t) > 0 ? `${issueCount(t)}件` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => { const name = prompt('Theme名を変更', t.name); if (name) updateThemeName(t.id, name) }} className="text-xs text-blue-500 hover:text-blue-700">編集</button>
                      <button onClick={() => deleteTheme(t.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {addingTheme ? (
                <tr className="border-b border-slate-200 bg-slate-100">
                  <td className="px-4 py-3" colSpan={4}>
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={newThemeName}
                        onChange={e => setNewThemeName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addTheme()}
                        placeholder="Theme名"
                        className="bg-slate-200 text-slate-900 px-2 py-1 rounded text-sm flex-1"
                      />
                      <button onClick={addTheme} className="bg-blue-600 text-slate-900 px-3 py-1 rounded text-xs">追加</button>
                      <button onClick={() => setAddingTheme(false)} className="text-slate-500 text-xs">キャンセル</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-3">
                    <button onClick={() => setAddingTheme(true)} className="text-blue-400 text-sm hover:text-blue-300">＋ Theme追加</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}