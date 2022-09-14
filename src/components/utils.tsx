import React from 'react';
import Linkify from 'react-linkify';
import parse, {
  attributesToProps,
  domToReact,
  DOMNode,
  Element,
  HTMLReactParserOptions,
} from 'html-react-parser';

const PARSE_HTML_OPTIONS : HTMLReactParserOptions = {
  replace: (domNode: DOMNode) => {
    // see https://github.com/remarkablemark/html-react-parser/issues/199#issuecomment-963791320
    const el : Element = domNode as Element;

    if (el.tagName === 'a' && el.attribs?.href && el.children) {
      const props = { ...attributesToProps(el.attribs), rel: 'noreferrer', target: '_blank' };
      return <a {...props}>{domToReact(el.children)}</a>;
    }
  },
};

export const parseHtml = (source = '', options: HTMLReactParserOptions = {}) => (
  <Linkify
    componentDecorator={(decoratedHref, decoratedText, key) => (
      <a rel="noreferrer" target="_blank" href={decoratedHref} key={key}>
        {decoratedText}
      </a>
    )}
  >
    {parse(source, { ...PARSE_HTML_OPTIONS, ...options })}
  </Linkify>
);
