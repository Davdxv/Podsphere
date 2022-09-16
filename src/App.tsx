import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import GlobalStyles from './global-styles';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/layout';
import BrowserRoutes from './routes';
import GlobalProviders from './providers';
import { theme } from './theme';

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
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
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
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
export default App;
