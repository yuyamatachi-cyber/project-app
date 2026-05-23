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

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: cats }, { data: projs }] = await Promise.all([
      supabase.from('categories').select('*').order('created_at'),
      supabase.from('projects').select('*, category:categories(*), themes(*, tasks(*), blockers(*), decision_logs(*))').order('created_at'),
    ])
    setCategories(cats || [])
    setProjects(projs || [])
    if (projs && projs.length > 0) {
      const { data: syncs } = await supabase.from('sync_statuses').select('*').in('project_id', projs.map((p: any) => p.id))
      const syncMap: Record<string, any> = {}
      for (const s of syncs || []) { if (s.project_id) syncMap[s.project_id] = s }
      setSyncStatuses(syncMap)
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

  const projectStatus = (p: Project) => {
    const themes = p.themes || []
    if (themes.length === 0) return 'not_started'
    if (themes.some((t: any) => t.status === 'in_progress')) return 'in_progress'
    if (themes.every((t: any) => t.status === 'done')) return 'done'
    return 'not_started'
  }

  const statusLabel = (s: string) =>
    s === 'not_started' ? '未着手' : s === 'in_progress' ? '進行中' : '完了'

  const statusColor = (s: string) =>
    s === 'done' ? 'bg-green-500 text-white' : s === 'in_progress' ? 'bg-blue-500 text-white' : 'bg-[#333333] text-gray-400'

  const [syncStatuses, setSyncStatuses] = useState<Record<string, any>>({})

  const syncAvg = (p: any): number | null => {
    const s = syncStatuses[p.id]
    if (!s) return null
    return Math.round(((s.purpose || 3) + (s.granularity || 3) + (s.state || 3) + (s.priority || 3) + (s.interpretation || 3)) / 5 * 10) / 10
  }

  const openIssues = (p: Project) =>
    p.themes?.reduce((sum: number, t: any) =>
      sum + (t.blockers?.filter((b: any) => b.status === 'open').length || 0) +
      (t.decision_logs?.filter((d: any) => d.status === 'open').length || 0), 0) || 0

  const taskProgress = (p: Project) => {
    const tasks = p.themes?.flatMap((t: any) => t.tasks || []) || []
    if (tasks.length === 0) return 0
    return Math.round(tasks.filter((t: any) => t.status === 'done').length / tasks.length * 100)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>

  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      <aside className="w-56 bg-[#242424] border-r border-[#3a3a3a] flex flex-col p-4 gap-2">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">プロジェクト</div>
        <button onClick={() => setSelectedCategory(null)} className={`text-left px-3 py-2 rounded text-sm ${!selectedCategory ? 'bg-[#FFE600] text-black font-bold' : 'text-gray-300 hover:bg-[#333333]'}`}>すべて</button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`text-left px-3 py-2 rounded text-sm ${selectedCategory === cat.id ? 'bg-[#FFE600] text-black font-bold' : 'text-gray-300 hover:bg-[#333333]'}`}>{cat.name}</button>
        ))}
        <button onClick={() => setEditingCategory(!editingCategory)} className="mt-2 text-xs text-gray-500 hover:text-gray-300 text-left px-3 py-1">⚙ カテゴリー編集</button>
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
              <button onClick={addCategory} className="text-[#FFE600] text-xs px-2">＋</button>
            </div>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-bold text-white">Project Portfolio</h1><button onClick={() => { navigator.clipboard.writeText(window.location.origin + "/share/portfolio"); alert("共有URLをコピーしました"); }} className="bg-[#333333] hover:bg-[#3a3a3a] text-gray-300 text-xs px-4 py-2 rounded-lg border border-[#3a3a3a]">🔗 共有</button></div>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: '進行中PJ', value: inProgress },
            { label: '要注意：Health 🔴', value: atRisk },
            { label: '意思決定待ち', value: pendingDecision },
            { label: '平均進捗率', value: `${avgProgress}%` },
          ].map(k => (
            <div key={k.label} className="bg-[#242424] rounded-xl p-5 border border-[#3a3a3a]">
              <div className="text-xs text-gray-400 mb-1">{k.label}</div>
              <div className="text-3xl font-bold text-white">{k.value}</div>
            </div>
          ))}
        </div>
        <div className="bg-[#242424] rounded-xl border border-[#3a3a3a] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#3a3a3a] text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Project名</th>
                <th className="text-left px-4 py-3">カテゴリー</th>
                <th className="text-center px-4 py-3">Health</th>
                <th className="text-center px-4 py-3">ステータス</th>
                <th className="text-center px-4 py-3">SYNC</th>
                <th className="text-center px-4 py-3">Decision</th>
                <th className="text-center px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors">
                  <td className="px-4 py-3"><a href={`/projects/${p.id}`} className="text-[#FFE600] hover:underline font-medium">{p.name}</a></td>
                  <td className="px-4 py-3 text-gray-300">{p.category?.name || '—'}</td>
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
                    <span className={`text-sm font-bold ${syncAvg(p) === null ? 'text-gray-500' : (syncAvg(p) as number) >= 4 ? 'text-green-400' : (syncAvg(p) as number) <= 2 ? 'text-red-400' : 'text-[#FFE600]'}`}>
                      {syncAvg(p) === null ? '—' : `${syncAvg(p)}/5`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${openIssues(p) > 0 ? 'bg-red-900 text-red-300' : 'bg-[#333333] text-gray-400'}`}>
                      {openIssues(p) > 0 ? `open ${openIssues(p)}件` : 'clear'}
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
                        <button onClick={() => updateProject(p.id)} className="text-xs text-[#FFE600] hover:text-[#f0d800]">保存</button>
                        <button onClick={() => setEditingProject(null)} className="text-xs text-gray-500">✕</button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => { setEditingProject(p.id); setEditProjectName(p.name); setEditProjectCategory(p.category_id || '') }} className="text-xs text-[#FFE600] hover:text-[#f0d800]">編集</button>
                        <button onClick={() => deleteProject(p.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {addingProject ? (
                <tr className="border-b border-[#3a3a3a] bg-[#333333]">
                  <td className="px-4 py-3">
                    <input autoFocus value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addProject()} placeholder="Project名" className="bg-[#3a3a3a] text-white px-2 py-1 rounded text-sm w-full" />
                  </td>
                  <td className="px-4 py-3">
                    <select value={newProjectCategory} onChange={e => setNewProjectCategory(e.target.value)} className="bg-[#3a3a3a] text-white px-2 py-1 rounded text-sm">
                      <option value="">カテゴリー選択</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td colSpan={5} className="px-4 py-3">
                    <button onClick={addProject} className="bg-[#FFE600] text-black px-3 py-1 rounded text-xs mr-2">追加</button>
                    <button onClick={() => setAddingProject(false)} className="text-gray-400 text-xs">キャンセル</button>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-3">
                    <button onClick={() => setAddingProject(true)} className="text-[#FFE600] text-sm hover:text-[#f0d800]">＋ Project追加</button>
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