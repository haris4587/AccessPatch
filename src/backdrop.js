// Decorative scroll parallax. Transform updates are limited to one per frame.
export function mountBackdrop() {
 const layer = document.querySelector('.siteBackdrop');
 if (!layer) return;
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 let frame = 0;
 const paint = () => {
  frame = 0;
  const distance = document.documentElement.scrollHeight - innerHeight;
  const progress = distance > 0 ? Math.min(1, Math.max(0, scrollY / distance)) : 0;
  layer.style.transform = reduced.matches ? 'none' : `translate3d(0,${Math.round((progress - .5) * 100)}px,0)`;
 };
 const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
 window.addEventListener('scroll', schedule, {passive:true});
 window.addEventListener('resize', schedule, {passive:true});
 reduced.addEventListener('change', schedule);
 paint();
 window.addEventListener('pagehide', () => {
  cancelAnimationFrame(frame);
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
  reduced.removeEventListener('change', schedule);
 }, {once:true});
}
