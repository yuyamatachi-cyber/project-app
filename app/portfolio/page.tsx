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

  async function updateRisk(id: string, risk: string) {
    await supabase.from('projects').update({ risk }).eq('id', id)
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

  const openIssues = (p: Project) =>
    p.themes?.reduce((sum: number, t: any) =>
      sum + (t.blockers?.filter((b: any) => b.status === 'open').length || 0) +
      (t.decision_logs?.filter((d: any) => d.status === 'open').length || 0), 0) || 0

  const taskProgress = (p: Project) => {
    const tasks = p.themes?.flatMap((t: any) => t.tasks || []) || []
    if (tasks.length === 0) return 0
    return Math.round(tasks.filter((t: any) => t.status === 'done').length / tasks.length * 100)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500">Loading...</div>

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col p-4 gap-2">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">プロジェクト</div>
        <button onClick={() => setSelectedCategory(null)} className={`text-left px-3 py-2 rounded text-sm ${!selectedCategory ? 'bg-blue-600 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}>すべて</button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`text-left px-3 py-2 rounded text-sm ${selectedCategory === cat.id ? 'bg-blue-600 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}>{cat.name}</button>
        ))}
        <button onClick={() => setEditingCategory(!editingCategory)} className="mt-2 text-xs text-gray-500 hover:text-slate-600 text-left px-3 py-1">⚙ カテゴリー編集</button>
        {editingCategory && (
          <div className="mt-2 flex flex-col gap-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex gap-1">
                <input defaultValue={cat.name} onBlur={e => renameCategory(cat.id, e.target.value)} className="flex-1 bg-slate-100 text-slate-900 text-xs px-2 py-1 rounded" />
                <button onClick={() => deleteCategory(cat.id)} className="text-red-400 text-xs px-1">✕</button>
              </div>
            ))}
            <div className="flex gap-1">
              <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="新規カテゴリー" className="flex-1 bg-slate-100 text-slate-900 text-xs px-2 py-1 rounded" />
              <button onClick={addCategory} className="text-blue-400 text-xs px-2">＋</button>
            </div>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-bold text-slate-900">Project Portfolio</h1><button onClick={() => { navigator.clipboard.writeText(window.location.origin + "/share/portfolio"); alert("共有URLをコピーしました"); }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs px-4 py-2 rounded-lg border border-slate-200">🔗 共有</button></div>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: '進行中PJ', value: inProgress },
            { label: '要注意', value: atRisk },
            { label: '意思決定待ち', value: pendingDecision },
            { label: '平均進捗率', value: `${avgProgress}%` },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl p-5 border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">{k.label}</div>
              <div className="text-3xl font-bold text-slate-900">{k.value}</div>
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
                <th className="text-center px-4 py-3">進捗</th>
                <th className="text-center px-4 py-3">Risk</th>
                <th className="text-center px-4 py-3">Decision</th>
                <th className="text-center px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-slate-200 hover:bg-slate-100 transition-colors">
                  <td className="px-4 py-3"><a href={`/projects/${p.id}`} className="text-blue-400 hover:underline font-medium">{p.name}</a></td>
                  <td className="px-4 py-3 text-slate-600">{p.category?.name || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <select value={p.health} onChange={e => updateHealth(p.id, e.target.value)} className="bg-transparent text-lg cursor-pointer">
                      <option value="green">🟢</option>
                      <option value="yellow">🟡</option>
                      <option value="red">🔴</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{taskProgress(p)}%</td>
                  <td className="px-4 py-3 text-center">
                    <select value={p.risk} onChange={e => updateRisk(p.id, e.target.value)} className="bg-transparent text-lg cursor-pointer">
                      <option value="green">🟢</option>
                      <option value="yellow">🟡</option>
                      <option value="red">🔴</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${openIssues(p) > 0 ? 'bg-red-900 text-red-300' : 'bg-slate-100 text-slate-500'}`}>
                      {openIssues(p) > 0 ? `open ${openIssues(p)}件` : 'clear'}
                    </span>
                  </td>
                </tr>
              ))}
              {addingProject ? (
                <tr className="border-b border-slate-200 bg-slate-100">
                  <td className="px-4 py-3">
                    <input autoFocus value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addProject()} placeholder="Project名" className="bg-slate-200 text-slate-900 px-2 py-1 rounded text-sm w-full" />
                  </td>
                  <td className="px-4 py-3">
                    <select value={newProjectCategory} onChange={e => setNewProjectCategory(e.target.value)} className="bg-slate-200 text-slate-900 px-2 py-1 rounded text-sm">
                      <option value="">カテゴリー選択</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td colSpan={4} className="px-4 py-3">
                    <button onClick={addProject} className="bg-blue-600 text-slate-900 px-3 py-1 rounded text-xs mr-2">追加</button>
                    <button onClick={() => setAddingProject(false)} className="text-slate-500 text-xs">キャンセル</button>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-3">
                    <button onClick={() => setAddingProject(true)} className="text-blue-400 text-sm hover:text-blue-300">＋ Project追加</button>
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