import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '@/graphql/client';
import { router } from '@/router';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <RouterProvider router={router} />
      </ApolloProvider>
    </ErrorBoundary>
  );
};
