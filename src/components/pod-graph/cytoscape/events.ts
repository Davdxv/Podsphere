import { Core } from 'cytoscape';
import { CytoscapeDependencies } from './interfaces';

export default function applyEvents(cy: Core, deps : CytoscapeDependencies) {
  const { setSelectedPodcastId } = deps;

  cy.on('tap', 'node', evt => {
    const data = evt.target.data();
    setSelectedPodcastId(data.feedUrl);
  });
}
