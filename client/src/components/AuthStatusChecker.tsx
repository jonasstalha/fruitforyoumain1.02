import React from 'react';
import { useAuth } from '../hooks/use-auth';

const AuthStatusChecker: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-blue-600">Checking authentication...</div>;
  }

  return (
    <div className="bg-gray-100 p-4 rounded-lg mb-4">
      <h3 className="font-semibold text-gray-800 mb-2">Authentication Status</h3>
      {user ? (
        <div className="text-green-600">
          ✅ Authenticated as: {user.email}
          <br />
          UID: {user.uid}
          <br />
          Role: {user.role}
          <br />
          Provider: {user.providerId}
        </div>
      ) : (
        <div className="text-red-600">
          ❌ Not authenticated
        </div>
      )}
    </div>
  );
};

export default AuthStatusChecker;
