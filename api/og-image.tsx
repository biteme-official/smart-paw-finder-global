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
    {
      type: 'div',
      key: null,
      props: {
        style: {
          width: W,
          height: H,
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        children: {
          type: 'img',
          key: null,
          props: {
            src: imageUrl,
            style: {
              maxWidth: Math.round(W * 0.75),
              maxHeight: Math.round(H * 0.75),
              objectFit: 'contain',
            },
          },
        },
      },
    },
    { width: W, height: H },
  );
}
