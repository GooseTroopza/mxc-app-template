// Polyfill process for CJS dependencies that reference process.env.NODE_ENV at runtime
if (typeof process === 'undefined') {
  (globalThis as any).process = { env: { NODE_ENV: 'production' } };
}

/**
 * MXC Shell Entry Point — exported for dynamic loading by the MXC platform.
 *
 * MUST export:
 * - default: root React component (handles internal routing)
 * - ReactDOM: react-dom/client (shell uses this for isolated createRoot)
 *
 * Uses MemoryRouter because the shell owns window history.
 * Strip the /tracker prefix so internal routes match correctly.
 */

import * as ReactDOM from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './pages/DashboardPage';
import { ItemsPage } from './pages/ItemsPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import './styles.css';

export { ReactDOM };

const queryClient = new QueryClient();

export default function TrackerApp() {
  // Strip /tracker prefix — shell mounts us at /:appId/*
  const initialPath = window.location.pathname.replace(/^\/tracker/, '') || '/';

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="items" element={<ItemsPage />} />
          <Route path="items/:id" element={<ItemDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
