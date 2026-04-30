import React from 'react';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getSocket } from '../realtime/socket.js';
import { useToast } from '../context/ToastContext.jsx';
import LoadingSkeleton from '../components/LoadingSkeleton.jsx';

function getUrgency(deadline) {
  const dueAt = new Date(deadline).getTime();
  const now = Date.now();
  const diffMs = dueAt - now;
  const within24Hours = diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;

  if (!within24Hours) {
    return { urgent: false, label: '' };
  }

  const diffHours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
  return { urgent: true, label: `Due in ${diffHours}h` };
}

function verificationTier(lawyer) {
  if (lawyer.verified || lawyer.bar_verification_status === 'verified') return 'Bar Verified';
  if (lawyer.bar_verification_status === 'pending') return 'Verification Pending';
  return 'Unverified';
}

function TaskCard({ task, onAccept, onComplete, currentUserId }) {
  const canAccept = task.status === 'open' && task.creator_id !== currentUserId;
  const canComplete = task.status === 'accepted' && task.accepted_by === currentUserId;
  const { urgent, label } = getUrgency(task.deadline);
  const showUrgency = urgent && task.status !== 'completed';

  return (
    <article className={`card task-card ${showUrgency ? 'urgent' : ''}`}>
      <div className="task-card-header">
        <h4>{task.courthouse_location}</h4>
        {showUrgency ? <span className="urgent-badge">{label}</span> : null}
      </div>
      <p>{task.description}</p>
      <p><strong>Deadline:</strong> {new Date(task.deadline).toLocaleString()}</p>
      <p><strong>Status:</strong> {task.status}</p>
      <p><strong>Posted by:</strong> {task.creator_name || task.creator_id}</p>
      {task.accepted_lawyer_name ? <p><strong>Accepted by:</strong> {task.accepted_lawyer_name}</p> : null}

      {canAccept ? (
        <button type="button" onClick={() => onAccept(task.id)}>
          Accept Task
        </button>
      ) : null}

      {canComplete ? (
        <button type="button" className="secondary" onClick={() => onComplete(task.id)}>
          Mark Completed
        </button>
      ) : null}
    </article>
  );
}

