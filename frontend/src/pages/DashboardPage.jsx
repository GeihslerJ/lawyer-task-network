import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSkeleton from '../components/LoadingSkeleton.jsx';

export default function DashboardPage() {
  const { token, user, setUser } = useAuth();
  const [openTasks, setOpenTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [firmSummary, setFirmSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const urgentTasksCount = openTasks.filter((task) => {
    const dueAt = new Date(task.deadline).getTime();
    const diffMs = dueAt - Date.now();
    return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
  }).length;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [profile, open, mine] = await Promise.all([
          api.getProfile(token),
          api.getOpenTasks(token),
          api.getMyTasks(token),
        ]);
        setUser(profile);
        setOpenTasks(open);
        setMyTasks(mine);

        if (profile.firm_code) {
          const firmData = await api.getFirmMembers(token);
          setFirmSummary(firmData.summary);
        } else {
          setFirmSummary(null);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, setUser]);

  return (
    <section className="stack">
      <h2>Dashboard</h2>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <LoadingSkeleton lines={5} /> : null}

      {!loading ? (
        <>
          <article className="hero-card">
            <div className="hero-content">
              <p className="hero-kicker">Welcome back</p>
              <h3>{user?.name}</h3>
              <p>
                You are practicing <strong>{user?.practice_area}</strong> near{' '}
                <strong>{user?.nearest_courthouse}</strong>.
              </p>
              <p>
                Current status: <strong>{user?.availability_status}</strong> /{' '}
                <strong>{user?.busyness_status}</strong>
              </p>
            </div>
            <div className="hero-actions">
              <Link className="action-tile" to="/tasks/new">
                Create Filing Request
              </Link>
              <Link className="action-tile" to="/tasks">
                Browse Task Marketplace
              </Link>
              <Link className="action-tile" to="/second-chair">
                Request Second Chair
              </Link>
            </div>
          </article>

          <div className="metric-grid">
            <article className="metric-card">
              <p className="metric-label">Open Marketplace Tasks</p>
              <p className="metric-value">{openTasks.length}</p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Urgent (24h)</p>
              <p className="metric-value">{urgentTasksCount}</p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Your Active Items</p>
              <p className="metric-value">{myTasks.length}</p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Firm Code</p>
              <p className="metric-value metric-small">{user?.firm_code || 'Not set'}</p>
            </article>
          </div>

          <div className="card-grid">
            <article className="card">
              <h3>Today’s Focus</h3>
              <p><strong>Open tasks in marketplace:</strong> {openTasks.length}</p>
              <p><strong>Your created or accepted tasks:</strong> {myTasks.length}</p>
              <p><strong>Urgent opportunities:</strong> {urgentTasksCount}</p>
              {firmSummary ? <p><strong>Firm available now:</strong> {firmSummary.available}</p> : null}
            </article>

            <article className="card">
              <h3>Profile Snapshot</h3>
              <p><strong>Practice area:</strong> {user?.practice_area}</p>
              <p><strong>Nearest courthouse:</strong> {user?.nearest_courthouse}</p>
              <p><strong>Firm:</strong> {user?.firm_code || 'Not set'}</p>
              <p><strong>Verification:</strong> {user?.verified ? 'Verified' : user?.bar_verification_status || 'Unverified'}</p>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
