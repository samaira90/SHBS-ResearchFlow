import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Pencil,
  Trash2,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import './App.css'

const API_URL = 'http://localhost:5000'

type StudyStatus = 'Active' | 'In Review' | 'Completed'

type Study = {
  id: string
  name: string
  lead: string
  status: StudyStatus
  progress: number
  due: string
  due_date: string | null
}

type ActivityLog = {
  id: number
  study_code: string | null
  study_name: string
  action: string
  description: string
  created_at: string
}

type Deadline = Study & {
  deadline_status: 'Upcoming' | 'Overdue'
}

// Supports both plain JSON arrays and response objects.
async function readResponse<T>(response: Response): Promise<T> {
  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result?.message || result?.error || 'Request failed.',
    )
  }

  if (Array.isArray(result)) {
    return result as T
  }

  if (result && typeof result === 'object') {
    if (result.success === false) {
      throw new Error(
        result.message || result.error || 'Request failed.',
      )
    }

    if ('data' in result) {
      return result.data as T
    }

    return result as T
  }

  throw new Error('Unexpected response from the server.')
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong.'
}

function formatActivityTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatDeadline(value: string | null): string {
  if (!value) return 'Not scheduled'

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function App() {
  const [studies, setStudies] = useState<Study[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])

  const [search, setSearch] = useState('')
  const [activeNav, setActiveNav] = useState('Overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const [apiError, setApiError] = useState('')
  const [activityError, setActivityError] = useState('')
  const [deadlineError, setDeadlineError] = useState('')
  const [notice, setNotice] = useState('')

  // Create study form
  const [showForm, setShowForm] = useState(false)
  const [studyName, setStudyName] = useState('')
  const [studyDueDate, setStudyDueDate] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit study form
  const [editingStudy, setEditingStudy] =
    useState<Study | null>(null)
  const [editName, setEditName] = useState('')
  const [editLead, setEditLead] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editStatus, setEditStatus] =
    useState<StudyStatus>('Active')
  const [editProgress, setEditProgress] = useState(0)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Load studies from the database.
  const loadStudies = useCallback(async () => {
    try {
      setLoading(true)
      setApiError('')

      const response = await fetch(`${API_URL}/api/studies`)
      const data = await readResponse<Study[]>(response)

      setStudies(data)
    } catch (error) {
      setApiError(
        `${getErrorMessage(error)} Check that the backend is running at ${API_URL}.`,
      )
    } finally {
      setLoading(false)
    }
  }, [])

  // Load actual activity records.
  const loadActivities = useCallback(async () => {
    try {
      setActivityError('')

      const response = await fetch(`${API_URL}/api/activities`)
      const data = await readResponse<ActivityLog[]>(response)

      setActivities(data)
    } catch (error) {
      setActivityError(getErrorMessage(error))
    }
  }, [])

  // Load upcoming and overdue deadlines.
  const loadDeadlines = useCallback(async () => {
    try {
      setDeadlineError('')

      const response = await fetch(`${API_URL}/api/deadlines`)
      const data = await readResponse<Deadline[]>(response)

      setDeadlines(data)
    } catch (error) {
      setDeadlineError(getErrorMessage(error))
    }
  }, [])

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      loadStudies(),
      loadActivities(),
      loadDeadlines(),
    ])
  }, [loadStudies, loadActivities, loadDeadlines])

  useEffect(() => {
    void refreshDashboard()
  }, [refreshDashboard])

  // Create a study.
  async function addStudy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!studyName.trim()) {
      setFormError('Please enter a study name.')
      return
    }

    try {
      setSaving(true)
      setFormError('')
      setNotice('')

      const response = await fetch(`${API_URL}/api/studies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: studyName.trim(),
          lead: 'Samaira',
          status: 'Active',
          progress: 0,
          due: studyDueDate || 'Not scheduled',
          dueDate: studyDueDate || null,
        }),
      })

      await readResponse<unknown>(response)

      setStudyName('')
      setStudyDueDate('')
      setShowForm(false)
      setActiveNav('Studies')
      setNotice('Study created successfully.')

      await refreshDashboard()
    } catch (error) {
      setFormError(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  // Open the edit dialog.
  function openEditStudy(study: Study) {
    setEditingStudy(study)
    setEditName(study.name)
    setEditLead(study.lead)
    setEditDueDate(study.due_date?.slice(0, 10) ?? '')
    setEditStatus(study.status)
    setEditProgress(study.progress)
    setEditError('')
    setNotice('')
  }

  // Save study changes.
  async function updateStudy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingStudy) return

    if (!editName.trim() || !editLead.trim()) {
      setEditError('Study name and project lead are required.')
      return
    }

    if (
      !Number.isInteger(editProgress) ||
      editProgress < 0 ||
      editProgress > 100
    ) {
      setEditError('Progress must be between 0 and 100.')
      return
    }

    try {
      setEditSaving(true)
      setEditError('')
      setNotice('')

      const response = await fetch(
        `${API_URL}/api/studies/${encodeURIComponent(editingStudy.id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: editName.trim(),
            lead: editLead.trim(),
            due: editDueDate || 'Not scheduled',
            dueDate: editDueDate || null,
            status: editStatus,
            progress: editProgress,
          }),
        },
      )

      await readResponse<unknown>(response)

      setEditingStudy(null)
      setNotice('Study updated successfully.')

      await refreshDashboard()
    } catch (error) {
      setEditError(getErrorMessage(error))
    } finally {
      setEditSaving(false)
    }
  }

  // Delete a study.
  async function deleteStudy(study: Study) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${study.name}"? This cannot be undone.`,
    )

    if (!confirmed) return

    try {
      setNotice('')

      const response = await fetch(
        `${API_URL}/api/studies/${encodeURIComponent(study.id)}`,
        { method: 'DELETE' },
      )

      await readResponse<unknown>(response)

      setNotice('Study deleted successfully.')

      await refreshDashboard()
    } catch (error) {
      window.alert(getErrorMessage(error))
    }
  }

  const filteredStudies = studies.filter((study) =>
    `${study.name} ${study.lead} ${study.id} ${study.status}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )

  const activeCount = studies.filter(
    (study) => study.status === 'Active',
  ).length

  const reviewCount = studies.filter(
    (study) => study.status === 'In Review',
  ).length

  const completedCount = studies.filter(
    (study) => study.status === 'Completed',
  ).length

  const navigation = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Studies', icon: FlaskConical },
    { label: 'Tasks', icon: ClipboardList },
    { label: 'Documents', icon: FileText },
    { label: 'Team', icon: Users },
    { label: 'Audit Log', icon: ShieldCheck },
    { label: 'Settings', icon: Settings },
  ]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon">
            <FlaskConical size={22} />
          </div>

          <div>
            <strong>SHBS</strong>
            <span>WORKSPACE</span>
          </div>

          <button
            type="button"
            className="mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <div className="workspace-switch">
          <div className="workspace-avatar">SH</div>
          <div className="workspace-info">
            <strong>Research Lab</strong>
            <span>Free workspace</span>
          </div>
          <ChevronDown size={16} />
        </div>

        <div className="nav-label">MAIN MENU</div>

        <nav>
          {navigation.map(({ label, icon: Icon }) => (
            <button
              type="button"
              key={label}
              className={`nav-item ${
                activeNav === label ? 'nav-active' : ''
              }`}
              onClick={() => {
                setActiveNav(label)
                setMenuOpen(false)
              }}
            >
              <Icon size={18} />
              <span>{label}</span>

              {label === 'Tasks' && (
                <span className="nav-count">5</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="security-card">
            <ShieldCheck size={19} />
            <strong>Secure workspace</strong>
            <p>
              Organize your research workflow in one place.
            </p>
          </div>

          <div className="profile">
            <div className="profile-avatar">SH</div>

            <div className="profile-info">
              <strong>Samaira</strong>
              <span>Workspace Admin</span>
            </div>

            <button
              type="button"
              className="icon-button"
              aria-label="Profile options"
              title="Profile options"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button
            type="button"
            className="icon-button mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>

          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{activeNav}</strong>
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search studies..."
                aria-label="Search studies"
              />
            </div>

            <button
              type="button"
              className="icon-button notification-button"
              aria-label="Notifications"
            >
              <Bell size={19} />
              <i />
            </button>

            <div className="topbar-avatar">SH</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="live-dot" />
                RESEARCH WORKSPACE
              </div>

              <h1>
                {activeNav === 'Overview'
                  ? 'Good morning, Samaira'
                  : activeNav}
              </h1>

              <p className="page-subtitle">
                {activeNav === 'Overview'
                  ? "Here's what's happening with your research projects today."
                  : `Manage your ${activeNav.toLowerCase()} and keep your workflow moving.`}
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setFormError('')
                setStudyName('')
                setStudyDueDate('')
                setShowForm(true)
              }}
            >
              <Plus size={18} /> New Study
            </button>
          </section>

          {apiError && (
            <div
              role="alert"
              style={{
                padding: 14,
                marginBottom: 20,
                borderRadius: 8,
                background: '#fff0f0',
                color: '#b42318',
                fontSize: 13,
              }}
            >
              {apiError}

              <button
                type="button"
                onClick={() => void loadStudies()}
                style={{
                  marginLeft: 12,
                  padding: '5px 10px',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              style={{
                padding: 12,
                marginBottom: 16,
                borderRadius: 8,
                background: '#ecfdf3',
                color: '#067647',
                fontSize: 13,
              }}
            >
              {notice}
            </div>
          )}

          <section className="stats-grid">
            <article className="stat-card">
              <div className="stat-top">
                <span>Total Studies</span>
                <div className="stat-icon purple">
                  <FlaskConical size={19} />
                </div>
              </div>
              <div className="stat-value">
                {loading ? '—' : studies.length}
              </div>
              <div className="stat-foot">
                <span className="trend-up">
                  <ArrowUpRight size={15} /> Live count
                </span>
                <span>in workspace</span>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Active Studies</span>
                <div className="stat-icon blue">
                  <Activity size={19} />
                </div>
              </div>
              <div className="stat-value">
                {loading ? '—' : activeCount}
              </div>
              <div className="stat-foot">
                <span className="trend-up">
                  <ArrowUpRight size={15} /> In progress
                </span>
                <span>right now</span>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Awaiting Review</span>
                <div className="stat-icon amber">
                  <Clock3 size={19} />
                </div>
              </div>
              <div className="stat-value">
                {loading ? '—' : reviewCount}
              </div>
              <div className="stat-foot">
                <span className="trend-neutral">Needs attention</span>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Completed</span>
                <div className="stat-icon green">
                  <CheckCircle2 size={19} />
                </div>
              </div>
              <div className="stat-value">
                {loading ? '—' : completedCount}
              </div>
              <div className="stat-foot">
                <span className="trend-up">
                  <ArrowUpRight size={15} /> Completed
                </span>
                <span>studies</span>
              </div>
            </article>
          </section>

          <section className="content-grid">
            <article className="panel studies-panel">
              <div className="panel-heading">
                <div>
                  <h2>Research Studies</h2>
                  <p>Track and manage your research initiatives.</p>
                </div>

                <button
                  type="button"
                  className="text-button"
                  onClick={() => setActiveNav('Studies')}
                >
                  View all <ArrowUpRight size={15} />
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>STUDY NAME</th>
                      <th>PROJECT LEAD</th>
                      <th>STATUS</th>
                      <th>PROGRESS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={5}>Loading studies...</td>
                      </tr>
                    )}

                    {!loading &&
                      !apiError &&
                      filteredStudies.map((study) => (
                        <tr key={study.id}>
                          <td>
                            <div className="study-name">
                              <div className="study-icon">
                                <FlaskConical size={17} />
                              </div>

                              <div>
                                <strong>{study.name}</strong>
                                <span>
                                  {study.id} · Due{' '}
                                  {formatDeadline(study.due_date)}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="lead-cell">
                              <div className="lead-avatar">
                                {study.lead
                                  .split(' ')
                                  .map((part) => part[0])
                                  .join('')
                                  .slice(0, 2)}
                              </div>
                              {study.lead}
                            </div>
                          </td>

                          <td>
                            <span
                              className={`status status-${study.status
                                .toLowerCase()
                                .replace(' ', '-')}`}
                            >
                              {study.status}
                            </span>
                          </td>

                          <td>
                            <div className="progress-cell">
                              <div className="progress-track">
                                <div
                                  className="progress-fill"
                                  style={{
                                    width: `${study.progress}%`,
                                  }}
                                />
                              </div>
                              <span>{study.progress}%</span>
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className="icon-button"
                                title="Edit study"
                                aria-label={`Edit ${study.name}`}
                                onClick={() => openEditStudy(study)}
                              >
                                <Pencil size={16} />
                              </button>

                              <button
                                type="button"
                                className="icon-button"
                                title="Delete study"
                                aria-label={`Delete ${study.name}`}
                                onClick={() => void deleteStudy(study)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    {!loading &&
                      !apiError &&
                      filteredStudies.length === 0 && (
                        <tr>
                          <td colSpan={5} className="empty-state">
                            No studies found. Try another search.
                          </td>
                        </tr>
                      )}

                    {apiError && !loading && (
                      <tr>
                        <td colSpan={5}>
                          Studies could not be loaded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="panel-footer">
                {loading
                  ? 'Loading...'
                  : `${filteredStudies.length} studies shown`}
                <span>
                  {loading ? '—' : `${studies.length} total`}
                </span>
              </div>
            </article>

            <aside className="right-column">
              <article className="panel activity-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recent Activity</h2>
                    <p>Latest workspace updates from MySQL.</p>
                  </div>

                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => void loadActivities()}
                    title="Refresh activity"
                    aria-label="Refresh activity"
                  >
                    <Activity size={17} />
                  </button>
                </div>

                <div className="activity-list">
                  {activityError && (
                    <div className="empty-state" role="alert">
                      <p>Could not load recent activity.</p>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => void loadActivities()}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!activityError && activities.length === 0 && (
                    <div className="empty-state">
                      No activity yet. Create, edit, or delete a study to
                      see updates here.
                    </div>
                  )}

                  {!activityError &&
                    activities.map((activity) => {
                      const isCreated = activity.action === 'created'
                      const isDeleted = activity.action === 'deleted'

                      return (
                        <div
                          className="activity-item"
                          key={activity.id}
                        >
                          <div
                            className={`activity-icon ${
                              isCreated
                                ? 'activity-green'
                                : isDeleted
                                  ? 'activity-blue'
                                  : 'activity-purple'
                            }`}
                          >
                            {isCreated ? (
                              <Plus size={17} />
                            ) : isDeleted ? (
                              <Trash2 size={17} />
                            ) : (
                              <Pencil size={17} />
                            )}
                          </div>

                          <div>
                            <strong>
                              {isCreated
                                ? 'Study created'
                                : isDeleted
                                  ? 'Study deleted'
                                  : activity.action === 'updated'
                                    ? 'Study updated'
                                    : 'Study activity'}
                            </strong>
                            <p>{activity.study_name}</p>
                            <span>
                              {formatActivityTime(activity.created_at)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                </div>

                <div className="panel-footer">
                  {activities.length} recent events
                  <span>Latest 10</span>
                </div>
              </article>

              <article className="panel deadline-card">
                <div className="deadline-icon">
                  <Clock3 size={20} />
                </div>

                <div>
                  <span>UPCOMING DEADLINES</span>

                  {deadlineError ? (
                    <>
                      <h3>Deadlines unavailable</h3>
                      <p>{deadlineError}</p>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => void loadDeadlines()}
                      >
                        Retry
                      </button>
                    </>
                  ) : deadlines.length > 0 ? (
                    <>
                      <h3>{deadlines[0].name}</h3>
                      <p>
                        Due {formatDeadline(deadlines[0].due_date)}
                        {' · '}
                        {deadlines[0].deadline_status}
                      </p>
                      {deadlines.length > 1 && (
                        <p>
                          {deadlines.length - 1} more dated{' '}
                          {deadlines.length - 1 === 1
                            ? 'study'
                            : 'studies'}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <h3>No deadlines yet</h3>
                      <p>
                        Add a deadline when creating or editing a study.
                      </p>
                    </>
                  )}
                </div>

                <ArrowDownRight size={18} />
              </article>

              <article className="tip-card">
                <div className="tip-icon">
                  <ShieldCheck size={19} />
                </div>

                <div>
                  <strong>Keep your workflow organized</strong>
                  <p>
                    Use study statuses to see which projects need attention
                    and which are ready for review.
                  </p>
                </div>
              </article>
            </aside>
          </section>

          {/* Create study dialog */}
          {showForm && (
            <div
              className="modal-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !saving) {
                  setShowForm(false)
                }
              }}
            >
              <form className="study-modal" onSubmit={addStudy}>
                <div className="modal-heading">
                  <div>
                    <h2>Create a study</h2>
                    <p>Add a research project to your workspace.</p>
                  </div>

                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setShowForm(false)}
                    disabled={saving}
                    aria-label="Close dialog"
                  >
                    <X />
                  </button>
                </div>

                <label htmlFor="study-name">Study name</label>
                <input
                  id="study-name"
                  autoFocus
                  value={studyName}
                  onChange={(event) => setStudyName(event.target.value)}
                  placeholder="e.g. Clinical Data Review"
                  required
                  disabled={saving}
                />

                <label
                  htmlFor="study-due-date"
                  style={{ display: 'block', marginTop: 14 }}
                >
                  Deadline (optional)
                </label>
                <input
                  id="study-due-date"
                  type="date"
                  value={studyDueDate}
                  onChange={(event) =>
                    setStudyDueDate(event.target.value)
                  }
                  disabled={saving}
                />

                {formError && (
                  <p
                    role="alert"
                    style={{ color: '#b42318', fontSize: 12 }}
                  >
                    {formError}
                  </p>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowForm(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={saving}
                  >
                    <Plus size={17} />
                    {saving ? 'Creating...' : 'Create study'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Edit study dialog */}
          {editingStudy && (
            <div
              className="modal-backdrop"
              onMouseDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  !editSaving
                ) {
                  setEditingStudy(null)
                }
              }}
            >
              <form className="study-modal" onSubmit={updateStudy}>
                <div className="modal-heading">
                  <div>
                    <h2>Edit study</h2>
                    <p>Update your study details and progress.</p>
                  </div>

                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setEditingStudy(null)}
                    disabled={editSaving}
                    aria-label="Close dialog"
                  >
                    <X />
                  </button>
                </div>

                <label htmlFor="edit-name">Study name</label>
                <input
                  id="edit-name"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  required
                  disabled={editSaving}
                />

                <label
                  htmlFor="edit-lead"
                  style={{ display: 'block', marginTop: 14 }}
                >
                  Project lead
                </label>
                <input
                  id="edit-lead"
                  value={editLead}
                  onChange={(event) => setEditLead(event.target.value)}
                  required
                  disabled={editSaving}
                />

                <label
                  htmlFor="edit-due-date"
                  style={{ display: 'block', marginTop: 14 }}
                >
                  Deadline
                </label>
                <input
                  id="edit-due-date"
                  type="date"
                  value={editDueDate}
                  onChange={(event) =>
                    setEditDueDate(event.target.value)
                  }
                  disabled={editSaving}
                />

                <label
                  htmlFor="edit-status"
                  style={{ display: 'block', marginTop: 14 }}
                >
                  Status
                </label>
                <select
                  id="edit-status"
                  value={editStatus}
                  onChange={(event) =>
                    setEditStatus(event.target.value as StudyStatus)
                  }
                  disabled={editSaving}
                  style={{
                    width: '100%',
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: '1px solid #d8dbea',
                  }}
                >
                  <option value="Active">Active</option>
                  <option value="In Review">In Review</option>
                  <option value="Completed">Completed</option>
                </select>

                <label
                  htmlFor="edit-progress"
                  style={{ display: 'block', marginTop: 14 }}
                >
                  Progress: {editProgress}%
                </label>
                <input
                  id="edit-progress"
                  type="range"
                  min={0}
                  max={100}
                  value={editProgress}
                  onChange={(event) =>
                    setEditProgress(Number(event.target.value))
                  }
                  disabled={editSaving}
                  style={{ width: '100%' }}
                />

                {editError && (
                  <p
                    role="alert"
                    style={{ color: '#b42318', fontSize: 12 }}
                  >
                    {editError}
                  </p>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setEditingStudy(null)}
                    disabled={editSaving}
                  >
                    Cancel
                  </button>

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={editSaving}
                  >
                    <Pencil size={16} />
                    {editSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <footer className="page-footer">
            SHBS <span>•</span> Portfolio demonstration using fictional
            research data
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App