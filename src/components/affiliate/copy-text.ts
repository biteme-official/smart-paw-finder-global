// 클립보드 복사. 가입 API를 기다린 뒤 복사해도 Safari가 막지 않도록, 값이 Promise면 ClipboardItem에 그대로 넘긴다.
export async function copyText(value: string | Promise<string>): Promise<void> {
  if (typeof value !== 'string' && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = value.then((text) => new Blob([text], { type: 'text/plain' }));
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
    return;
  }
  const text = await value;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // 아주 오래된 브라우저
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  el.remove();
}
