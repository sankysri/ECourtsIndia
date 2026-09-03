import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './store/index.js';
import { AppRoutes } from './routes/AppRoutes.jsx';
import { AuthInitializer } from './components/auth/AuthInitializer.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 10000,
    },
  },
});

export function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AuthInitializer>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthInitializer>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;
