import React from 'react';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardPage() {
  const { token, user, setUser } = useAuth();
  const [openTasks, setOpenTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [firmSummary, setFirmSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
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
      }
    };

    load();
  }, [token, setUser]);

  return (
    <section className="stack">
      <h2>Dashboard</h2>
      {error ? <p className="error">{error}</p> : null}

      <div className="card-grid">
        <article className="card">
          <h3>Welcome</h3>
          <p><strong>Name:</strong> {user?.name}</p>
          <p><strong>Practice Area:</strong> {user?.practice_area}</p>
          <p><strong>Firm Code:</strong> {user?.firm_code || 'Not set'}</p>
          <p><strong>Nearest Courthouse:</strong> {user?.nearest_courthouse}</p>
          <p><strong>Status:</strong> {user?.availability_status} / {user?.busyness_status}</p>
        </article>

        <article className="card">
          <h3>Task Summary</h3>
          <p><strong>Open tasks in marketplace:</strong> {openTasks.length}</p>
          <p><strong>Your created or accepted tasks:</strong> {myTasks.length}</p>
          {firmSummary ? <p><strong>Firm available now:</strong> {firmSummary.available}</p> : null}
        </article>
      </div>
    </section>
  );
}
