import React from 'react';
import { useParams } from 'react-router-dom';

interface BrandDetailPageParams {
  id: string;
}

const BrandDetailPage: React.FC = () => {
  const { id } = useParams<BrandDetailPageParams>();

  return (
    <div>
      <h1>Brand Detail Page</h1>
      <p>Brand ID: {id}</p>
      {/* Add more brand details and functionality here */}
    </div>
  );
};

export default BrandDetailPage;
