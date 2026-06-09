import React from 'react';
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const W = 1200;
const H = 630;

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('image');

  if (!imageUrl) {
    return new Response('Missing image parameter', { status: 400 });
  }

  return new ImageResponse(
    React.createElement(
      'div',
      {
        style: {
          width: W,
          height: H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8F8F8',
          overflow: 'hidden',
        },
      },
      React.createElement('img', {
        src: imageUrl,
        style: {
          width: W,
          height: H,
          objectFit: 'cover',
          objectPosition: 'center',
        },
      }),
    ),
    { width: W, height: H },
  );
}
