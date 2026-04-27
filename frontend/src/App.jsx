import React from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import LoginRegisterPage from './pages/LoginRegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import TaskListPage from './pages/TaskListPage.jsx';
import CreateTaskPage from './pages/CreateTaskPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import FirmModePage from './pages/FirmModePage.jsx';
import SecondChairPage from './pages/SecondChairPage.jsx';

function Layout({ children }) {
  const { logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="header">
        <h1>Lawyer Task Network</h1>
        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/tasks">Task List</NavLink>
          <NavLink to="/tasks/new">Create Task</NavLink>
          <NavLink to="/second-chair">Second Chair</NavLink>
          <NavLink to="/firm">Firm Mode</NavLink>
          <NavLink to="/profile">Profile</NavLink>
          <button type="button" onClick={logout} className="link-button">
            Logout
          </button>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/auth" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginRegisterPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <Layout>
              <TaskListPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/new"
        element={
          <ProtectedRoute>
            <Layout>
              <CreateTaskPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/second-chair"
        element={
          <ProtectedRoute>
            <Layout>
              <SecondChairPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/firm"
        element={
          <ProtectedRoute>
            <Layout>
              <FirmModePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/auth'} replace />} />
    </Routes>
  );
}
