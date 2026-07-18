import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/auth";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewCase from "./pages/NewCase";
import CaseDetail from "./pages/CaseDetail";
import ReviewQueue from "./pages/ReviewQueue";

export default function App() {
  const token = useAuth((s) => s.token);
  if (!token) return <Login />;
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cases/new" element={<NewCase />} />
        <Route path="/cases/:caseId" element={<CaseDetail />} />
        <Route path="/review" element={<ReviewQueue />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </ErrorBoundary>
  );
}
