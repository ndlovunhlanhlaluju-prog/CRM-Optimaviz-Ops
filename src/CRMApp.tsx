import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import BrandDetailPage from './components/BrandDetailPage';

const CRMApp: React.FC = () => {
  return (
    <Router>
      <Switch>
        <Route path="/brand/:id" component={BrandDetailPage} />
        {/* Add more routes as needed */}
      </Switch>
    </Router>
  );
};

export default CRMApp;
