import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import LoadingSkeleton from '../components/LoadingSkeleton.jsx';

export default function AdminVerificationPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [queue, setQueue] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notesByUserId, setNotesByUserId] = useState({});
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const [queueData, activityData] = await Promise.all([
        api.getVerificationQueue(token),
        api.getActivityLogs(token),
      ]);
      setQueue(queueData);
      setLogs(activityData);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleVerify = async (userId, verified) => {
    try {
      await api.manualBarVerification(token, {
        userId,
        verified,
        notes: notesByUserId[userId] || null,
      });
      toast.success(verified ? 'User marked verified.' : 'User marked rejected.');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <section className="stack">
      <h2>Admin Verification Queue</h2>
      {error ? <p className="error">{error}</p> : null}

      {loading ? <LoadingSkeleton lines={6} /> : null}

      {!loading && (
        <>
          <article className="card stack">
            <h3>Pending / Rejected Requests</h3>
            {queue.length === 0 ? <p>No users waiting for review.</p> : null}
            {queue.map((user) => (
              <div key={user.id} className="card stack">
                <p><strong>{user.name}</strong> ({user.email})</p>
                <p><strong>Status:</strong> {user.bar_verification_status}</p>
                <p><strong>Bar ID:</strong> {user.bar_id_number}</p>
                <p><strong>Practice Area:</strong> {user.practice_area}</p>
                <p><strong>Notes:</strong> {user.bar_verification_notes || 'None'}</p>
                <label>
                  Admin Notes
                  <input
                    value={notesByUserId[user.id] || ''}
                    onChange={(e) => setNotesByUserId((prev) => ({ ...prev, [user.id]: e.target.value }))}
                    placeholder="Optional verification note"
                  />
                </label>
                <div className="row">
                  <button type="button" onClick={() => handleVerify(user.id, true)}>
                    Mark Verified
                  </button>
                  <button type="button" className="secondary" onClick={() => handleVerify(user.id, false)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </article>

          <article className="card stack">
            <h3>Recent Activity</h3>
            {logs.length === 0 ? <p>No activity yet.</p> : null}
            {logs.map((log) => (
              <div key={log.id} className="activity-item">
                <p>
                  <strong>{log.action}</strong> by {log.actor_name || `User ${log.actor_user_id || 'Unknown'}`} on{' '}
                  {new Date(log.created_at).toLocaleString()}
                </p>
                <p>Target: {log.target_name || (log.target_user_id ? `User ${log.target_user_id}` : 'N/A')}</p>
              </div>
            ))}
          </article>
        </>
      )}
    </section>
  );
}
