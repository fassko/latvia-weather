import React from "react";

/**
 * Latvia Weather mark as used in Remotion promo / social-unlock videos.
 * Copy this file into another Remotion project and render <VideoIcon />.
 *
 * Default size (190) matches the promo Intro "wide" mark.
 * Social-unlock Outro uses size={340}.
 */
type VideoIconProps = {
  size?: number;
  style?: React.CSSProperties;
};

export const VideoIcon: React.FC<VideoIconProps> = ({ size = 190, style }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="video-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14a4ef" />
          <stop offset="1" stopColor="#0878c4" />
        </linearGradient>
        <radialGradient id="video-sun" cx="42%" cy="38%" r="68%">
          <stop offset="0" stopColor="#ffe56a" />
          <stop offset="1" stopColor="#f5b400" />
        </radialGradient>
        <linearGradient id="video-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e4edf5" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="118" fill="url(#video-tile)" />
      <g transform="translate(198 196)" fill="#f6c21a">
        <g>
          <rect x="-12" y="-132" width="24" height="40" rx="10" />
          <rect x="-12" y="-132" width="24" height="40" rx="10" transform="rotate(45)" />
          <rect x="-12" y="-132" width="24" height="40" rx="10" transform="rotate(90)" />
          <rect x="-12" y="-132" width="24" height="40" rx="10" transform="rotate(135)" />
          <rect x="-12" y="-132" width="24" height="40" rx="10" transform="rotate(180)" />
          <rect x="-12" y="-132" width="24" height="40" rx="10" transform="rotate(225)" />
          <rect x="-12" y="-132" width="24" height="40" rx="10" transform="rotate(270)" />
          <rect x="-12" y="-132" width="24" height="40" rx="10" transform="rotate(315)" />
        </g>
        <circle r="78" fill="url(#video-sun)" />
      </g>
      <g fill="url(#video-cloud)">
        <ellipse cx="312" cy="328" rx="128" ry="72" />
        <circle cx="236" cy="318" r="58" />
        <circle cx="304" cy="286" r="74" />
        <circle cx="378" cy="316" r="60" />
      </g>
    </svg>
  );
};
