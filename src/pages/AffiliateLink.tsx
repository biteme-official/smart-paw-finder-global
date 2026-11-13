import { useEffect } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { normalizeAffiliateCode, recordAffiliateClick, saveAttribution } from '@/lib/affiliate';

// 파트너 링크 /a/{코드}?p=/product/{상품} — 코드를 30일 저장(마지막 클릭이 덮어씀)하고 그 상품으로 보낸다.
// 우리 사이트 상품·홈 경로만 허용 (다른 사이트로 보내는 열린 리다이렉트 방지).
function safeTarget(p: string | null): { path: string; handle: string | null } {
  const match = (p || '').match(/^\/product\/([a-z0-9][a-z0-9-]{0,199})\/?$/i);
  return match ? { path: `/product/${match[1]}`, handle: match[1].toLowerCase() } : { path: '/', handle: null };
}

export default function AffiliateLink() {
  const { code: rawCode } = useParams();
  const [params] = useSearchParams();
  const code = normalizeAffiliateCode(rawCode);
  const target = safeTarget(params.get('p'));

  useEffect(() => {
    if (!code) return;
    saveAttribution(code, target.handle);
    recordAffiliateClick(code, target.handle);
  }, [code, target.handle]);

  return <Navigate to={target.path} replace />;
}
