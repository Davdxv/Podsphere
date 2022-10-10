import { createGlobalStyle } from 'styled-components';
import 'cytoscape-panzoom/cytoscape.js-panzoom.css';
import colors from './theme/colors.module.scss';

const {
  green, orangeMedium, orangeDark,
  red, yellow,
} = colors;

export default createGlobalStyle`
  :root {
    /* ====== Global CSS Variables ====== */
    --color-body: #000000fc;
    --color-label: #797979;

    --toastify-color-progress-warning: ${orangeDark};
  }

  :focus-visible {
    outline: unset;
  }

  html,
  body,
  #root {
    min-height: 100vh;
  }

  body {
    padding-bottom: 4.25rem;
    background-color: var(--color-body);
  }

  mark, .mark {
    padding: unset;
    background-color: inherit;
  }

  a {
    text-decoration: none;
    opacity: 0.9;

    &:hover {
      opacity: 1;
    }
    &:link {
      color: ${orangeDark};
    }
    &:active {
      color: ${orangeDark};
    }
    &:visited {
      color: ${orangeMedium};
    }
  }

  /* ====== Toasts ====== */
  .Toastify {
    &__toast-container {
      z-index: 111111;
      pointer-events: none;

      width: auto;
      max-width: 60%;
      position: fixed;
      padding: 0;
      line-break: auto;
      white-space: pre-wrap;
      opacity: 0.9;

      > div:first-child {
        margin-top: 3rem;
      }

      > div:not(:last-of-type) {
        margin-bottom: 0.5rem;
      }
    }

    &__toast {
      display: flex;
    }

    &__toast-icon {
      width: 1.5rem;
      height: 1.5rem;
    }

    &__close-button {
      pointer-events: auto;
    }

    &__toast-body {
      pointer-events: auto;
      align-items: flex-start;
      color: #000;
    }

    &__toast--success {
      background-color: ${green};
    }

    &__toast--error {
      background-color: ${red};
    }

    &__toast--warning {
      background-color: ${yellow};

      > .Toastify__toast-body > .Toastify__toast-icon {
        svg {
          fill: ${orangeDark};
        }
      }
    }

    &__progress-bar--warning {
      background
    }

    &__toast--info {
      background-color: #ddd;
    }
  }

  /* ====== Scrollbar ====== */
  ::-webkit-scrollbar {
    width: 8px;
    scroll-behavior: smooth;
  }

  /* Track */
  ::-webkit-scrollbar-track {
    box-shadow: inset 0 0 5px rgb(43, 43, 43);
    border-radius: 0.5rem;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  /* Handle */
  ::-webkit-scrollbar-thumb {
    background-color: rgba(43, 43, 43, 1);
    border-radius: 0.5rem;
  }

  /* Handle on hover */
  ::-webkit-scrollbar-thumb:hover {
    background-color: #aaaaaa;
  }

  /* ====== Modal ====== */
  .modal-content {
    background-color: #16181a;
    color: #868686;

  }
  .modal-header {
    border-bottom: 1px solid #2c2c2c;
  }

  .modal-footer {
    border-top: 1px solid #2c2c2c;
  }

  /* ====== Cytoscape ====== */
  .cy-panzoom {
    top: 1rem;
    color: #666;
    z-index: 9999;
    display: inherit;
    @media only screen and (max-width: 960px) {
      display: none;
    }
  }
  .cy-panzoom-panner {
    background: #030303;
    border: 1px solid #262626;
  }
  .cy-panzoom-slider-background {
    background: #030303;
    border-left: 1px solid #262626;
    border-right: 1px solid #262626;
  }
  .cy-panzoom-slider-handle {
    background: #030303;
    border: 1px solid #262626;
  }
  .cy-panzoom-zoom-button {
    background: #030303;
    border: 1px solid #262626;
  }

  /* ====== cy-node-html-label Nodes ====== */
  .card-front__heading {
    background: black;
    text-align: center;
    font-size: 27px;
    margin: 0;
    color: #fafbfa !important;
    -webkit-text-stroke-width: 1px;
    -webkit-text-stroke-color: rgba(185,181,181,0.719);
  }

  .card-front__tp {
    border-radius: 0.5rem;
    color: #fafbfa;
    height: 80%;
    overflow: hidden;
    position: relative;
  }

  .card-area {
    align-items: center;
    display: flex;
    flex-wrap: nowrap;
    height: 100%;
    justify-content: space-evenly;
    padding: 1rem;
  }

  .card-section {
    align-items: center;
    display: flex;
    height: 100%;
    justify-content: center;
    width: 100%;
    background-color: #cccccc;
  }

  .card-front {
    background-color: #000000d4;
    height: 10rem;
    width: 10rem;
    padding: 5px;
    border-radius: 0.5rem;
    z-index: 6666;
  }

  .card-front.selected {
    box-shadow: 0 0 0px 2px #5da4ef;
    border: 2px solid #5682a3;
  }

  .card-front-btn {
    align-items: center;
    display: flex;
    justify-content: center;
    padding-top: 0.2rem;
    height: 20%;
  }

  .card-front__details {
    color: #00b97d;
    border-radius: 0.5rem;
    font-weight: 600;
    overflow: hidden;
  }

  .cardStats {
    /* font-size: 0.7em; */
    text-align: center;
    width: 100%;
  }

  .cardStats_stat {
    display: inline-block;
    white-space: nowrap;
    margin-top: 5px;
    font-size: 0.7em;
  }

  .image-bg {
    opacity: 0.6;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    position: absolute;
    object-fit: cover;
    border-radius: 0.75rem;
  }

  .cardStats_stat-likes {
    color: #b2d9a6;
    margin: 1px;
    text-align: center;
  }

  .cardStats_stat-comments {
    color: #ffd433;
    margin: 1px;
    text-align:center;
  }

  /* ====== cy-node-html-label Disjoint Graphs ====== */
  .group {
    display: none;
    flex-direction: column;
    align-items: center;
    background-color: #020202;
    border-radius: 25px;
    padding: 10px;
    box-shadow: 11px 11px 11px  rgba(0, 0, 0, 0.3);
  }

  .group-header {
    margin-bottom: 0;
    font-size: smaller;
    text-transform: capitalize;
  }

  .group.hide {
    display: none;
  }

  .group.show {
    display: inline-flex;
  }

  .group-graphic {
    display: inline-flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    border-radius: 3px;
    width: 56px;
    height: 56px;
    background: #020202;
    margin-top: 16px;
    border: 1px solid #262626;
  }
  .group-label {
    font-size: 8px;
    color: #797979;
    text-transform: capitalize;
  }
`;
