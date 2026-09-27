import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './pages/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Campaigns from './pages/Campaigns';

function RequireAuth({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { token } = useAuth();
  if (token) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnly>
                <Signup />
              </PublicOnly>
            }
          />

          <Route
            path="/"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="campaigns" element={<Campaigns />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
