import React from 'react';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProfilePage() {
  const { token, user, setUser } = useAuth();
  const [form, setForm] = useState({
    phoneNumber: user?.phone_number || '',
    practiceArea: user?.practice_area || '',
    state: user?.state || '',
    nearestCourthouse: user?.nearest_courthouse || '',
    firmCode: user?.firm_code || '',
    availabilityStatus: user?.availability_status || 'available',
    busynessStatus: user?.busyness_status || 'free',
  });

  const [courthouses, setCourthouses] = useState([]);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [manualUserId, setManualUserId] = useState('');
  const [manualNotes, setManualNotes] = useState('Manual placeholder verification.');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const [profile, courthouseList] = await Promise.all([api.getProfile(token), api.getCourthouses()]);
        setUser(profile);
        setCourthouses(courthouseList);
        setForm({
          phoneNumber: profile.phone_number,
          practiceArea: profile.practice_area,
          state: profile.state,
          nearestCourthouse: profile.nearest_courthouse,
          firmCode: profile.firm_code || '',
          availabilityStatus: profile.availability_status,
          busynessStatus: profile.busyness_status,
        });
      } catch (err) {
        setError(err.message);
      }
    };

    loadProfile();
  }, [token, setUser]);

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const updated = await api.updateProfile(token, form);
      setUser(updated);
      setMessage('Profile updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const requestVerification = async () => {
    setError('');
    setMessage('');
    try {
      const payload = await api.requestBarVerification(token, verificationNotes);
      setUser(payload.user);
      setMessage(payload.message);
    } catch (err) {
      setError(err.message);
    }
  };

  const markManualVerification = async (verified) => {
    setError('');
    setMessage('');
    try {
      const targetUserId = manualUserId ? Number(manualUserId) : user?.id;
      const payload = await api.manualBarVerification(token, {
        userId: targetUserId,
        verified,
        notes: manualNotes,
      });

      if (targetUserId === user?.id) {
        setUser(payload.user);
      }
      setMessage(payload.message);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="stack">
      <h2>Profile</h2>

      <article className="card">
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Bar ID:</strong> {user?.bar_id_number}</p>
        <p><strong>Firm Code:</strong> {user?.firm_code || 'Not set'}</p>
        <p><strong>Verified:</strong> {String(user?.verified)}</p>
        <p><strong>Verification Status:</strong> {user?.bar_verification_status || 'unsubmitted'}</p>
        <p><strong>Verification Notes:</strong> {user?.bar_verification_notes || 'None'}</p>
        <p><strong>Nearest Courthouse:</strong> {user?.nearest_courthouse}</p>
      </article>

      <form className="card stack" onSubmit={onSubmit}>
        <label>
          Phone Number
          <input name="phoneNumber" value={form.phoneNumber} onChange={onChange} required />
        </label>

        <label>
          Practice Area
          <input name="practiceArea" value={form.practiceArea} onChange={onChange} required />
        </label>

        <label>
          State
          <input name="state" value={form.state} onChange={onChange} required />
        </label>

        <label>
          Firm Code
          <input
            name="firmCode"
            value={form.firmCode}
            onChange={onChange}
            placeholder="Enter firm code or clear to leave firm mode"
          />
        </label>

        <label>
          Nearest Courthouse
          <select name="nearestCourthouse" value={form.nearestCourthouse} onChange={onChange} required>
            <option value="">Select nearest courthouse</option>
            {courthouses.map((courthouse) => (
              <option key={courthouse} value={courthouse}>
                {courthouse}
              </option>
            ))}
          </select>
        </label>

        <label>
          Availability
          <select name="availabilityStatus" value={form.availabilityStatus} onChange={onChange}>
            <option value="available">available</option>
            <option value="unavailable">unavailable</option>
          </select>
        </label>

        <label>
          Workload
          <select name="busynessStatus" value={form.busynessStatus} onChange={onChange}>
            <option value="free">free</option>
            <option value="busy">busy</option>
          </select>
        </label>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}

        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      <article className="card stack">
        <h3>Bar Verification (Placeholder)</h3>
        <label>
          Request Notes
          <textarea
            value={verificationNotes}
            onChange={(e) => setVerificationNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes for verification review"
          />
        </label>
        <button type="button" className="secondary" onClick={requestVerification}>
          Submit Verification Request
        </button>

        <label>
          Manual Verify Target User ID (blank = me)
          <input
            value={manualUserId}
            onChange={(e) => setManualUserId(e.target.value)}
            placeholder="User ID"
          />
        </label>
        <label>
          Manual Verification Notes
          <input value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} />
        </label>
        <div className="row">
          <button type="button" onClick={() => markManualVerification(true)}>
            Mark Verified (Manual)
          </button>
          <button type="button" className="secondary" onClick={() => markManualVerification(false)}>
            Mark Rejected
          </button>
        </div>
      </article>
    </section>
  );
}