export default function TaskListPage() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [courthouses, setCourthouses] = useState([]);
  const [courthouseFilter, setCourthouseFilter] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [lawyerSearch, setLawyerSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [taskSort, setTaskSort] = useState('deadline');
  const [lawyers, setLawyers] = useState([]);
  const [openTasks, setOpenTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [lawyerList, openTaskList, mine] = await Promise.all([
        api.getLawyers(token, courthouseFilter, verifiedOnly),
        api.getOpenTasks(token, courthouseFilter),
        api.getMyTasks(token),
      ]);
      setLawyers(lawyerList);
      setOpenTasks(openTaskList);
      setMyTasks(mine);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const list = await api.getCourthouses();
        setCourthouses(list);
      } catch (err) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        await loadData();
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onAvailabilityUpdate = (payload) => {
      setLawyers((prev) =>
        prev.map((lawyer) =>
          lawyer.id === payload.userId
            ? {
                ...lawyer,
                availability_status: payload.availabilityStatus,
                busyness_status: payload.busynessStatus,
              }
            : lawyer
        )
      );
    };

    socket.on('availability:update', onAvailabilityUpdate);
    return () => {
      socket.off('availability:update', onAvailabilityUpdate);
    };
  }, []);

  const acceptTask = async (taskId) => {
    try {
      await api.acceptTask(token, taskId);
      toast.success('Task accepted.');
      await loadData();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  const completeTask = async (taskId) => {
    try {
      await api.completeTask(token, taskId);
      toast.success('Task marked completed.');
      await loadData();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  const filteredLawyers = lawyers
    .filter((lawyer) => {
      if (availabilityFilter === 'available') return lawyer.availability_status === 'available';
      if (availabilityFilter === 'free') return lawyer.busyness_status === 'free';
      return true;
    })
    .filter((lawyer) => {
      const haystack = `${lawyer.name} ${lawyer.practice_area} ${lawyer.nearest_courthouse}`.toLowerCase();
      return haystack.includes(lawyerSearch.toLowerCase());
    });

  const filteredOpenTasks = openTasks
    .filter((task) => {
      const haystack = `${task.description} ${task.courthouse_location} ${task.creator_name || ''}`.toLowerCase();
      return haystack.includes(taskSearch.toLowerCase());
    })
    .sort((a, b) => {
      if (taskSort === 'deadline') return new Date(a.deadline) - new Date(b.deadline);
      if (taskSort === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      return a.courthouse_location.localeCompare(b.courthouse_location);
    });

  const urgentOpenCount = filteredOpenTasks.filter((task) => getUrgency(task.deadline).urgent).length;

  return (
    <section className="stack">
      <h2>Task Marketplace</h2>

      <div className="card-grid">
        <article className="card">
          <h3>Open Tasks</h3>
          <p><strong>{filteredOpenTasks.length}</strong> matching current filters</p>
          <p><strong>{urgentOpenCount}</strong> due within 24 hours</p>
        </article>
        <article className="card">
          <h3>Lawyer Matches</h3>
          <p><strong>{filteredLawyers.length}</strong> visible lawyers</p>
          <p><strong>{filteredLawyers.filter((l) => l.availability_status === 'available').length}</strong> currently available</p>
        </article>
      </div>

      <div className="row">
        <select value={courthouseFilter} onChange={(e) => setCourthouseFilter(e.target.value)}>
          <option value="">All courthouses</option>
          {courthouses.map((courthouse) => (
            <option key={courthouse} value={courthouse}>
              {courthouse}
            </option>
          ))}
        </select>
        <button type="button" onClick={loadData} disabled={loading}>
          {loading ? 'Loading...' : 'Apply Filter'}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <LoadingSkeleton lines={6} /> : null}

      {!loading ? <div className="split-grid">
        <div>
          <h3>Available Lawyers</h3>
          <div className="row">
            <input
              value={lawyerSearch}
              onChange={(e) => setLawyerSearch(e.target.value)}
              placeholder="Search lawyers, practice areas, courthouses"
            />
            <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="available">Available only</option>
              <option value="free">Free only</option>
            </select>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
              />
              Verified only
            </label>
          </div>
          <div className="stack">
            {filteredLawyers.map((lawyer) => (
              <article className="card" key={lawyer.id}>
                <p>
                  <strong>{lawyer.name}</strong>{' '}
                  <span className={`verify-badge ${lawyer.verified ? 'verified' : 'unverified'}`}>
                    {verificationTier(lawyer)}
                  </span>
                </p>
                <p>{lawyer.practice_area}</p>
                <p>{lawyer.phone_number}</p>
                <p>{lawyer.nearest_courthouse}</p>
                <p>Status: {lawyer.availability_status} / {lawyer.busyness_status}</p>
              </article>
            ))}
            {filteredLawyers.length === 0 ? <p>No lawyers found for this filter.</p> : null}
          </div>
        </div>

        <div>
          <h3>Open Tasks</h3>
          <div className="row">
            <input
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Search task description, courthouse, posted by"
            />
            <select value={taskSort} onChange={(e) => setTaskSort(e.target.value)}>
              <option value="deadline">Sort: deadline</option>
              <option value="newest">Sort: newest</option>
              <option value="courthouse">Sort: courthouse</option>
            </select>
          </div>
          <div className="stack">
            {filteredOpenTasks.map((task) => (
              <TaskCard key={task.id} task={task} currentUserId={user?.id} onAccept={acceptTask} onComplete={completeTask} />
            ))}
            {filteredOpenTasks.length === 0 ? <p>No open tasks match your current filters.</p> : null}
          </div>
        </div>
      </div> : null}

      <div>
        <h3>Your Tasks</h3>
        <div className="stack">
          {myTasks.map((task) => (
            <TaskCard key={task.id} task={task} currentUserId={user?.id} onAccept={acceptTask} onComplete={completeTask} />
          ))}
          {myTasks.length === 0 ? <p>You have no created or accepted tasks yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
