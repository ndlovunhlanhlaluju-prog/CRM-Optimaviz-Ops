import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import BrandDetailPage from './components/BrandDetailPage';

interface CRMAppProps {
  user: any;
  onLogout: () => void;
}

const CRMApp: React.FC<CRMAppProps> = ({ user, onLogout }) => {
  return (
    <Router>
      <Routes>
        <Route path="/brand/:id" element={<BrandDetailPage />} />
        {/* Add more routes as needed */}
      </Routes>
    </Router>
  );
};

export default CRMApp;