import React, {
  DetailedHTMLProps,
  ImgHTMLAttributes,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { isValidInteger, withCorsProxy } from '../utils';
import PlaceholderImage from '../assets/placeholder-52x52.png';

type CachedImg = {
  src: string;
  tData?: string;
  tWidth?: number;
  tHeight?: number;
};

interface Props extends Omit<CachedImg, 'tData'>,
  Omit<DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>, 'alt' | 'src'> {
  alt: string;
  classes?: string;
}

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 200;

export const imgCache : CachedImg[] = [];

/** Removes all CachedImgs matching `src` and adds the given one */
export const cacheAdd = (newImg : CachedImg) => {
  // TODO: Sometimes different newImg.src's link to the same image and thus the same newImg.tData;
  //       this can be optimized.
  const newCache = [...imgCache.filter(img => img.src !== newImg.src), newImg];
  imgCache.splice(0, imgCache.length, ...newCache);
  // console.debug('ImgCache changed to:', imgCache);
};

/**
 * @returns The cached image matching the given params.
 *   If no `tWidth, tHeight` are given, returns the largest cached image matching `src`.
 */
export const cacheFind = ({ src, tWidth, tHeight } : CachedImg) : CachedImg | null => {
  if (!src) return null;

  let matches : CachedImg[];
  if (tWidth && tHeight) {
    matches = imgCache
      .filter(img => img.src === src && img.tWidth === tWidth && img.tHeight === tHeight);
  }
  else {
    matches = imgCache.filter(img => img.src === src);
  }
  return matches.sort((a, b) => ((b.tWidth || 1) - (a.tWidth || 0))).at(0) || null;
};

const CachedImage : React.FC<Props> = ({ src, alt, classes, tWidth, tHeight, ...props }) => {
  const thumbWidth = isValidInteger(tWidth) ? tWidth : DEFAULT_WIDTH;
  const thumbHeight = isValidInteger(tHeight) ? tHeight : DEFAULT_HEIGHT;

  const [thumb, setThumb] = useState<CachedImg | null>(null);

  const loadThumbnail = useCallback(() => {
    if (!src) return;

    const cached = cacheFind({ src });
    if (cached?.tData && cached?.tWidth && cached.tWidth >= thumbWidth) setThumb(cached);
    else {
      const canvas = document.createElement('canvas');
      canvas.width = thumbWidth;
      canvas.height = thumbHeight;
      const context = canvas.getContext('2d');

      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => {
        let b64Url;
        try {
          context?.scale(thumbWidth / img.width, thumbHeight / img.height);
          context?.drawImage(img, 0, 0);
          b64Url = canvas.toDataURL('image/png');
        }
        catch (_ex) {
          b64Url = '';
        }
        const newCachedImg = { src, tData: b64Url, tWidth: thumbWidth, tHeight: thumbHeight };
        if (b64Url) cacheAdd(newCachedImg);
        setThumb(newCachedImg);
      };
      img.onerror = () => {
        setThumb({ src, tData: '', tWidth: thumbWidth, tHeight: thumbHeight });
      };
      img.src = withCorsProxy(src);
    }
  }, [setThumb, src, thumbWidth, thumbHeight]);

  useEffect(() => {
    try {
      if (!thumb) loadThumbnail();
    }
    catch (ex) {
      console.warn(`An error occurred attempting to create a thumbnail for ${src}`, ex);
    }
  }, [setThumb, loadThumbnail, src, thumb, thumbWidth]);

  return (
    <img
      className={classes || ''}
      src={thumb ? thumb.tData || thumb.src : PlaceholderImage}
      alt={alt}
      {...props}
    />
  );
};
export default CachedImage;
