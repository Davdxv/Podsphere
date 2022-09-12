import cytoscape, { CytoscapeOptions } from 'cytoscape';
import dagre, { DagreLayoutOptions } from 'cytoscape-dagre';
import styles from './styles';
import applyPanzoom from './panzoom';
import applyEvents from './events';
import applyNodeGroups from './node-groups';
import applyHtmlLabel from './html-cytoscape';
import { CytoscapeDependencies, ExtendedCore } from './interfaces';

cytoscape.use(dagre);

export default function createCytoscape(
  container: CytoscapeOptions['container'],
  layout: DagreLayoutOptions,
  elements: CytoscapeOptions['elements'],
  deps: CytoscapeDependencies,
) {
  const cy = cytoscape({
    container,
    layout,
    elements,
    style: styles(),
    zoomingEnabled: true,
    userZoomingEnabled: true,
    autoungrabify: false,
  }) as ExtendedCore;

  applyEvents(cy, deps);
  applyPanzoom(cy);
  applyNodeGroups(cy);
  applyHtmlLabel(cy);
  cy.fit();

  return cy;
}
