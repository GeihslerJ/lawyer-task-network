import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function CreateTaskPage() {
  const { token, user } = useAuth();
  const [courthouses, setCourthouses] = useState([]);
  const [form, setForm] = useState({
    courthouseLocation: user?.nearest_courthouse || '',
    description: '',
    deadline: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    const loadCourthouses = async () => {
      try {
        const list = await api.getCourthouses();
        setCourthouses(list);
        setForm((prev) => ({
          ...prev,
          courthouseLocation: prev.courthouseLocation || user?.nearest_courthouse || list[0] || '',
        }));
      } catch (err) {
        setError(err.message);
      }
    };

    loadCourthouses();
  }, [user?.nearest_courthouse]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await api.createTask(token, form);
      setMessage('Task created successfully.');
      setForm((prev) => ({ ...prev, description: '', deadline: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="stack">
      <h2>Create Filing Request</h2>
      <form onSubmit={onSubmit} className="card stack">
        <label>
          Courthouse Location
          <select name="courthouseLocation" value={form.courthouseLocation} onChange={onChange} required>
            <option value="">Select courthouse</option>
            {courthouses.map((courthouse) => (
              <option key={courthouse} value={courthouse}>
                {courthouse}
              </option>
            ))}
          </select>
        </label>

        <label>
          Description of Task
          <textarea
            name="description"
            value={form.description}
            onChange={onChange}
            placeholder="Describe filing requirements"
            rows={5}
            required
          />
        </label>

        <label>
          Deadline (date + time)
          <input name="deadline" type="datetime-local" value={form.deadline} onChange={onChange} required />
        </label>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}

        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Create Request'}
        </button>
      </form>
    </section>
  );
}
