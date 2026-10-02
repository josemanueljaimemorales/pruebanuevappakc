(function(){
  const c = window.CLIENTE || {};
  const script = document.currentScript;
  const logo = new URL(c.logo || 'logo.png', script ? script.src : location.href).href;
  const root = document.documentElement;
  if (c.colores) {
    root.style.setProperty('--cliente-primary', c.colores.principal || '#2386b8');
    root.style.setProperty('--cliente-secondary', c.colores.secundario || '#8d3ab2');
    root.style.setProperty('--cliente-accent', c.colores.acento || '#ed1687');
  }
  function apply(){
    document.querySelectorAll('[data-cliente-logo]').forEach(el=>{
      el.src = logo;
      el.alt = c.nombre || 'Logo';
    });
    document.querySelectorAll('[data-cliente-name]').forEach(el=>el.textContent=c.nombre||'');
    document.querySelectorAll('[data-cliente-subtitle]').forEach(el=>el.textContent=c.subtitulo||'');
    if(c.nombre) document.title = document.title.replace(/Águilas[^·—-]*|AKC|BKA|Kids Center/gi,c.nombre).replace(/\s{2,}/g,' ').trim();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
