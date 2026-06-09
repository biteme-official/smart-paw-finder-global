import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const BRAND_BG = '#FFFFFF';
const CANVAS_W = 1200;
const CANVAS_H = 630;
// 상품이 캔버스 영역의 약 75% 크기를 차지하도록 배치
const PRODUCT_MAX_W = Math.round(CANVAS_W * 0.75);
const PRODUCT_MAX_H = Math.round(CANVAS_H * 0.75);

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('image');

  if (!imageUrl) {
    return new Response('Missing image parameter', { status: 400 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          background: BRAND_BG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          style={{
            maxWidth: PRODUCT_MAX_W,
            maxHeight: PRODUCT_MAX_H,
            objectFit: 'contain',
          }}
        />
      </div>
    ),
    { width: CANVAS_W, height: CANVAS_H },
  );
}
