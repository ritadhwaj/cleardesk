import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/auth";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import Login from "./pages/Login";

// Route-level code splitting: each page loads lazily.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NewCase = lazy(() => import("./pages/NewCase"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const ReviewQueue = lazy(() => import("./pages/ReviewQueue"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));

function PageLoader() {
  return (
    <div className="max-w-6xl mx-auto p-8 space-y-4">
      <div className="skeleton h-8 w-64" />
      <div className="skeleton h-24 w-full" />
      <div className="skeleton h-24 w-full" />
    </div>
  );
}

export default function App() {
  const token = useAuth((s) => s.token);
  if (!token) return <Login />;
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cases/new" element={<NewCase />} />
            <Route path="/cases/:caseId" element={<CaseDetail />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/activity" element={<ActivityLog />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
