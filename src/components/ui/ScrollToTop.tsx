import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

// 페이지 최상단(히어로 배너 영역)에서는 버튼을 숨겨서 배너 사진 위에 겹치지 않도록 한다.
const SHOW_AFTER_SCROLL_Y = 500;

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > SHOW_AFTER_SCROLL_Y);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-40 right-7 z-50 w-10 h-10 rounded-full bg-primary/80 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary transition-colors"
      aria-label="Scroll to top"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}
