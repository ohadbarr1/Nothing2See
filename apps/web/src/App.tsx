import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SearchPage } from "./pages/SearchPage";
import { DiscoverPage } from "./pages/DiscoverPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/search" replace />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="*" element={<Navigate to="/search" replace />} />
      </Route>
    </Routes>
  );
}
