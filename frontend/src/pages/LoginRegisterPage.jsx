import React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const emptyForm = {
  name: '',
  email: '',
  phoneNumber: '',
  practiceArea: '',
  barIdNumber: '',
  state: '',
  nearestCourthouse: '',
  firmCode: '',
  firmName: '',
  profileImageUrl: '',
  password: '',
};

export default function LoginRegisterPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [courthouses, setCourthouses] = useState([]);

  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    const loadCourthouses = async () => {
      try {
        const list = await api.getCourthouses();
        setCourthouses(list);
      } catch (err) {
        setError(err.message);
      }
    };

    loadCourthouses();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = isLogin
        ? await api.login({ email: form.email, password: form.password })
        : await api.register(form);
      login(payload.token, payload.user);
      toast.success(isLogin ? 'Welcome back.' : 'Account created successfully.');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2>{isLogin ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit} className="stack">
        {!isLogin && (
          <>
            <input name="name" placeholder="Name" value={form.name} onChange={onChange} required />
            <input name="phoneNumber" placeholder="Phone Number" value={form.phoneNumber} onChange={onChange} required />
            <input name="practiceArea" placeholder="Practice Area" value={form.practiceArea} onChange={onChange} required />
            <input name="barIdNumber" placeholder="Bar ID Number" value={form.barIdNumber} onChange={onChange} required />
            <input name="state" placeholder="State (e.g. TX)" value={form.state} onChange={onChange} required />
            <input name="firmCode" placeholder="Firm Code (optional)" value={form.firmCode} onChange={onChange} />
            <input name="firmName" placeholder="Firm Name (optional)" value={form.firmName} onChange={onChange} />
            <input
              name="profileImageUrl"
              placeholder="Profile Image URL (optional)"
              value={form.profileImageUrl}
              onChange={onChange}
            />
            <select name="nearestCourthouse" value={form.nearestCourthouse} onChange={onChange} required>
              <option value="">Select nearest courthouse</option>
              {courthouses.map((courthouse) => (
                <option key={courthouse} value={courthouse}>
                  {courthouse}
                </option>
              ))}
            </select>
          </>
        )}
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={onChange} required />
        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={onChange}
          required
        />

        {error ? <p className="error">{error}</p> : null}

        <button disabled={loading} type="submit">
          {loading ? 'Submitting...' : isLogin ? 'Login' : 'Create Account'}
        </button>
      </form>

      <button className="secondary" type="button" onClick={() => setIsLogin((v) => !v)}>
        {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
      </button>
    </div>
  );
}
