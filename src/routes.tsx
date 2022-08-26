import React from 'react';
import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/home';
import FavouritesPage from './pages/favourites';
import AddUrlPage from './pages/add-url';
import HistoryPage from './pages/history';
import SettingsPage from './pages/settings';
import NotFoundPage from './pages/not-found';

function BrowserRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/favourites" element={<FavouritesPage />} />
      <Route path="/add-url" element={<AddUrlPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route element={<NotFoundPage />} />
    </Routes>
  );
}
export default BrowserRoutes;
