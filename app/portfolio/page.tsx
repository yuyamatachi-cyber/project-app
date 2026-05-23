'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Project, Category } from '@/types'

export default function PortfolioPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectCategory, setNewProjectCategory] = useState('')
  const [addingProject, setAddingProject] = useState(false)
  const [editingProject, setEditingProject] = useState<string | null>(null)
  const [editProjectName, setEditProjectName] = useState('')
  const [editProjectCategory, setEditProjectCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: cats }, { data: projs }] = await Promise.all([
      supabase.from('categories').select('*').order('created_at'),
      supabase.from('projects').select('*, category:categories(*), themes(*, tasks(*), blockers(*), decision_logs(*), theme_members(*))').order('created_at'),
    ])
    setCategories(cats || [])
    setProjects(projs || [])
    // sync_statusesを取得してmapに変換
    const projectIds = (projs || []).map((p: any) => p.id)
    if (projectIds.length > 0) {
      const { data: syncs } = await supabase.from('sync_statuses').select('*').in('project_id', projectIds)
      const syncMap: Record<string, any> = {}
      for (const s of (syncs || [])) { 
        if (s.project_id) syncMap[s.project_id] = s 
      }
      setSyncStatuses(syncMap)
    } else {
      setSyncStatuses({})
    }
    setLoading(false)
  }

  const filtered = selectedCategory ? projects.filter(p => p.category_id === selectedCategory) : projects

  const inProgress = projects.filter(p => p.themes?.some((t: any) => t.status === 'in_progress')).length
  const atRisk = projects.filter(p => p.health === 'red').length
  const pendingDecision = projects.filter(p =>
    p.themes?.some((t: any) =>
      (t.blockers?.filter((b: any) => b.status === 'open').length || 0) +
      (t.decision_logs?.filter((d: any) => d.status === 'open').length || 0) > 0)
  ).length
  const avgProgress = projects.length === 0 ? 0 : Math.round(
    projects.reduce((sum, p) => {
      const tasks = p.themes?.flatMap((t: any) => t.tasks || []) || []
      const done = tasks.filter((t: any) => t.status === 'done').length
      return sum + (tasks.length === 0 ? 0 : Math.round(done / tasks.length * 100))
    }, 0) / projects.length
  )

  async function updateHealth(id: string, health: string) {
    await supabase.from('projects').update({ health }).eq('id', id)
    fetchAll()
  }

  async function addProject() {
    if (!newProjectName.trim()) return
    await supabase.from('projects').insert({ name: newProjectName, category_id: newProjectCategory || null })
    setNewProjectName('')
    setNewProjectCategory('')
    setAddingProject(false)
    fetchAll()
  }

  async function updateProject(id: string) {
    await supabase.from('projects').update({ name: editProjectName, category_id: editProjectCategory || null }).eq('id', id)
    setEditingProject(null)
    fetchAll()
  }

  async function deleteProject(id: string) {
    if (!confirm('このProjectを削除しますか？')) return
    await supabase.from('projects').delete().eq('id', id)
    fetchAll()
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return
    await supabase.from('categories').insert({ name: newCategoryName })
    setNewCategoryName('')
    fetchAll()
  }

  async function deleteCategory(id: string) {
    await supabase.from('categories').delete().eq('id', id)
    fetchAll()
  }

  async function renameCategory(id: string, name: string) {
    await supabase.from('categories').update({ name }).eq('id', id)
    fetchAll()
  }

  const projectStatus = (p: any) => {
    return p.status || 'not_started'
  }

  const statusLabel = (s: string) =>
    s === 'not_started' ? '未着手' : s === 'in_progress' ? '進行中' : '完了'

  const statusColor = (s: string) =>
    s === 'done' ? 'bg-green-100 text-green-700 border border-green-300' : s === 'in_progress' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-slate-100 text-slate-500 border border-slate-300'

  const [syncStatuses, setSyncStatuses] = useState<Record<string, any>>({})

  const syncAvg = (p: any): number | null => {
    const s = syncStatuses[p.id]
    if (!s) return null
    return Math.round(((s.purpose || 3) + (s.granularity || 3) + (s.state || 3) + (s.priority || 3) + (s.interpretation || 3)) / 5 * 10) / 10
  }

  const openIssues = (p: any) => {
    return p.themes?.reduce((sum: number, t: any) => {
      const ownerMemberId = t.theme_members?.find((tm: any) => tm.role === 'owner')?.member_id
      const blockerIssues = (t.blockers || []).filter((b: any) =>
        b.status === 'open' && (!b.resolved_by || b.resolved_by === ownerMemberId)
      ).length
      return sum + blockerIssues
    }, 0) || 0
  }

  const taskProgress = (p: Project) => {
    const tasks = p.themes?.flatMap((t: any) => t.tasks || []) || []
    if (tasks.length === 0) return 0
    return Math.round(tasks.filter((t: any) => t.status === 'done').length / tasks.length * 100)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500">Loading...</div>

  return (
    <div className="flex h-screen bg-slate-100 relative">
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40" />}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-50 w-56 h-full bg-[#1a1a1a] border-r border-[#333333] flex flex-col p-4 gap-2 transition-transform duration-200`}>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden absolute top-3 right-3 text-gray-400 hover:text-white">✕</button>
        <div className="text-xs font-bold text-[#FFE600] uppercase tracking-widest mb-2">プロジェクト</div>
        <button onClick={() => setSelectedCategory(null)} className={`text-left px-3 py-2 rounded text-sm ${!selectedCategory ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>すべて</button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`text-left px-3 py-2 rounded text-sm ${selectedCategory === cat.id ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>{cat.name}</button>
        ))}
        <button onClick={() => setEditingCategory(!editingCategory)} className="mt-2 text-xs text-slate-400 hover:text-slate-600 text-left px-3 py-1">⚙ カテゴリー編集</button>
        {editingCategory && (
          <div className="mt-2 flex flex-col gap-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex gap-1">
                <input defaultValue={cat.name} onBlur={e => renameCategory(cat.id, e.target.value)} className="flex-1 bg-white text-slate-900 text-xs px-2 py-1 rounded" />
                <button onClick={() => deleteCategory(cat.id)} className="text-red-400 text-xs px-1">✕</button>
              </div>
            ))}
            <div className="flex gap-1">
              <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="新規カテゴリー" className="flex-1 bg-white text-slate-900 text-xs px-2 py-1 rounded" />
              <button onClick={addCategory} className="text-blue-600 text-xs px-2">＋</button>
            </div>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto p-4 lg:p-8 bg-slate-100">
        <button onClick={() => setSidebarOpen(true)} className="mb-4 p-2 bg-[#1a1a1a] text-[#FFE600] rounded-lg text-xs font-bold lg:hidden">☰ メニュー</button>
        <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-bold text-slate-900">Project Portfolio</h1><button onClick={() => { navigator.clipboard.writeText(window.location.origin + "/share/portfolio"); alert("共有URLをコピーしました"); }} className="bg-white hover:bg-slate-50 text-slate-600 text-xs px-4 py-2 rounded-lg border border-slate-200">🔗 共有</button></div>
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-white rounded-xl px-5 py-3 border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500">プロジェクト総数　</span>
            <span className="text-xl font-bold text-slate-900">{projects.length}PJ</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            {
              label: '要注意',
              emoji: '🔴',
              pj: projects.filter(p => p.health === 'red').length,
              issues: projects.filter((p: any) => p.health === 'red').reduce((sum, p) => sum + (openIssues(p) as number), 0),
              sync: (() => { const ps = projects.filter(p => p.health === 'red'); return ps.length === 0 ? null : Math.round(ps.reduce((s, p) => s + (syncAvg(p) ?? 3), 0) / ps.length * 10) / 10 })(),
              border: 'border-red-200', bg: 'bg-red-50', labelColor: 'text-red-600'
            },
            {
              label: '注意',
              emoji: '🟡',
              pj: projects.filter(p => p.health === 'yellow').length,
              issues: projects.filter((p: any) => p.health === 'yellow').reduce((sum, p) => sum + (openIssues(p) as number), 0),
              sync: (() => { const ps = projects.filter(p => p.health === 'yellow'); return ps.length === 0 ? null : Math.round(ps.reduce((s, p) => s + (syncAvg(p) ?? 3), 0) / ps.length * 10) / 10 })(),
              border: 'border-yellow-200', bg: 'bg-yellow-50', labelColor: 'text-yellow-600'
            },
            {
              label: '良好',
              emoji: '🟢',
              pj: projects.filter(p => p.health === 'green').length,
              issues: projects.filter((p: any) => p.health === 'green').reduce((sum, p) => sum + (openIssues(p) as number), 0),
              sync: (() => { const ps = projects.filter(p => p.health === 'green'); return ps.length === 0 ? null : Math.round(ps.reduce((s, p) => s + (syncAvg(p) ?? 3), 0) / ps.length * 10) / 10 })(),
              border: 'border-green-200', bg: 'bg-green-50', labelColor: 'text-green-600'
            },
          ].map(k => (
            <div key={k.label} className={`${k.bg} rounded-xl p-5 border ${k.border}`}>
              <div className={`text-sm font-bold ${k.labelColor} mb-3`}>{k.emoji} {k.label}</div>
              <div className="flex flex-col gap-1">
                <div className="text-xs text-slate-500">Health {k.emoji} <span className="text-slate-900 font-bold">{k.pj === 0 ? '—' : `${k.pj}PJ`}</span></div>
                <div className="text-xs text-slate-500">意思決定待ち <span className="text-slate-900 font-bold">{k.issues === 0 ? '—' : `${k.issues}件`}</span></div>
                <div className="text-xs text-slate-500">SYNC平均 <span className="text-slate-900 font-bold">{k.sync === null ? '—' : `${Math.round((k.sync as number) / 5 * 100)}%`}</span></div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Project名</th>
                <th className="text-left px-4 py-3">カテゴリー</th>
                <th className="text-center px-4 py-3">Health</th>
                <th className="text-center px-4 py-3">ステータス</th>
                <th className="text-center px-4 py-3">SYNC</th>
                <th className="text-center px-4 py-3">Issues</th>
                <th className="text-center px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3"><a href={`/projects/${p.id}`} className="text-blue-600 hover:underline font-medium">{p.name}</a></td>
                  <td className="px-4 py-3 text-slate-600">{p.category?.name || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <select value={p.health} onChange={e => updateHealth(p.id, e.target.value)} className="bg-transparent text-lg cursor-pointer">
                      <option value="green">🟢</option>
                      <option value="yellow">🟡</option>
                      <option value="red">🔴</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(projectStatus(p))}`}>
                      {statusLabel(projectStatus(p))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${syncAvg(p) === null ? 'text-slate-400' : (syncAvg(p) as number) >= 4 ? 'text-green-600' : (syncAvg(p) as number) <= 2 ? 'text-red-500' : 'text-blue-600'}`}>
                      {syncAvg(p) === null ? '—' : `${Math.round((syncAvg(p) as number) / 5 * 100)}%`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${openIssues(p) > 0 ? 'bg-red-500 text-white' : 'text-slate-300'}`}>
                      {openIssues(p) > 0 ? `${openIssues(p)}件` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingProject === p.id ? (
                      <div className="flex gap-1 justify-center flex-wrap">
                        <input value={editProjectName} onChange={e => setEditProjectName(e.target.value)} className="bg-white text-slate-900 text-xs px-2 py-1 rounded w-24" />
                        <select value={editProjectCategory} onChange={e => setEditProjectCategory(e.target.value)} className="bg-white text-slate-900 text-xs px-1 py-1 rounded">
                          <option value="">未選択</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button onClick={() => updateProject(p.id)} className="text-xs text-blue-600 hover:text-blue-700">保存</button>
                        <button onClick={() => setEditingProject(null)} className="text-xs text-slate-400">✕</button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => { setEditingProject(p.id); setEditProjectName(p.name); setEditProjectCategory(p.category_id || '') }} className="text-xs text-blue-600 hover:text-blue-700">編集</button>
                        <button onClick={() => deleteProject(p.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {addingProject ? (
                <tr className="border-b border-slate-200 bg-slate-50">
                  <td className="px-4 py-3">
                    <input autoFocus value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addProject()} placeholder="Project名" className="bg-white border border-slate-300 text-slate-900 px-2 py-1 rounded text-sm w-full" />
                  </td>
                  <td className="px-4 py-3">
                    <select value={newProjectCategory} onChange={e => setNewProjectCategory(e.target.value)} className="bg-white border border-slate-300 text-slate-900 px-2 py-1 rounded text-sm">
                      <option value="">カテゴリー選択</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td colSpan={5} className="px-4 py-3">
                    <button onClick={addProject} className="bg-blue-600 text-white px-3 py-1 rounded text-xs mr-2">追加</button>
                    <button onClick={() => setAddingProject(false)} className="text-slate-500 text-xs">キャンセル</button>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-3">
                    <button onClick={() => setAddingProject(true)} className="text-blue-600 text-sm hover:text-blue-700">＋ Project追加</button>
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