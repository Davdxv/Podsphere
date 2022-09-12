import React, { useRef, useEffect, useState } from 'react';
import {
  Box, useMediaQuery, useTheme,
} from '@mui/material';
import { Podcast } from '../../client/interfaces';
import { CytoscapeDependencies, ExtendedCore } from './cytoscape/interfaces';
import createCytoscape from './cytoscape';
import getElementsFromSubscriptions from './get-elements-from-subscriptions';
// import ToggleBtn from '../buttons/toggle-button';
import { mobileLayout, desktopLayout } from './cytoscape/layout';
import style from './style.module.scss';

interface Props extends CytoscapeDependencies {
  subscriptions: Podcast[];
}

declare global {
  interface Window {
    cy: ExtendedCore;
  }
}

const PodGraph : React.FC<Props> = ({ subscriptions, setSelectedPodcastId }) => {
  const el = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [cy, setCy] = useState<ExtendedCore>();

  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    const layout = isSm ? mobileLayout : desktopLayout;
    const cyto = createCytoscape(
      el.current,
      layout,
      getElementsFromSubscriptions(subscriptions),
      {
        setSelectedPodcastId: id => setSelectedPodcastId(id),
      },
    );
    setCy(cyto);
    if (typeof window !== 'undefined') window.cy = cyto;

    return () => {
      cyto.destroy();
    };
  }, [isSm, subscriptions, setSelectedPodcastId]);

  return (
    <Box className={style['pod-graph-container']}>
      <Box className={style['pod-graph-inner-container']} ref={el} />
      {/* <ToggleBtn /> TODO: Cytoscape toolbar */}
    </Box>
  );
};

export default PodGraph;
