import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getSocket } from '../realtime/socket.js';

export default function FirmModePage() {
  const { token, user } = useAuth();
  const [firmData, setFirmData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualNote, setManualNote] = useState('Manual firm verification placeholder.');

  const loadFirmData = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await api.getFirmMembers(token);
      setFirmData(data);
    } catch (err) {
      setFirmData(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFirmData();
  }, [token]);

  useEffect(() => {
    const socket = getSocket();

    const onAvailabilityUpdate = (payload) => {
      setFirmData((prev) => {
        if (!prev || payload.firmCode !== prev.firmCode) {
          return prev;
        }

        const members = prev.members.map((member) =>
          member.id === payload.userId
            ? {
                ...member,
                availability_status: payload.availabilityStatus,
                busyness_status: payload.busynessStatus,
              }
            : member
        );

        const summary = {
          total: members.length,
          available: members.filter((m) => m.availability_status === 'available').length,
          unavailable: members.filter((m) => m.availability_status === 'unavailable').length,
          free: members.filter((m) => m.busyness_status === 'free').length,
          busy: members.filter((m) => m.busyness_status === 'busy').length,
        };

        return {
          ...prev,
          members,
          summary,
        };
      });
    };

    socket.on('availability:update', onAvailabilityUpdate);
    return () => {
      socket.off('availability:update', onAvailabilityUpdate);
    };
  }, []);

  const markMemberVerified = async (memberId) => {
    try {
      await api.manualBarVerification(token, {
        userId: memberId,
        verified: true,
        notes: manualNote,
      });
      await loadFirmData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="stack">
      <h2>Firm Mode</h2>
      <p>Use your firm code in profile settings to join your internal team view.</p>

      {error ? <p className="error">{error}</p> : null}

      <button type="button" onClick={loadFirmData} disabled={loading}>
        {loading ? 'Refreshing...' : 'Refresh Firm Availability'}
      </button>
      <label>
        Manual Verification Note
        <input value={manualNote} onChange={(e) => setManualNote(e.target.value)} />
      </label>

      {firmData ? (
        <>
          <div className="card">
            <p><strong>Firm Code:</strong> {firmData.firmCode}</p>
            <p><strong>Members:</strong> {firmData.summary.total}</p>
          </div>

          <div className="card-grid">
            <article className="card">
              <h3>Availability</h3>
              <p><strong>Available:</strong> {firmData.summary.available}</p>
              <p><strong>Unavailable:</strong> {firmData.summary.unavailable}</p>
            </article>

            <article className="card">
              <h3>Workload</h3>
              <p><strong>Free:</strong> {firmData.summary.free}</p>
              <p><strong>Busy:</strong> {firmData.summary.busy}</p>
            </article>
          </div>

          <div className="stack">
            {firmData.members.map((member) => (
              <article className="card" key={member.id}>
                <p><strong>{member.name}</strong> {member.id === user?.id ? '(You)' : ''}</p>
                <p>{member.practice_area}</p>
                <p>{member.phone_number}</p>
                <p>{member.email}</p>
                <p>{member.nearest_courthouse}</p>
                <p>Status: {member.availability_status} / {member.busyness_status}</p>
                <p>Verification: {String(member.verified)} ({member.bar_verification_status || 'unsubmitted'})</p>
                {!member.verified ? (
                  <button type="button" className="secondary" onClick={() => markMemberVerified(member.id)}>
                    Mark Verified (Manual)
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
