'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const statusLabel = (s: string) =>
  s === 'not_started' ? '未着手' : s === 'in_progress' ? '進行中' : '完了'

const roleLabel = (r: string) =>
  r === 'owner' ? 'Owner' : r === 'pm' ? 'PM' : r === 'executor' ? '実行' : '意思決定者'

export default function ThemeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [theme, setTheme] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newTaskName, setNewTaskName] = useState('')
  const [newBlockerContent, setNewBlockerContent] = useState('')
  const [newDecisionContent, setNewDecisionContent] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [addingBlocker, setAddingBlocker] = useState(false)
  const [addingDecision, setAddingDecision] = useState(false)
  const [blockerInputs, setBlockerInputs] = useState<Record<string, { measure: string }>>({})
  const [editingBlocker, setEditingBlocker] = useState<string | null>(null)
  const [editingBlockerContent, setEditingBlockerContent] = useState('')
  const [editingDecision, setEditingDecision] = useState<string | null>(null)
  const [editingDecisionContent, setEditingDecisionContent] = useState('')
  const [decisionInputs, setDecisionInputs] = useState<Record<string, any>>({})
  const [progressForm, setProgressForm] = useState({ status: 'in_progress', progress_rate: 0, comment: '' })
  const [showProgressForm, setShowProgressForm] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberInitial, setNewMemberInitial] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    const [{ data: thm }, { data: mbrs }] = await Promise.all([
      supabase.from('themes').select('*, project:projects(id, name), tasks(*), blockers(*), decision_logs(*), progress_logs(*), milestones(*), sync_statuses(*), theme_members(*, member:members(*))').eq('id', id).single(),
      supabase.from('members').select('*').order('created_at'),
    ])
    setTheme(thm)
    setMembers(mbrs || [])
    setLoading(false)
  }

  async function addTask() {
    if (!newTaskName.trim()) return
    await supabase.from('tasks').insert({ theme_id: id, name: newTaskName })
    setNewTaskName('')
    setAddingTask(false)
    fetchAll()
  }

  async function updateTaskStatus(taskId: string, status: string) {
    await supabase.from('tasks').update({ status }).eq('id', taskId)
    fetchAll()
  }

  async function deleteTask(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId)
    fetchAll()
  }

  async function addBlocker() {
    if (!newBlockerContent.trim()) return
    await supabase.from('blockers').insert({ theme_id: id, content: newBlockerContent })
    setNewBlockerContent('')
    setAddingBlocker(false)
    fetchAll()
  }

  async function updateBlocker(blockerId: string, updates: any) {
    await supabase.from('blockers').update(updates).eq('id', blockerId)
    fetchAll()
  }

  async function addDecision() {
    if (!newDecisionContent.trim()) return
    await supabase.from('decision_logs').insert({ theme_id: id, content: newDecisionContent })
    setNewDecisionContent('')
    setAddingDecision(false)
    fetchAll()
  }

  async function updateDecision(decisionId: string, updates: any) {
    await supabase.from('decision_logs').update(updates).eq('id', decisionId)
    fetchAll()
  }

  async function saveProgress() {
    await supabase.from('progress_logs').insert({ theme_id: id, ...progressForm })
    await supabase.from('themes').update({ status: progressForm.status }).eq('id', id)
    setShowProgressForm(false)
    fetchAll()
  }

  async function updateMilestone(updates: any) {
    const existing = theme?.milestones
    if (existing) {
      await supabase.from('milestones').update(updates).eq('theme_id', id)
    } else {
      await supabase.from('milestones').insert({ theme_id: id, ...updates })
    }
    fetchAll()
  }

  async function assignMember(role: string, memberId: string) {
    const existing = theme?.theme_members?.find((tm: any) => tm.role === role)
    if (existing) {
      if (memberId) {
        await supabase.from('theme_members').update({ member_id: memberId }).eq('id', existing.id)
      } else {
        await supabase.from('theme_members').delete().eq('id', existing.id)
      }
    } else if (memberId) {
      await supabase.from('theme_members').insert({ theme_id: id, member_id: memberId, role })
    }
    fetchAll()
  }

  async function addMember() {
    if (!newMemberName.trim() || !newMemberInitial.trim()) return
    await supabase.from('members').insert({ name: newMemberName, initial: newMemberInitial })
    setNewMemberName('')
    setNewMemberInitial('')
    setAddingMember(false)
    fetchAll()
  }

  async function deleteMember(memberId: string) {
    if (!confirm('このメンバーを削除しますか？')) return
    await supabase.from('members').delete().eq('id', memberId)
    fetchAll()
  }

  async function updateMember(memberId: string, name: string, initial: string) {
    await supabase.from('members').update({ name, initial }).eq('id', memberId)
    fetchAll()
  }

  async function deleteTask2(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId)
    fetchAll()
  }

  async function updateTaskName(taskId: string, name: string) {
    await supabase.from('tasks').update({ name }).eq('id', taskId)
    fetchAll()
  }

  async function saveBlockerContent(blockerId: string) {
    await supabase.from('blockers').update({ content: editingBlockerContent }).eq('id', blockerId)
    setEditingBlocker(null)
    fetchAll()
  }

  async function resolveBlocker(blockerId: string, measure?: string) {
    const blocker = (theme?.blockers || []).find((b: any) => b.id === blockerId)
    // Decision Logに移動（insert）
    await supabase.from('decision_logs').insert({
      theme_id: id,
      blocker_id: blockerId,
      content: blocker?.content || '',
      decided_by: null,
      status: 'resolved'
    })
    // resolved_commentに施策内容を保存してBlockerを削除
    await supabase.from('blockers').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_comment: measure || ''
    }).eq('id', blockerId)
    setBlockerInputs(prev => { const n = {...prev}; delete n[blockerId]; return n })
    fetchAll()
  }

  async function moveToBlocker(decisionId: string) {
    const decision = (theme.decision_logs || []).find((d: any) => d.id === decisionId)
    if (!decision) return
    // Blockerに移動（insert）
    await supabase.from('blockers').insert({
      theme_id: id,
      content: decision.content,
      status: 'open'
    })
    // Decision Logを削除
    await supabase.from('decision_logs').delete().eq('id', decisionId)
    fetchAll()
  }

  async function deleteBlocker(blockerId: string) {
    if (!confirm('このBlockerを削除しますか？')) return
    await supabase.from('blockers').delete().eq('id', blockerId)
    fetchAll()
  }

  async function saveDecisionContent(decisionId: string) {
    const input = decisionInputs[decisionId] || {}
    await supabase.from('decision_logs').update({
      content: editingDecisionContent || undefined,
      decided_by: input.decided_by || null
    }).eq('id', decisionId)
    setEditingDecision(null)
    fetchAll()
  }

  async function deleteDecision(decisionId: string) {
    if (!confirm('このDecisionを削除しますか？')) return
    await supabase.from('decision_logs').delete().eq('id', decisionId)
    fetchAll()
  }

  function shareUrl() {
    navigator.clipboard.writeText(window.location.origin + '/share/theme/' + id)
    alert('共有URLをコピーしました')
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
  if (!theme) return <div className="flex items-center justify-center h-screen text-gray-400">Theme not found</div>

  const tasks = theme.tasks || []
  const backlog = tasks.filter((t: any) => t.status === 'backlog')
  const inProgress = tasks.filter((t: any) => t.status === 'in_progress')
  const done = tasks.filter((t: any) => t.status === 'done')
  const taskProgressRate = tasks.length === 0 ? 0 : Math.round(done.length / tasks.length * 100)
  const progressLogs = (theme.progress_logs || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const latestLog = progressLogs[0]
  const prevLog = progressLogs[1]
  const openBlockers = (theme.blockers || []).filter((b: any) => b.status === 'open')
  const resolvedBlockers = (theme.blockers || []).filter((b: any) => b.status === 'resolved')
  const openDecisions = (theme.decision_logs || []).filter((d: any) => d.status === 'open')
  const resolvedDecisions = (theme.decision_logs || []).filter((d: any) => d.status === 'resolved')

  const roles = ['owner', 'pm', 'executor', 'decision_maker']

  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      <aside className="w-56 bg-[#242424] border-r border-[#3a3a3a] flex flex-col p-4 gap-2">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">プロジェクト</div>
        <a href="/portfolio" className="text-gray-300 hover:bg-[#333333] px-3 py-2 rounded text-sm">← Portfolio</a>
        {theme.project && (
          <a href={`/projects/${theme.project.id}`} className="text-gray-300 hover:bg-[#333333] px-3 py-2 rounded text-sm">← {theme.project.name}</a>
        )}
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{theme.name}</h1>
            <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${theme.status === 'done' ? 'bg-green-100 text-green-700' : theme.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-[#333333] text-gray-400'}`}>
              {statusLabel(theme.status)}
            </span>
          </div>
          <button onClick={shareUrl} className="bg-[#333333] hover:bg-[#3a3a3a] text-gray-300 text-xs px-4 py-2 rounded-lg border border-[#3a3a3a]">🔗 共有</button>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <div className="flex flex-col gap-6">
            <div className="bg-[#242424] rounded-xl p-5 border border-[#3a3a3a]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">WHO</h2>
                <button onClick={() => setAddingMember(!addingMember)} className="text-xs text-[#FFE600] hover:text-[#f0d800]">＋ メンバー追加</button>
              </div>
              {addingMember && (
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex gap-2">
                    <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="名前" className="bg-white text-slate-900 text-xs px-2 py-1 rounded flex-1" />
                    <input value={newMemberInitial} onChange={e => setNewMemberInitial(e.target.value)} placeholder="略称" className="bg-white text-slate-900 text-xs px-2 py-1 rounded w-16" />
                    <button onClick={addMember} className="bg-[#FFE600] text-black text-xs px-3 py-1 rounded">追加</button>
                  </div>
                  <div className="border-t border-[#3a3a3a] pt-2">
                    <div className="text-xs text-gray-500 mb-1">メンバー管理</div>
                    {members.map(m => (
                      <div key={m.id} className="flex gap-2 items-center mb-1">
                        <span className="text-xs text-gray-300 flex-1">{m.name}（{m.initial}）</span>
                        <button onClick={() => { const name = prompt('名前', m.name); const initial = prompt('略称', m.initial); if (name && initial) updateMember(m.id, name, initial) }} className="text-xs text-[#FFE600] hover:text-[#f0d800]">編集</button>
                        <button onClick={() => deleteMember(m.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {roles.map(role => {
                  const assigned = theme.theme_members?.find((tm: any) => tm.role === role)
                  return (
                    <div key={role} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20">{roleLabel(role)}</span>
                      <select value={assigned?.member_id || ''} onChange={e => assignMember(role, e.target.value)} className="flex-1 bg-white text-slate-900 text-xs px-2 py-1 rounded">
                        <option value="">未割当</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="bg-[#242424] rounded-xl p-5 border border-[#3a3a3a]">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">WHEN</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">期日</span>
                  <input type="date" value={theme.milestones?.due_date || ''} onChange={e => updateMilestone({ due_date: e.target.value })} className="bg-white text-slate-900 text-sm px-2 py-1 rounded" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">完了</span>
                  <input type="checkbox" checked={theme.milestones?.is_completed || false} onChange={e => updateMilestone({ is_completed: e.target.checked })} className="w-4 h-4" />
                </div>
                {theme.milestones?.due_date && !theme.milestones?.is_completed && new Date(theme.milestones.due_date) < new Date() && (
                  <span className="text-xs text-red-500 font-medium">⚠ 期限超過</span>
                )}
              </div>
            </div>
            <div className="bg-[#242424] rounded-xl p-5 border border-[#3a3a3a]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">進捗</h2>
                <button onClick={() => setShowProgressForm(!showProgressForm)} className="text-xs text-[#FFE600] hover:text-[#f0d800]">＋ 進捗入力</button>
              </div>
              <div className="text-xs text-gray-500 mb-3">タスク消化率：{taskProgressRate}%（{done.length}/{tasks.length}件）</div>
              {showProgressForm && (
                <div className="bg-[#1a1a1a] rounded-lg p-4 mb-4 border border-[#3a3a3a]">
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-xs text-gray-500">ステータス</label>
                        <select value={progressForm.status} onChange={e => setProgressForm({ ...progressForm, status: e.target.value })} className="bg-[#242424] border border-[#3a3a3a] text-white text-sm px-2 py-1 rounded">
                          <option value="not_started">未着手</option>
                          <option value="in_progress">進行中</option>
                          <option value="done">完了</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-xs text-gray-500">進捗率 {progressForm.progress_rate}%</label>
                        <input type="range" min={0} max={100} value={progressForm.progress_rate} onChange={e => setProgressForm({ ...progressForm, progress_rate: Number(e.target.value) })} className="w-full" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">判断コメント</label>
                      <textarea value={progressForm.comment} onChange={e => setProgressForm({ ...progressForm, comment: e.target.value })} className="bg-[#242424] border border-[#3a3a3a] text-white text-sm px-2 py-1 rounded resize-none" rows={2} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveProgress} className="bg-[#FFE600] text-black text-xs px-3 py-1 rounded">保存</button>
                      <button onClick={() => setShowProgressForm(false)} className="text-gray-500 text-xs">キャンセル</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {[prevLog, latestLog].map((log, i) => log ? (
                  <div key={log.id} className="bg-[#1a1a1a] rounded-lg p-3 border border-[#3a3a3a]">
                    <div className="text-xs text-gray-500 mb-1">{i === 0 ? '前回' : '最新'} · {new Date(log.created_at).toLocaleDateString('ja-JP')}</div>
                    <div className="text-sm font-medium text-gray-200 mb-1">{statusLabel(log.status)} · {log.progress_rate}%</div>
                    {log.comment && <div className="text-xs text-gray-400">{log.comment}</div>}
                  </div>
                ) : (
                  <div key={i} className="bg-[#1a1a1a] rounded-lg p-3 border border-[#3a3a3a] text-xs text-gray-500">{i === 0 ? '前回' : '最新'}の記録なし</div>
                ))}
              </div>
            </div>
            <div className="bg-[#242424] rounded-xl p-5 border border-[#3a3a3a]">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">TASKS</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Backlog', tasks: backlog, status: 'backlog' },
                  { label: 'In Progress', tasks: inProgress, status: 'in_progress' },
                  { label: 'Done', tasks: done, status: 'done' },
                ].map(col => (
                  <div key={col.status}>
                    <div className="text-xs font-medium text-gray-500 mb-2">{col.label} ({col.tasks.length})</div>
                    <div className="flex flex-col gap-2">
                      {col.tasks.map((t: any) => (
                        <div key={t.id} className="bg-[#1a1a1a] rounded-lg p-3 border border-[#3a3a3a]">
                          <div className="text-sm text-gray-200 mb-2">{t.name}</div>
                          <div className="flex gap-1 flex-wrap">
                            {['backlog', 'in_progress', 'done'].filter(s => s !== t.status).map(s => (
                              <button key={s} onClick={() => updateTaskStatus(t.id, s)} className={`text-xs rounded px-1.5 py-0.5 border font-medium ${s === 'in_progress' ? 'bg-blue-500 text-white border-blue-500' : s === 'done' ? 'bg-green-500 text-white border-green-500' : 'bg-[#333333] text-gray-300 border-[#3a3a3a]'}`}>
                                → {s === 'backlog' ? 'Backlog' : s === 'in_progress' ? 'In Progress' : 'Done'}
                              </button>
                            ))}
                            <button onClick={() => { const name = prompt('タスク名を変更', t.name); if (name) updateTaskName(t.id, name) }} className="text-xs text-gray-400 hover:text-gray-200 ml-auto">編集</button>
                            <button onClick={() => deleteTask(t.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                {addingTask ? (
                  <div className="flex gap-2">
                    <input autoFocus value={newTaskName} onChange={e => setNewTaskName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="タスク名" className="bg-white text-slate-900 text-sm px-2 py-1 rounded flex-1" />
                    <button onClick={addTask} className="bg-[#FFE600] text-black text-xs px-3 py-1 rounded">追加</button>
                    <button onClick={() => setAddingTask(false)} className="text-gray-500 text-xs">キャンセル</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingTask(true)} className="text-[#FFE600] text-sm hover:text-[#f0d800]">＋ タスク追加</button>
                )}
              </div>
            </div>
            <div className="bg-[#242424] rounded-xl p-5 border border-[#3a3a3a]">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">BLOCKERS &amp; DECISIONS</h2>
              <div className="grid grid-cols-2 gap-6">

                {/* Blockers - unresolvedのみ表示 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-red-400">Blockers</span>
                    <button onClick={() => setAddingBlocker(!addingBlocker)} className="text-xs text-[#FFE600]">＋ 追加</button>
                  </div>
                  {addingBlocker && (
                    <div className="flex flex-col gap-2 mb-3 bg-[#2a1a1a] p-3 rounded-lg border border-red-900">
                      <input value={newBlockerContent} onChange={e => setNewBlockerContent(e.target.value)} placeholder="ブロッカー内容" className="bg-white text-slate-900 text-xs px-2 py-1 rounded" />
                      <input
                        value={blockerInputs['new']?.measure || ''}
                        onChange={e => setBlockerInputs(prev => ({ ...prev, new: { measure: e.target.value } }))}
                        placeholder="施策内容"
                        className="bg-white text-slate-900 text-xs px-2 py-1 rounded"
                      />
                      <div className="flex gap-2">
                        <button onClick={addBlocker} className="bg-[#FFE600] text-black text-xs px-3 py-1 rounded font-medium flex-1">保存</button>
                        <button onClick={() => setAddingBlocker(false)} className="text-xs text-gray-400 px-2">✕</button>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    {(theme.blockers || []).filter((b: any) => b.status === 'open').map((b: any) => (
                      <div key={b.id} className="rounded-lg p-3 border bg-[#2a1a1a] border-red-900">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-red-400">unresolved</span>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingBlocker(editingBlocker === b.id ? null : b.id); setEditingBlockerContent(b.content); setBlockerInputs(prev => ({ ...prev, [b.id]: { measure: b.resolved_comment || '' } })) }} className="text-xs text-[#FFE600] hover:text-[#f0d800]">編集</button>
                            <button onClick={() => deleteBlocker(b.id)} className="text-xs text-red-400 hover:text-red-300">削除</button>
                          </div>
                        </div>
                        {editingBlocker === b.id ? (
                          <div className="flex flex-col gap-2">
                            <input value={editingBlockerContent} onChange={e => setEditingBlockerContent(e.target.value)} placeholder="ブロッカー内容" className="bg-white text-slate-900 text-xs px-2 py-1 rounded" />
                            <input
                              value={blockerInputs[b.id]?.measure || ''}
                              onChange={e => setBlockerInputs(prev => ({ ...prev, [b.id]: { measure: e.target.value } }))}
                              placeholder="施策内容"
                              className="bg-white text-slate-900 text-xs px-2 py-1 rounded"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => saveBlockerContent(b.id)} className="text-xs bg-[#FFE600] text-black px-3 py-1 rounded font-medium flex-1">保存</button>
                              <button onClick={() => resolveBlocker(b.id, blockerInputs[b.id]?.measure)} className="text-xs bg-green-600 text-white px-2 py-1 rounded font-medium">解決済にする → Decision Logへ</button>
                              <button onClick={() => setEditingBlocker(null)} className="text-xs text-gray-400 px-1">✕</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm text-gray-200">{b.content}</div>
                            {b.resolved_comment && <div className="text-xs text-gray-400 mt-1">施策: {b.resolved_comment}</div>}
                          </div>
                        )}
                      </div>
                    ))}
                    {(theme.blockers || []).filter((b: any) => b.status === 'open').length === 0 && (
                      <div className="text-xs text-gray-500 py-2">Blockerなし</div>
                    )}
                  </div>
                </div>

                {/* Decision Log */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-yellow-400">Decision Log</span>
                    <button onClick={() => setAddingDecision(!addingDecision)} className="text-xs text-[#FFE600]">＋ 追加</button>
                  </div>
                  {addingDecision && (
                    <div className="flex flex-col gap-2 mb-3 bg-[#2a2a1a] p-3 rounded-lg border border-yellow-900">
                      <input value={newDecisionContent} onChange={e => setNewDecisionContent(e.target.value)} placeholder="ブロッカー内容" className="bg-white text-slate-900 text-xs px-2 py-1 rounded" />
                      <input
                        value={decisionInputs['new']?.decided_by || ''}
                        onChange={e => setDecisionInputs(prev => ({ ...prev, new: { decided_by: e.target.value } }))}
                        placeholder="施策内容"
                        className="bg-white text-slate-900 text-xs px-2 py-1 rounded"
                      />
                      <div className="flex gap-2">
                        <button onClick={addDecision} className="bg-[#FFE600] text-black text-xs px-3 py-1 rounded font-medium flex-1">保存</button>
                        <button onClick={() => setAddingDecision(false)} className="text-xs text-gray-400 px-2">✕</button>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    {(theme.decision_logs || []).map((d: any) => (
                      <div key={d.id} className="bg-[#2a2a1a] rounded-lg p-3 border border-yellow-900">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-yellow-400">decision</span>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingDecision(editingDecision === d.id ? null : d.id); setEditingDecisionContent(d.content) }} className="text-xs text-[#FFE600] hover:text-[#f0d800]">編集</button>
                            <button onClick={() => deleteDecision(d.id)} className="text-xs text-red-400 hover:text-red-300">削除</button>
                          </div>
                        </div>
                        {editingDecision === d.id ? (
                          <div className="flex flex-col gap-2">
                            <input value={editingDecisionContent} onChange={e => setEditingDecisionContent(e.target.value)} placeholder="ブロッカー内容" className="bg-white text-slate-900 text-xs px-2 py-1 rounded" />
                            <input
                              value={decisionInputs[d.id]?.decided_by || ''}
                              onChange={e => setDecisionInputs(prev => ({ ...prev, [d.id]: { decided_by: e.target.value } }))}
                              placeholder="施策内容"
                              className="bg-white text-slate-900 text-xs px-2 py-1 rounded"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => saveDecisionContent(d.id)} className="text-xs bg-[#FFE600] text-black px-3 py-1 rounded font-medium flex-1">保存</button>
                              <button onClick={() => setEditingDecision(null)} className="text-xs text-gray-400 px-1">✕</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm text-gray-200">{d.content}</div>
                            {d.decided_by && <div className="text-xs text-gray-400 mt-1">施策: {d.decided_by}</div>}
                          </div>
                        )}
                        <div className="border-t border-yellow-900 pt-2 mt-2">
                          <button onClick={() => moveToBlocker(d.id)} className="text-xs text-orange-400 hover:text-orange-300">↩ Blockerに戻す</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
