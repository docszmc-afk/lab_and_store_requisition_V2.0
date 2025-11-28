
import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RequisitionProvider } from './contexts/RequisitionContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Requisitions from './pages/Requisitions';
import NewRequisition from './pages/NewRequisition';
import RequisitionDetail from './pages/RequisitionDetail';
import Layout from './components/Layout';

// Guard component to protect routes
const PrivateRoute = () => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-zankli-cream">Loading...</div>;
  
  return user ? (
    <Layout>
      <Outlet />
    </Layout>
  ) : (
    <Navigate to="/login" replace />
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes */}
      <Route element={<PrivateRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/requisitions" element={<Requisitions />} />
        <Route path="/requisitions/:id" element={<RequisitionDetail />} />
        <Route path="/new-request" element={<NewRequisition />} />
        <Route path="/settings" element={<div className="p-8 text-center text-gray-500">Settings Page Placeholder</div>} />
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <RequisitionProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </RequisitionProvider>
    </AuthProvider>
  );
};

export default App;
