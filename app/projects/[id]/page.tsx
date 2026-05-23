'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Project, Theme, Category } from '@/types'

const statusLabel = (s: string) =>
  s === 'not_started' ? '未着手' : s === 'in_progress' ? '進行中' : '完了'

const statusColor = (s: string) =>
  s === 'done' ? 'bg-green-900 text-green-300' : s === 'in_progress' ? 'bg-blue-900 text-blue-300' : 'bg-[#333333] text-gray-400'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [themes, setThemes] = useState<Theme[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [syncComments, setSyncComments] = useState<Record<string, string>>({})
  const [syncSaved, setSyncSaved] = useState(false)
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
    if (syncData) {
      setSyncComments({
        purpose: syncData.purpose_comment || '',
        granularity: syncData.granularity_comment || '',
        state: syncData.state_comment || '',
        priority: syncData.priority_comment || '',
        interpretation: syncData.interpretation_comment || '',
      })
    }
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

  async function saveSyncStatus() {
    const saveData = {
      purpose: syncStatus?.purpose ?? 3,
      granularity: syncStatus?.granularity ?? 3,
      state: syncStatus?.state ?? 3,
      priority: syncStatus?.priority ?? 3,
      interpretation: syncStatus?.interpretation ?? 3,
      purpose_comment: syncComments['purpose'] || '',
      granularity_comment: syncComments['granularity'] || '',
      state_comment: syncComments['state'] || '',
      priority_comment: syncComments['priority'] || '',
      interpretation_comment: syncComments['interpretation'] || '',
    }
    if (syncStatus?.id) {
      await supabase.from('sync_statuses').update(saveData).eq('id', syncStatus.id)
    } else {
      const { data } = await supabase.from('sync_statuses').insert({ project_id: id, ...saveData }).select().single()
      if (data) setSyncStatus(data)
    }
    setSyncSaved(true)
    setTimeout(() => setSyncSaved(false), 2000)
  }

  function updateProjectSyncStatus(field: string, value: number) {
    setSyncStatus((prev: any) => ({ ...(prev || {}), [field]: value }))
  }

  const issueCount = (t: Theme) =>
    (t.blockers?.filter((b: any) => b.status === 'open').length || 0) +
    (t.decision_logs?.filter((d: any) => d.status === 'open').length || 0)

  const taskProgress = (t: Theme) => {
    const tasks = t.tasks || []
    if (tasks.length === 0) return 0
    return Math.round((tasks as any[]).filter(t => t.status === 'done').length / tasks.length * 100)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
  if (!project) return <div className="flex items-center justify-center h-screen text-gray-400">Project not found</div>

  const contextFields = [
    { key: 'why', label: 'WHY', placeholder: 'なぜやるか' },
    { key: 'what', label: 'WHAT', placeholder: '何をやるか' },
    { key: 'how', label: 'HOW', placeholder: 'どうやるか' },
    { key: 'so_what', label: 'SO WHAT', placeholder: '何が変わるか' },
  ]

  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      <aside className="w-56 bg-[#242424] border-r border-[#3a3a3a] flex flex-col p-4 gap-2">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">プロジェクト</div>
        <a href="/portfolio" className="text-gray-300 hover:bg-[#333333] px-3 py-2 rounded text-sm">← Portfolio</a>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs text-gray-400 mb-1">{project.category?.name || '—'}</div>
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(window.location.origin + '/share/project/' + id); alert('共有URLをコピーしました'); }} className="bg-[#333333] hover:bg-[#3a3a3a] text-gray-300 text-xs px-4 py-2 rounded-lg border border-[#3a3a3a]">🔗 共有
          </button>
        </div>

        {/* 文脈パネル */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {contextFields.map(f => (
            <div key={f.key} className="bg-[#242424] rounded-xl p-4 border border-[#3a3a3a]">
              <div className="text-xs font-bold text-[#FFE600] mb-2">{f.label}</div>
              {editingField === f.key ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    value={fieldValue}
                    onChange={e => setFieldValue(e.target.value)}
                    className="bg-[#333333] text-white text-sm px-3 py-2 rounded resize-none w-full"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveField(f.key, fieldValue)} className="bg-[#FFE600] text-black text-xs px-3 py-1 rounded">保存</button>
                    <button onClick={() => setEditingField(null)} className="text-gray-400 text-xs">キャンセル</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => { setEditingField(f.key); setFieldValue((project as any)[f.key] || '') }}
                  className="text-gray-300 text-sm cursor-pointer hover:text-white min-h-[60px]"
                >
                  {(project as any)[f.key] || <span className="text-gray-500 italic">{f.placeholder}（クリックして編集）</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* SYNC STATUS */}
        <div className="bg-[#242424] rounded-xl p-5 border border-[#3a3a3a] mb-8">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">SYNC STATUS</h2>
          <div className="grid grid-cols-5 gap-4">
            {[
              { key: 'purpose', label: '目的同期' },
              { key: 'granularity', label: '粒度同期' },
              { key: 'state', label: '状態同期' },
              { key: 'priority', label: '優先度同期' },
              { key: 'interpretation', label: '解釈同期' },
            ].map(axis => {
              const val = syncStatus?.[axis.key] ?? 3
              const colorMap: Record<number, string> = {
                1: 'bg-red-500 text-white',
                2: 'bg-orange-400 text-white',
                3: 'bg-yellow-400 text-white',
                4: 'bg-lime-500 text-white',
                5: 'bg-green-500 text-white',
              }
              const labelMap: Record<number, string> = {
                1: '低', 2: '', 3: '中', 4: '', 5: '高'
              }
              return (
                <div key={axis.key} className="flex flex-col items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium">{axis.label}</span>
                  <div className="flex flex-col gap-1 w-full">
                    {[5, 4, 3, 2, 1].map(v => (
                      <button
                        key={v}
                        onClick={() => updateProjectSyncStatus(axis.key, v)}
                        className={`w-full py-1.5 rounded text-xs font-bold transition-all ${v === val ? colorMap[v] + ' shadow-md scale-105' : 'bg-[#333333] text-gray-400 hover:bg-[#3a3a3a]'}`}
                      >
                        {v}{labelMap[v] ? ` ${labelMap[v]}` : ''}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={syncComments[axis.key] || ''}
                    onChange={e => setSyncComments(prev => ({ ...prev, [axis.key]: e.target.value }))}
                    placeholder="コメント（50文字）"
                    maxLength={50}
                    rows={2}
                    className="w-full text-xs bg-[#1a1a1a] border border-[#3a3a3a] rounded px-2 py-1 resize-none text-gray-300 mt-1"
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={saveSyncStatus} className={`text-xs px-4 py-2 rounded-lg font-medium transition-colors ${syncSaved ? 'bg-green-500 text-white' : 'bg-[#FFE600] text-black hover:bg-[#f0d800]'}`}>
              {syncSaved ? '✓ 保存しました' : '保存'}
            </button>
          </div>
        </div>

        {/* Theme一覧 */}
        <div className="bg-[#242424] rounded-xl border border-[#3a3a3a] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#3a3a3a]">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Themes</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#3a3a3a] text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Theme名</th>
                <th className="text-center px-4 py-3">ステータス</th>
                <th className="text-center px-4 py-3">進捗率</th>
                <th className="text-center px-4 py-3">Issues</th>
                <th className="text-center px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {themes.map(t => (
                <tr key={t.id} className="border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors">
                  <td className="px-4 py-3">
                    <a href={`/themes/${t.id}`} className="text-[#FFE600] hover:underline font-medium">{t.name}</a>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(t.status)}`}>
                      {statusLabel(t.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">{taskProgress(t)}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${issueCount(t) > 0 ? 'bg-red-900 text-red-300' : 'bg-[#333333] text-gray-400'}`}>
                      {issueCount(t) > 0 ? `${issueCount(t)}件` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => { const name = prompt('Theme名を変更', t.name); if (name) updateThemeName(t.id, name) }} className="text-xs text-[#FFE600] hover:text-[#f0d800]">編集</button>
                      <button onClick={() => deleteTheme(t.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {addingTheme ? (
                <tr className="border-b border-[#3a3a3a] bg-[#333333]">
                  <td className="px-4 py-3" colSpan={4}>
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={newThemeName}
                        onChange={e => setNewThemeName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addTheme()}
                        placeholder="Theme名"
                        className="bg-[#3a3a3a] text-white px-2 py-1 rounded text-sm flex-1"
                      />
                      <button onClick={addTheme} className="bg-[#FFE600] text-black px-3 py-1 rounded text-xs">追加</button>
                      <button onClick={() => setAddingTheme(false)} className="text-gray-400 text-xs">キャンセル</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-3">
                    <button onClick={() => setAddingTheme(true)} className="text-[#FFE600] text-sm hover:text-[#f0d800]">＋ Theme追加</button>
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