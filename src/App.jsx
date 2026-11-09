import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  ClipboardList,
  Users,
  Upload,
  CheckCircle2,
  PlusCircle,
  FileText,
  Presentation,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  ExternalLink,
  BookOpen,
  Clock,
  FolderCheck,
  AlertCircle,
  RefreshCw,
  Award,
  Send,
  LogOut,
  LogIn,
  UserPlus,
  Trash2,
  Plus,
  Layers
} from 'lucide-react';
import { sb, isSupabaseConfigured } from './sb';

const SESSION_STORAGE_KEY = 'lms_sia_active_session_v2';

export default function App() {
  // Authenticated User State (null when signed out -> shows Login/Sign Up screen)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Auth Page State
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [authRole, setAuthRole] = useState('s'); // 's' (Student) | 't' (Admin)
  const [authName, setAuthName] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Navigation State
  const [activeTab, setActiveTab] = useState('stream'); // 'stream' | 'classwork' | 'people'

  // Database Entities State (100% clean — NO placeholders)
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Active Class Selection
  const [activeClassId, setActiveClassId] = useState(null);

  // UI & Form States
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Admin: Create Class State
  const [newClassName, setNewClassName] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);

  // Admin: Create Assignment State
  const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
  const [creatingAssignment, setCreatingAssignment] = useState(false);

  // Stream Announcement Composer
  const [newAnnouncement, setNewAnnouncement] = useState('');

  // Student Turn-In States (keyed by assignment id)
  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploadingMap, setUploadingMap] = useState({});
  const [expandedAssignmentId, setExpandedAssignmentId] = useState(null);

  // Admin Grading States (keyed by submission id)
  const [grades, setGrades] = useState({});

  const showToast = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  // Fetch all records from Supabase tables: u, c, a, s
  const fetchDatabaseData = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    setLoading(true);
    try {
      const [uRes, cRes, aRes, sRes] = await Promise.all([
        sb.from('u').select('*'),
        sb.from('c').select('*'),
        sb.from('a').select('*'),
        sb.from('s').select('*')
      ]);

      if (uRes.error) throw uRes.error;
      if (cRes.error) throw cRes.error;
      if (aRes.error) throw aRes.error;
      if (sRes.error) throw sRes.error;

      const uList = uRes.data || [];
      const cList = cRes.data || [];
      const aList = aRes.data || [];
      const sList = sRes.data || [];

      setUsers(uList);
      setClasses(cList);
      setAssignments(aList);
      setSubmissions(sList);

      // Sync active class selection
      setActiveClassId((prevId) => {
        if (prevId && cList.some((c) => c.id === prevId)) return prevId;
        return cList[0]?.id || null;
      });

      // Expand first assignment if none expanded
      setExpandedAssignmentId((prevExp) => {
        if (prevExp && aList.some((a) => a.id === prevExp)) return prevExp;
        return aList[0]?.id || null;
      });

      // Verify current logged-in user still exists in database `u`
      if (currentUser) {
        const matched = uList.find((u) => u.id === currentUser.id);
        if (!matched && uList.length > 0) {
          // If database was reset/truncated, sign out stale local session
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setCurrentUser(null);
        }
      }
    } catch (err) {
      console.error('Supabase fetch error:', err);
      showToast('error', `Database sync error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchDatabaseData();
  }, [fetchDatabaseData]);

  // ==================== AUTHENTICATION (SIGN IN / SIGN UP) ====================
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    const trimmedName = authName.trim();
    if (!trimmedName) {
      setAuthError('Please enter your name to continue.');
      return;
    }

    setAuthSubmitting(true);
    try {
      if (authMode === 'signup') {
        // Check if user with same name & role already exists
        const existing = users.find(
          (u) =>
            u.r === authRole &&
            u.n?.trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (existing) {
          setAuthError(
            `An account for "${trimmedName}" with role ${
              authRole === 't' ? 'Admin' : 'Student'
            } already exists. Please switch to Sign In.`
          );
          setAuthSubmitting(false);
          return;
        }

        const payload = { r: authRole, n: trimmedName };
        if (isSupabaseConfigured) {
          const { data, error } = await sb.from('u').insert([payload]).select();
          if (error) throw error;
          const createdUser = data?.[0];
          if (!createdUser) throw new Error('Failed to create user record.');
          setUsers((prev) => [...prev, createdUser]);
          setCurrentUser(createdUser);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(createdUser));
        } else {
          const createdUser = { ...payload, id: crypto.randomUUID() };
          setUsers((prev) => [...prev, createdUser]);
          setCurrentUser(createdUser);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(createdUser));
        }
        setAuthName('');
      } else {
        // Sign In mode: query fresh from Supabase `u` table
        let userList = users;
        if (isSupabaseConfigured) {
          const { data, error } = await sb.from('u').select('*');
          if (error) throw error;
          userList = data || [];
          setUsers(userList);
        }

        const matchedUser = userList.find(
          (u) =>
            u.r === authRole &&
            u.n?.trim().toLowerCase() === trimmedName.toLowerCase()
        );

        if (!matchedUser) {
          setAuthError(
            `No ${
              authRole === 't' ? 'Admin' : 'Student'
            } account found with name "${trimmedName}". Switch to "Sign Up" to create your account first.`
          );
          setAuthSubmitting(false);
          return;
        }

        setCurrentUser(matchedUser);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(matchedUser));
        setAuthName('');
      }
    } catch (err) {
      setAuthError(
        err.message?.includes('row-level security')
          ? `Supabase RLS policy blocked access on table "u". Please run the updated supabase/schema.sql in your Supabase SQL Editor.`
          : err.message
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setCurrentUser(null);
    setActiveTab('stream');
    setAuthError(null);
  };

  // ==================== ADMIN: CREATE CLASS (`c` table) ====================
  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!currentUser || currentUser.r !== 't') return;
    const trimmed = newClassName.trim();
    if (!trimmed) return;

    setCreatingClass(true);
    const payload = {
      nm: trimmed,
      t_id: currentUser.id
    };

    try {
      if (isSupabaseConfigured) {
        const { data, error } = await sb.from('c').insert([payload]).select();
        if (error) throw error;
        const created = data?.[0];
        setClasses((prev) => [...prev, created]);
        setActiveClassId(created.id);
      } else {
        const created = { ...payload, id: crypto.randomUUID() };
        setClasses((prev) => [...prev, created]);
        setActiveClassId(created.id);
      }
      setNewClassName('');
      setShowCreateClassModal(false);
      showToast('success', `Class "${trimmed}" created in table 'c'.`);
    } catch (err) {
      showToast('error', `Failed to create class: ${err.message}`);
    } finally {
      setCreatingClass(false);
    }
  };

  // ==================== ADMIN: CREATE ASSIGNMENT (`a` table) ====================
  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!currentUser || currentUser.r !== 't') return;
    const trimmed = newAssignmentTitle.trim();
    if (!trimmed) return;

    if (!currentClass) {
      showToast('error', 'Please create a class first before adding assignments.');
      return;
    }

    setCreatingAssignment(true);
    const newRecord = {
      c_id: currentClass.id,
      ttl: trimmed
    };

    try {
      if (isSupabaseConfigured) {
        const { data, error } = await sb.from('a').insert([newRecord]).select();
        if (error) throw error;
        const created = data?.[0];
        setAssignments((prev) => [created, ...prev]);
        setExpandedAssignmentId(created.id);
      } else {
        const created = { ...newRecord, id: crypto.randomUUID() };
        setAssignments((prev) => [created, ...prev]);
        setExpandedAssignmentId(created.id);
      }
      setNewAssignmentTitle('');
      showToast('success', `Assignment "${trimmed}" published to Stream & Classwork.`);
    } catch (err) {
      showToast('error', `Failed to create assignment: ${err.message}`);
    } finally {
      setCreatingAssignment(false);
    }
  };

  // Admin: Delete Assignment
  const handleDeleteAssignment = async (assignmentId) => {
    if (!currentUser || currentUser.r !== 't') return;
    try {
      if (isSupabaseConfigured) {
        const { error } = await sb.from('a').delete().eq('id', assignmentId);
        if (error) throw error;
      }
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      setSubmissions((prev) => prev.filter((s) => s.a_id !== assignmentId));
      showToast('success', 'Assignment removed.');
    } catch (err) {
      showToast('error', `Failed to delete assignment: ${err.message}`);
    }
  };

  // ==================== STUDENT: TURN IN FILE (`b` bucket + `s` table) ====================
  const handleFileChange = (assignmentId, file) => {
    if (!file) return;
    setSelectedFiles((prev) => ({ ...prev, [assignmentId]: file }));
  };

  const handleTurnIn = async (e, assignment) => {
    e.preventDefault();
    if (!currentUser || currentUser.r !== 's') return;

    const file = selectedFiles[assignment.id];
    if (!file) {
      showToast('error', 'Please select a .ppt, .pptx, or exercise file before turning in.');
      return;
    }

    setUploadingMap((prev) => ({ ...prev, [assignment.id]: true }));

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${assignment.id}/${currentUser.id}_${Date.now()}_${safeFileName}`;

    try {
      if (isSupabaseConfigured) {
        // 1. Upload file directly to Supabase Storage bucket 'b'
        const { error: uploadError } = await sb.storage
          .from('b')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType:
              file.type ||
              'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          });

        if (uploadError) throw uploadError;

        // 2. Insert submission record into table 's'
        const submissionPayload = {
          a_id: assignment.id,
          u_id: currentUser.id,
          pth: storagePath
        };

        const { data: subData, error: dbError } = await sb
          .from('s')
          .insert([submissionPayload])
          .select();

        if (dbError) throw dbError;

        const insertedSub = subData?.[0];
        setSubmissions((prev) => [...prev, insertedSub]);
      } else {
        const insertedSub = {
          id: crypto.randomUUID(),
          a_id: assignment.id,
          u_id: currentUser.id,
          pth: storagePath
        };
        setSubmissions((prev) => [...prev, insertedSub]);
      }

      setSelectedFiles((prev) => {
        const next = { ...prev };
        delete next[assignment.id];
        return next;
      });
      showToast('success', `Successfully turned in "${file.name}"!`);
    } catch (err) {
      showToast('error', `Upload failed: ${err.message}`);
    } finally {
      setUploadingMap((prev) => ({ ...prev, [assignment.id]: false }));
    }
  };

  // Post stream announcement
  const handlePostAnnouncement = (e) => {
    e.preventDefault();
    if (!newAnnouncement.trim() || !currentUser || !currentClass) return;
    const item = {
      id: `ann-${Date.now()}`,
      c_id: currentClass.id,
      author: currentUser.n,
      role: currentUser.r,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: newAnnouncement.trim()
    };
    setAnnouncements((prev) => [item, ...prev]);
    setNewAnnouncement('');
    showToast('success', 'Posted announcement to class stream.');
  };

  const getStorageUrl = (pth) => {
    if (!pth) return '#';
    if (isSupabaseConfigured) {
      const { data } = sb.storage.from('b').getPublicUrl(pth);
      return data?.publicUrl || '#';
    }
    return `#`;
  };

  // Derived data
  const admins = users.filter((u) => u.r === 't');
  const students = users.filter((u) => u.r === 's');
  const currentClass = classes.find((c) => c.id === activeClassId) || classes[0] || null;
  const classAssignments = currentClass
    ? assignments.filter((a) => a.c_id === currentClass.id)
    : [];
  const classAnnouncements = currentClass
    ? announcements.filter((ann) => ann.c_id === currentClass.id)
    : [];

  // ==================== RENDER LOGIN / SIGN UP PAGE IF NOT AUTHENTICATED ====================
  if (!currentUser) {
    const matchingRoleUsers = users.filter((u) => u.r === authRole);

    return (
      <div className="auth-page-wrapper">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="brand-logo large">
              <GraduationCap size={28} />
            </div>
            <div>
              <h1>SIA Classroom LMS</h1>
              <p>Select your role and sign in or create an account to continue</p>
            </div>
          </div>

          {/* Step 1: Choose Role (Student or Admin) */}
          <div className="auth-section">
            <label className="auth-label">1. Choose Your Role</label>
            <div className="auth-role-grid" role="radiogroup" aria-label="Select Role">
              <button
                type="button"
                className={`auth-role-option ${authRole === 's' ? 'selected' : ''}`}
                onClick={() => {
                  setAuthRole('s');
                  setAuthError(null);
                }}
              >
                <div className="role-option-icon student">
                  <UserCheck size={22} />
                </div>
                <div className="role-option-text">
                  <strong>Student</strong>
                  <span>View stream &amp; turn in .ppt / .pptx classwork</span>
                </div>
              </button>

              <button
                type="button"
                className={`auth-role-option ${authRole === 't' ? 'selected' : ''}`}
                onClick={() => {
                  setAuthRole('t');
                  setAuthError(null);
                }}
              >
                <div className="role-option-icon admin">
                  <ShieldCheck size={22} />
                </div>
                <div className="role-option-text">
                  <strong>Admin / Teacher</strong>
                  <span>Create classes, post assignments &amp; grade submissions</span>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Sign In vs Sign Up Tabs */}
          <div className="auth-mode-tabs">
            <button
              type="button"
              className={`auth-tab ${authMode === 'signin' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('signin');
                setAuthError(null);
              }}
            >
              <LogIn size={16} />
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('signup');
                setAuthError(null);
              }}
            >
              <UserPlus size={16} />
              Sign Up (New Account)
            </button>
          </div>

          {authError && (
            <div className="auth-error-box" role="alert">
              <AlertCircle size={17} />
              <span>{authError}</span>
            </div>
          )}

          {/* Auth Form */}
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <div className="form-field">
              <label htmlFor="auth-name-input">
                {authMode === 'signup'
                  ? `Your Full Name (Creates ${authRole === 't' ? 'Admin' : 'Student'} in table 'u')`
                  : `Enter Your Registered ${authRole === 't' ? 'Admin' : 'Student'} Name`}
              </label>
              <input
                id="auth-name-input"
                type="text"
                placeholder={
                  authRole === 't' ? 'e.g., Prof. Santos' : 'e.g., Juan Dela Cruz'
                }
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                required
              />
            </div>

            {/* Quick pick existing accounts when signing in */}
            {authMode === 'signin' && matchingRoleUsers.length > 0 && (
              <div className="existing-accounts-hint">
                <span>Registered {authRole === 't' ? 'Admins' : 'Students'}:</span>
                <div className="account-chips">
                  {matchingRoleUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className={`account-chip ${
                        authName.toLowerCase() === u.n?.toLowerCase() ? 'active' : ''
                      }`}
                      onClick={() => setAuthName(u.n)}
                    >
                      {u.n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {authMode === 'signin' && matchingRoleUsers.length === 0 && (
              <div className="empty-db-notice">
                No {authRole === 't' ? 'Admin' : 'Student'} accounts exist in the database yet.
                Switch to <strong>Sign Up</strong> above to create the first account!
              </div>
            )}

            <button
              type="submit"
              className="btn-primary auth-submit-btn"
              disabled={authSubmitting || !authName.trim()}
            >
              {authSubmitting
                ? 'Please wait...'
                : authMode === 'signup'
                ? `Create ${authRole === 't' ? 'Admin' : 'Student'} Account & Enter`
                : `Sign In as ${authRole === 't' ? 'Admin' : 'Student'}`}
            </button>
          </form>

          <div className="auth-footer-status">
            <span className={`status-dot ${isSupabaseConfigured ? 'live' : 'demo'}`} />
            <span>
              {isSupabaseConfigured
                ? 'Connected to Supabase PostgreSQL & Storage'
                : 'Supabase environment variables not detected'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.r === 't';

  // ==================== RENDER MAIN LMS APPLICATION ====================
  return (
    <div className="lms-shell">
      {/* MS Teams Style Left Sidebar (Desktop) & Bottom Bar (Mobile) */}
      <aside className="teams-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo" aria-hidden="true">
            <GraduationCap size={22} />
          </div>
          <div className="brand-text">
            <span className="brand-title">SIA LMS</span>
            <span className="brand-subtitle">
              {isAdmin ? 'Admin Portal' : 'Student Portal'}
            </span>
          </div>
        </div>

        {/* Class Switcher in Sidebar */}
        <div className="sidebar-class-section">
          <div className="sidebar-section-header">
            <span>CLASSES (`c`)</span>
            {isAdmin && (
              <button
                type="button"
                className="sidebar-add-btn"
                onClick={() => setShowCreateClassModal((v) => !v)}
                title="Create New Class"
              >
                <Plus size={14} /> New
              </button>
            )}
          </div>

          {classes.length === 0 ? (
            <div className="sidebar-empty-classes">
              {isAdmin
                ? 'No classes yet. Click "+ New" to create your first class.'
                : 'No classes created by Admin yet.'}
            </div>
          ) : (
            <div className="class-picker-list">
              {classes.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  className={`class-item-btn ${
                    currentClass?.id === cls.id ? 'active' : ''
                  }`}
                  onClick={() => setActiveClassId(cls.id)}
                >
                  <Layers size={15} />
                  <span className="class-item-name">{cls.nm}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav className="sidebar-nav" aria-label="Main Navigation">
          <button
            type="button"
            className={`nav-item ${activeTab === 'stream' ? 'active' : ''}`}
            onClick={() => setActiveTab('stream')}
          >
            <MessageSquare size={20} />
            <span>Stream</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'classwork' ? 'active' : ''}`}
            onClick={() => setActiveTab('classwork')}
          >
            <ClipboardList size={20} />
            <span>Classwork</span>
            <span className="nav-badge">{classAssignments.length}</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'people' ? 'active' : ''}`}
            onClick={() => setActiveTab('people')}
          >
            <Users size={20} />
            <span>People</span>
          </button>
        </nav>

        {/* Locked User Session Card & Sign Out */}
        <div className="sidebar-footer">
          <div className="session-card">
            <div className="current-user-chip">
              <div className={`avatar-circle ${isAdmin ? 'teacher-avatar' : ''}`}>
                {currentUser.n?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="user-meta">
                <div className="user-name">{currentUser.n}</div>
                <div className="user-role-code">
                  <span className={`role-pill ${isAdmin ? 'teacher' : 'student'}`}>
                    {isAdmin ? 'Admin' : 'Student'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="signout-btn"
              onClick={handleSignOut}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="db-status-bar">
            <span
              className={`status-dot ${isSupabaseConfigured ? 'live' : 'demo'}`}
            />
            <span className="status-text">
              {isSupabaseConfigured ? 'Supabase Live' : 'Offline Mode'}
            </span>
            <button
              type="button"
              className="icon-refresh-btn"
              onClick={fetchDatabaseData}
              title="Refresh data from Supabase"
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </aside>

      {/* Google Classroom Style Main Content Area */}
      <div className="classroom-main-wrapper">
        {/* Top Context Header */}
        <header className="top-app-bar">
          <div className="top-bar-left">
            <BookOpen size={18} className="top-bar-icon" />
            <span className="top-bar-course">
              {currentClass ? currentClass.nm : 'No Class Selected'}
            </span>
          </div>

          <div className="top-bar-right">
            <span className={`top-role-badge ${isAdmin ? 'admin' : 'student'}`}>
              {isAdmin ? 'Admin' : 'Student'}: {currentUser.n}
            </span>
            <button
              type="button"
              className="top-signout-btn"
              onClick={handleSignOut}
              title="Sign Out"
            >
              <LogOut size={16} />
              <span className="hide-mobile">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Status Toast Notification */}
        {statusMessage && (
          <div className={`toast-banner ${statusMessage.type}`} role="status">
            {statusMessage.type === 'error' ? (
              <AlertCircle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Vertically Scrolling Central Feed */}
        <main className="classroom-feed-container">
          {/* Admin Create Class Form (shown when no class exists yet or when toggled) */}
          {isAdmin && (classes.length === 0 || showCreateClassModal) && (
            <section className="teacher-create-card create-class-banner">
              <div className="card-header-row">
                <div>
                  <h2>
                    <PlusCircle size={20} />
                    {classes.length === 0
                      ? 'Welcome Admin! Create Your First Class'
                      : 'Create a New Class'}
                  </h2>
                  <p>
                    Creates a new class record in Supabase table <code>c</code> linked to your
                    Admin account (<strong>{currentUser.n}</strong>).
                  </p>
                </div>
              </div>

              <form className="create-assignment-form" onSubmit={handleCreateClass}>
                <input
                  type="text"
                  placeholder="e.g., SIA-301: Systems Integration & Architecture"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={creatingClass || !newClassName.trim()}
                >
                  <PlusCircle size={17} />
                  {creatingClass ? 'Creating...' : 'Create Class'}
                </button>
                {classes.length > 0 && (
                  <button
                    type="button"
                    className="btn-outline-sm"
                    onClick={() => setShowCreateClassModal(false)}
                  >
                    Cancel
                  </button>
                )}
              </form>
            </section>
          )}

          {/* Empty State if no class exists yet */}
          {!currentClass ? (
            <div className="empty-workspace-card">
              <GraduationCap size={42} className="empty-icon" />
              <h2>No Classes Available Yet</h2>
              <p>
                {isAdmin
                  ? 'Use the form above to create your first class in table "c". Once created, you can post assignments and announcements.'
                  : 'An Admin has not created any classes yet. Please check back once your instructor sets up the class.'}
              </p>
            </div>
          ) : (
            <>
              {/* Course Hero Banner (Google Classroom Style) */}
              <section className="course-banner">
                <div className="banner-content">
                  <div className="banner-tag">Class ID: {currentClass.id.slice(0, 8)}</div>
                  <h1>{currentClass.nm}</h1>
                  <p className="banner-teacher">
                    Instructor:{' '}
                    {admins.find((t) => t.id === currentClass.t_id)?.n ||
                      (isAdmin ? currentUser.n : 'Admin')}
                  </p>
                </div>
                <div className="banner-stats">
                  <div className="stat-box">
                    <span className="stat-num">{classAssignments.length}</span>
                    <span className="stat-lbl">Assignments</span>
                  </div>
                  {isAdmin && (
                    <div className="stat-box">
                      <span className="stat-num">
                        {
                          submissions.filter((s) =>
                            classAssignments.some((a) => a.id === s.a_id)
                          ).length
                        }
                      </span>
                      <span className="stat-lbl">Submissions</span>
                    </div>
                  )}
                </div>
              </section>

              {/* ==================== STREAM VIEW ==================== */}
              {activeTab === 'stream' && (
                <div className="stream-layout">
                  {/* Left Column: Upcoming Work Box */}
                  <aside className="upcoming-card">
                    <h3>
                      <Clock size={16} />
                      Upcoming Work
                    </h3>
                    {classAssignments.length === 0 ? (
                      <p className="upcoming-empty">No assignments posted yet.</p>
                    ) : (
                      <ul className="upcoming-list">
                        {classAssignments.slice(0, 4).map((item) => {
                          const isDone = submissions.some(
                            (s) => s.a_id === item.id && s.u_id === currentUser.id
                          );
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                className="upcoming-link"
                                onClick={() => {
                                  setExpandedAssignmentId(item.id);
                                  setActiveTab('classwork');
                                }}
                              >
                                <span className="upcoming-title">{item.ttl}</span>
                                {!isAdmin && (
                                  <span
                                    className={`mini-status ${
                                      isDone ? 'done' : 'pending'
                                    }`}
                                  >
                                    {isDone ? 'Turned in' : 'Assigned'}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <button
                      type="button"
                      className="view-all-btn"
                      onClick={() => setActiveTab('classwork')}
                    >
                      Open Classwork →
                    </button>
                  </aside>

                  {/* Central Vertical Stream Feed */}
                  <div className="stream-feed">
                    {/* Quick Announcement Composer */}
                    <form
                      className="stream-composer-card"
                      onSubmit={handlePostAnnouncement}
                    >
                      <div className="composer-row">
                        <div
                          className={`avatar-circle ${
                            isAdmin ? 'teacher-avatar' : ''
                          }`}
                        >
                          {currentUser.n?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <input
                          type="text"
                          placeholder={`Share an announcement with ${currentClass.nm}...`}
                          value={newAnnouncement}
                          onChange={(e) => setNewAnnouncement(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={!newAnnouncement.trim()}
                        >
                          <Send size={15} />
                          Post
                        </button>
                      </div>
                    </form>

                    {/* Stream Feed Items: Assignments from `a` table */}
                    <div className="feed-section-label">
                      <span>Classwork Stream</span>
                      {isAdmin && (
                        <button
                          type="button"
                          className="link-action"
                          onClick={() => setActiveTab('classwork')}
                        >
                          + Create new assignment
                        </button>
                      )}
                    </div>

                    {classAssignments.length === 0 ? (
                      <div className="empty-stream-box">
                        <Presentation size={28} />
                        <p>
                          {isAdmin
                            ? 'No assignments posted yet. Go to the Classwork tab to create your first assignment.'
                            : 'Your instructor has not posted any assignments yet.'}
                        </p>
                      </div>
                    ) : (
                      classAssignments.map((assignment) => {
                        const subCount = submissions.filter(
                          (s) => s.a_id === assignment.id
                        ).length;
                        const studentSub = submissions.find(
                          (s) =>
                            s.a_id === assignment.id && s.u_id === currentUser.id
                        );

                        return (
                          <article
                            key={assignment.id}
                            className="stream-item-card assignment-stream-card"
                            onClick={() => {
                              setExpandedAssignmentId(assignment.id);
                              setActiveTab('classwork');
                            }}
                          >
                            <div className="stream-icon-wrap">
                              <Presentation size={20} />
                            </div>
                            <div className="stream-item-body">
                              <div className="stream-item-header">
                                <h4>New Assignment: {assignment.ttl}</h4>
                                <span className="stream-meta">
                                  Click to view details in Classwork
                                </span>
                              </div>
                            </div>
                            <div className="stream-item-Action">
                              {isAdmin ? (
                                <span className="submission-counter-pill">
                                  {subCount}{' '}
                                  {subCount === 1 ? 'submission' : 'submissions'}
                                </span>
                              ) : studentSub ? (
                                <span className="status-badge turned-in">
                                  <CheckCircle2 size={14} /> Turned In
                                </span>
                              ) : (
                                <span className="status-badge assigned">
                                  Turn In →
                                </span>
                              )}
                            </div>
                          </article>
                        );
                      })
                    )}

                    {/* Announcements List */}
                    {classAnnouncements.length > 0 && (
                      <>
                        <div className="feed-section-label">
                          <span>Class Announcements</span>
                        </div>
                        {classAnnouncements.map((ann) => (
                          <article
                            key={ann.id}
                            className="stream-item-card announcement-card"
                          >
                            <div className="announcement-header">
                              <div
                                className={`avatar-circle ${
                                  ann.role === 't' ? 'teacher-avatar' : ''
                                }`}
                              >
                                {ann.author.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="ann-author">
                                  {ann.author}
                                  <span className="ann-role-tag">
                                    {ann.role === 't' ? 'Admin' : 'Student'}
                                  </span>
                                </div>
                                <div className="ann-date">{ann.date}</div>
                              </div>
                            </div>
                            <p className="announcement-text">{ann.content}</p>
                          </article>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== CLASSWORK VIEW ==================== */}
              {activeTab === 'classwork' && (
                <div className="classwork-layout">
                  {/* ADMIN ONLY: Create Assignment Form */}
                  {isAdmin && (
                    <section className="teacher-create-card">
                      <div className="card-header-row">
                        <div>
                          <h2>
                            <PlusCircle size={20} />
                            Create New Assignment
                          </h2>
                          <p>
                            Publishes a new assignment to table <code>a</code> for{' '}
                            <strong>{currentClass.nm}</strong>.
                          </p>
                        </div>
                      </div>

                      <form
                        className="create-assignment-form"
                        onSubmit={handleCreateAssignment}
                      >
                        <input
                          type="text"
                          placeholder="e.g., Week 7 Presentation: The Awakening (.pptx)"
                          value={newAssignmentTitle}
                          onChange={(e) => setNewAssignmentTitle(e.target.value)}
                          required
                        />
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={
                            creatingAssignment || !newAssignmentTitle.trim()
                          }
                        >
                          <PlusCircle size={17} />
                          {creatingAssignment ? 'Publishing...' : 'Assign to Class'}
                        </button>
                      </form>
                    </section>
                  )}

                  {/* Section Header */}
                  <div className="classwork-section-header">
                    <div>
                      <h2>
                        {isAdmin
                          ? 'Published Assignments & Student Submissions'
                          : 'Your Classwork & Presentation Submissions'}
                      </h2>
                      <p>
                        {isAdmin
                          ? 'Click an assignment to inspect and grade student files uploaded to Supabase Storage bucket "b".'
                          : 'Select an assignment below to upload your .ppt / .pptx presentation or exercise.'}
                      </p>
                    </div>
                  </div>

                  {/* Assignment Cards List */}
                  {classAssignments.length === 0 ? (
                    <div className="empty-stream-box">
                      <ClipboardList size={32} />
                      <p>
                        {isAdmin
                          ? 'No assignments created yet. Use the form above to publish your first assignment!'
                          : 'No assignments have been posted for this class yet.'}
                      </p>
                    </div>
                  ) : (
                    <div className="classwork-list">
                      {classAssignments.map((assignment) => {
                        const isExpanded = expandedAssignmentId === assignment.id;
                        const assignmentSubmissions = submissions.filter(
                          (s) => s.a_id === assignment.id
                        );
                        const mySubmissions = assignmentSubmissions.filter(
                          (s) => s.u_id === currentUser.id
                        );
                        const isTurnedIn = mySubmissions.length > 0;
                        const selectedFile = selectedFiles[assignment.id];
                        const isUploading = Boolean(uploadingMap[assignment.id]);

                        return (
                          <div
                            key={assignment.id}
                            className={`classwork-card ${
                              isExpanded ? 'expanded' : ''
                            }`}
                          >
                            {/* Assignment Header Bar */}
                            <div
                              className="classwork-card-header"
                              onClick={() =>
                                setExpandedAssignmentId(
                                  isExpanded ? null : assignment.id
                                )
                              }
                            >
                              <div className="cw-title-group">
                                <div className="cw-icon">
                                  <Presentation size={20} />
                                </div>
                                <div>
                                  <h3>{assignment.ttl}</h3>
                                  <span className="cw-submeta">
                                    Accepts <code>.ppt</code>, <code>.pptx</code> &amp;
                                    exercise files
                                  </span>
                                </div>
                              </div>

                              <div className="cw-header-right">
                                {isAdmin ? (
                                  <div className="teacher-turnin-stats">
                                    <div className="stat-pill">
                                      <strong>{assignmentSubmissions.length}</strong>{' '}
                                      Turned In
                                    </div>
                                    <button
                                      type="button"
                                      className="btn-icon-danger"
                                      title="Delete Assignment"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAssignment(assignment.id);
                                      }}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                ) : isTurnedIn ? (
                                  <span className="status-badge turned-in">
                                    <CheckCircle2 size={15} /> Turned In
                                  </span>
                                ) : (
                                  <span className="status-badge assigned">
                                    Assigned
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Assignment Body */}
                            {isExpanded && (
                              <div className="classwork-card-body">
                                {!isAdmin ? (
                                  /* STUDENT ROLE: Turn-In Form */
                                  <div className="student-turnin-grid">
                                    <div className="assignment-instructions">
                                      <h4>Submission Instructions</h4>
                                      <p>
                                        Attach your presentation file (
                                        <code>.ppt</code> or <code>.pptx</code>) or
                                        exercise document and click{' '}
                                        <strong>Turn In Presentation</strong>.
                                      </p>

                                      {isTurnedIn && (
                                        <div className="previous-submissions-box">
                                          <h5>
                                            <FolderCheck size={16} /> Your Submitted
                                            Files
                                          </h5>
                                          <ul>
                                            {mySubmissions.map((sub) => (
                                              <li
                                                key={sub.id}
                                                className="submitted-file-row"
                                              >
                                                <FileText size={16} />
                                                <span
                                                  className="file-pth"
                                                  title={sub.pth}
                                                >
                                                  {sub.pth.split('/').pop()}
                                                </span>
                                                {grades[sub.id] && (
                                                  <span className="grade-chip">
                                                    Grade: {grades[sub.id]}
                                                  </span>
                                                )}
                                                <a
                                                  href={getStorageUrl(sub.pth)}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="file-download-link"
                                                >
                                                  <ExternalLink size={14} /> View File
                                                </a>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>

                                    <form
                                      className="turn-in-box"
                                      onSubmit={(e) => handleTurnIn(e, assignment)}
                                      encType="multipart/form-data"
                                    >
                                      <div className="turn-in-box-header">
                                        <h4>Your Work</h4>
                                        <span
                                          className={`turn-in-state ${
                                            isTurnedIn ? 'done' : 'pending'
                                          }`}
                                        >
                                          {isTurnedIn ? 'Turned in' : 'Assigned'}
                                        </span>
                                      </div>

                                      <label
                                        htmlFor={`file-upload-${assignment.id}`}
                                        className="file-dropzone"
                                      >
                                        <Upload size={24} className="upload-icon" />
                                        <span className="dropzone-title">
                                          {selectedFile
                                            ? selectedFile.name
                                            : 'Click to choose .ppt / .pptx or exercise file'}
                                        </span>
                                        <span className="dropzone-hint">
                                          {selectedFile
                                            ? `${(selectedFile.size / 1024).toFixed(
                                                1
                                              )} KB selected`
                                            : 'Supports .ppt, .pptx, .pdf, .docx, .zip'}
                                        </span>
                                        <input
                                          id={`file-upload-${assignment.id}`}
                                          type="file"
                                          accept=".ppt,.pptx,.pdf,.doc,.docx,.zip,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                          onChange={(e) =>
                                            handleFileChange(
                                              assignment.id,
                                              e.target.files?.[0]
                                            )
                                          }
                                        />
                                      </label>

                                      <button
                                        type="submit"
                                        className="btn-turn-in"
                                        disabled={!selectedFile || isUploading}
                                      >
                                        <Upload size={16} />
                                        {isUploading
                                          ? 'Uploading...'
                                          : isTurnedIn
                                          ? 'Resubmit File'
                                          : 'Turn In Presentation'}
                                      </button>
                                    </form>
                                  </div>
                                ) : (
                                  /* ADMIN ROLE: Student Submissions & Grading View */
                                  <div className="teacher-grading-view">
                                    <div className="grading-header">
                                      <h4>
                                        <Award size={17} /> Student Submissions (
                                        {assignmentSubmissions.length})
                                      </h4>
                                    </div>

                                    {assignmentSubmissions.length === 0 ? (
                                      <div className="empty-submissions">
                                        No students have submitted files for this
                                        assignment yet.
                                      </div>
                                    ) : (
                                      <div className="submissions-table-wrapper">
                                        <table className="submissions-table">
                                          <thead>
                                            <tr>
                                              <th>Student</th>
                                              <th>Uploaded File (`s.pth`)</th>
                                              <th>Grade</th>
                                              <th>File Link</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {assignmentSubmissions.map((sub) => {
                                              const studentObj = users.find(
                                                (u) => u.id === sub.u_id
                                              );
                                              return (
                                                <tr key={sub.id}>
                                                  <td>
                                                    <div className="student-cell">
                                                      <div className="avatar-circle small">
                                                        {(studentObj?.n || 'S')
                                                          .charAt(0)
                                                          .toUpperCase()}
                                                      </div>
                                                      <div>
                                                        <div className="student-cell-name">
                                                          {studentObj?.n ||
                                                            'Student'}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </td>
                                                  <td>
                                                    <code className="storage-path-code">
                                                      {sub.pth}
                                                    </code>
                                                  </td>
                                                  <td>
                                                    <input
                                                      type="text"
                                                      className="grade-input"
                                                      placeholder="e.g. 95/100"
                                                      value={grades[sub.id] || ''}
                                                      onChange={(e) =>
                                                        setGrades((prev) => ({
                                                          ...prev,
                                                          [sub.id]: e.target.value
                                                        }))
                                                      }
                                                    />
                                                  </td>
                                                  <td>
                                                    <a
                                                      href={getStorageUrl(sub.pth)}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="btn-outline-sm"
                                                    >
                                                      <ExternalLink size={14} /> Open
                                                      File
                                                    </a>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ==================== PEOPLE VIEW ==================== */}
              {activeTab === 'people' && (
                <div className="people-layout">
                  <div className="people-group-card">
                    <div className="people-header">
                      <h2>Admins / Instructors</h2>
                      <span className="people-count">{admins.length}</span>
                    </div>
                    {admins.length === 0 ? (
                      <p className="empty-people-note">No admins registered yet.</p>
                    ) : (
                      <ul className="people-list">
                        {admins.map((t) => (
                          <li key={t.id} className="person-row">
                            <div className="avatar-circle teacher-avatar">
                              {t.n?.charAt(0).toUpperCase()}
                            </div>
                            <div className="person-info">
                              <span className="person-name">
                                {t.n} {t.id === currentUser.id && '(You)'}
                              </span>
                              <span className="person-meta">Role: Admin</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="people-group-card">
                    <div className="people-header">
                      <h2>Students</h2>
                      <span className="people-count">
                        {students.length}{' '}
                        {students.length === 1 ? 'student' : 'students'}
                      </span>
                    </div>
                    {students.length === 0 ? (
                      <p className="empty-people-note">
                        No students have signed up yet.
                      </p>
                    ) : (
                      <ul className="people-list">
                        {students.map((st) => {
                          const subCount = submissions.filter(
                            (s) => s.u_id === st.id
                          ).length;
                          return (
                            <li key={st.id} className="person-row">
                              <div className="avatar-circle">
                                {st.n?.charAt(0).toUpperCase()}
                              </div>
                              <div className="person-info">
                                <span className="person-name">
                                  {st.n} {st.id === currentUser.id && '(You)'}
                                </span>
                                <span className="person-meta">Role: Student</span>
                              </div>
                              {isAdmin && (
                                <span className="student-sub-badge">
                                  {subCount}{' '}
                                  {subCount === 1 ? 'submission' : 'submissions'}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
