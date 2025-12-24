import { FC, useEffect, useState } from 'react';
import Image from 'next/image';
interface ImageSrc {
  src?: string | null;
  fallbackSrc: string;
  width: number;
  height: number;
  [key: string]: any;
}
const ImageWithFallback: FC<ImageSrc> = (props) => {
  const { src, fallbackSrc, ...rest } = props;
  const normalizedSrc = src || fallbackSrc;
  const [imgSrc, setImgSrc] = useState(normalizedSrc);
  useEffect(() => {
    const nextSrc = src || fallbackSrc;
    if (nextSrc !== imgSrc) {
      setImgSrc(nextSrc);
    }
  }, [src, fallbackSrc, imgSrc]);
  return (
    <Image
      alt=""
      {...rest}
      src={imgSrc || fallbackSrc}
      onError={() => {
        setImgSrc(fallbackSrc);
      }}
    />
  );
};
export default ImageWithFallback;
