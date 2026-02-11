import { Routes, Route, Navigate } from "react-router-dom";
import { getAccessToken } from "./lib/api";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import TreeListPage from "./pages/TreeListPage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/trees"
        element={
          <AuthGuard>
            <TreeListPage />
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/trees" replace />} />
    </Routes>
  );
}
