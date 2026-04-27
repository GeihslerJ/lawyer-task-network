import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const levelOptions = ['Any', 'Junior', 'Mid-level', 'Senior', 'First-chair trial experience'];

function RequestCard({ requestItem, currentUserId, onAccept }) {
  const canAccept = requestItem.status === 'open' && requestItem.creator_id !== currentUserId;

  return (
    <article className="card">
      <p><strong>Case Type:</strong> {requestItem.case_type}</p>
      <p><strong>Trial Date:</strong> {new Date(requestItem.trial_date).toLocaleString()}</p>
      <p><strong>Experience Needed:</strong> {requestItem.experience_level_needed}</p>
      <p><strong>Status:</strong> {requestItem.status}</p>
      <p><strong>Posted by:</strong> {requestItem.creator_name || requestItem.creator_id}</p>
      {requestItem.accepted_lawyer_name ? <p><strong>Accepted by:</strong> {requestItem.accepted_lawyer_name}</p> : null}

      {canAccept ? (
        <button type="button" onClick={() => onAccept(requestItem.id)}>
          Accept Second Chair Request
        </button>
      ) : null}
    </article>
  );
}

export default function SecondChairPage() {
  const { token, user } = useAuth();
  const [form, setForm] = useState({
    caseType: '',
    date: '',
    experienceLevelNeeded: levelOptions[0],
  });
  const [openRequests, setOpenRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [open, mine] = await Promise.all([
        api.getOpenSecondChairRequests(token),
        api.getMySecondChairRequests(token),
      ]);
      setOpenRequests(open);
      setMyRequests(mine);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.createSecondChairRequest(token, form);
      setMessage('Second-chair request posted.');
      setForm({ caseType: '', date: '', experienceLevelNeeded: levelOptions[0] });
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      await api.acceptSecondChairRequest(token, requestId);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="stack">
      <h2>Second Chair Requests</h2>

      <form className="card stack" onSubmit={onSubmit}>
        <h3>Request Trial Assistance</h3>
        <label>
          Case Type
          <input name="caseType" value={form.caseType} onChange={onChange} placeholder="e.g. Personal injury jury trial" required />
        </label>

        <label>
          Date
          <input name="date" type="datetime-local" value={form.date} onChange={onChange} required />
        </label>

        <label>
          Experience Level Needed
          <select name="experienceLevelNeeded" value={form.experienceLevelNeeded} onChange={onChange}>
            {levelOptions.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}

        <button type="submit">Post Request</button>
      </form>

      <button type="button" className="secondary" onClick={loadData} disabled={loading}>
        {loading ? 'Refreshing...' : 'Refresh Requests'}
      </button>

      <div className="split-grid">
        <div>
          <h3>Open Requests</h3>
          <div className="stack">
            {openRequests.map((requestItem) => (
              <RequestCard key={requestItem.id} requestItem={requestItem} currentUserId={user?.id} onAccept={acceptRequest} />
            ))}
            {openRequests.length === 0 ? <p>No open second-chair requests.</p> : null}
          </div>
        </div>

        <div>
          <h3>Your Requests</h3>
          <div className="stack">
            {myRequests.map((requestItem) => (
              <RequestCard key={requestItem.id} requestItem={requestItem} currentUserId={user?.id} onAccept={acceptRequest} />
            ))}
            {myRequests.length === 0 ? <p>You have no posted or accepted second-chair requests.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
