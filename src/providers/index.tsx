import React from 'react';
import SubscriptionsProvider from './subscriptions';
import ArweaveProvider from './arweave';
import CytoscapeProvider from './cytoscape';

interface Props {
  children: React.ReactNode;
}

const GlobalProviders : React.FC<Props> = ({ children }) => (
  <SubscriptionsProvider>
    <ArweaveProvider>
      <CytoscapeProvider>
        {children}
      </CytoscapeProvider>
    </ArweaveProvider>
  </SubscriptionsProvider>
);

export default GlobalProviders;
