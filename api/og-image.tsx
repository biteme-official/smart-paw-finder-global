import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const W = 1200;
const H = 630;
// 상하좌우 4% safe area 확보, 상품이 캔버스의 92% 채움
const PRODUCT_MAX_W = Math.round(W * 0.92); // 1104px
const PRODUCT_MAX_H = Math.round(H * 0.92); // 580px

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
          background: '#F8F8F8',
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
              maxWidth: PRODUCT_MAX_W,
              maxHeight: PRODUCT_MAX_H,
              objectFit: 'contain',
            },
          },
        },
      },
    },
    { width: W, height: H },
  );
}
