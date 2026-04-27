import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getSocket } from '../realtime/socket.js';

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
  const [courthouses, setCourthouses] = useState([]);
  const [courthouseFilter, setCourthouseFilter] = useState('');
  const [lawyers, setLawyers] = useState([]);
  const [openTasks, setOpenTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [lawyerList, openTaskList, mine] = await Promise.all([
        api.getLawyers(token, courthouseFilter),
        api.getOpenTasks(token, courthouseFilter),
        api.getMyTasks(token),
      ]);
      setLawyers(lawyerList);
      setOpenTasks(openTaskList);
      setMyTasks(mine);
    } catch (err) {
      setError(err.message);
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
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const completeTask = async (taskId) => {
    try {
      await api.completeTask(token, taskId);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="stack">
      <h2>Task Marketplace</h2>

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

      <div className="split-grid">
        <div>
          <h3>Available Lawyers</h3>
          <div className="stack">
            {lawyers.map((lawyer) => (
              <article className="card" key={lawyer.id}>
                <p><strong>{lawyer.name}</strong></p>
                <p>{lawyer.practice_area}</p>
                <p>{lawyer.phone_number}</p>
                <p>{lawyer.nearest_courthouse}</p>
                <p>Status: {lawyer.availability_status} / {lawyer.busyness_status}</p>
              </article>
            ))}
            {lawyers.length === 0 ? <p>No lawyers found for this filter.</p> : null}
          </div>
        </div>

        <div>
          <h3>Open Tasks</h3>
          <div className="stack">
            {openTasks.map((task) => (
              <TaskCard key={task.id} task={task} currentUserId={user?.id} onAccept={acceptTask} onComplete={completeTask} />
            ))}
            {openTasks.length === 0 ? <p>No open tasks right now.</p> : null}
          </div>
        </div>
      </div>

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
