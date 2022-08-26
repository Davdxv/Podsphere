import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import GlobalStyles from './global-styles';
import 'bootstrap/dist/css/bootstrap.min.css';
import Layout from './components/layout';
import BrowserRoutes from './routes';
import GlobalProviders from './providers';

function ErrorFallback({ error, resetErrorBoundary } : FallbackProps) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button type="button" onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

function App() {
  return (
    <GlobalProviders>
      <BrowserRouter>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <GlobalStyles />
          <Layout>
            <BrowserRoutes />
          </Layout>
        </ErrorBoundary>
      </BrowserRouter>
    </GlobalProviders>
  );
}
export default App;
