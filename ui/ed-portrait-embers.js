// ui/ed-portrait-embers.js — <ed-portrait-embers>: a decorative canvas of rising
// embers layered over a portrait (Settings → Portrait animation → Embers).
//
// Purely visual: it never reads or writes app state and never takes pointer or
// focus (pointer-events: none), so the portrait/avatar underneath stays clickable.
// The particle maths lives in the pure ./portrait-anim.js. The element runs a
// requestAnimationFrame loop only while connected, the tab is visible and the
// system reduce-motion setting is off; otherwise it clears itself and schedules
// nothing. Mount it inside a `position: relative; overflow: hidden` frame.
import { LitElement, html, css } from 'lit';
import { stepEmbers } from './portrait-anim.js';

export class EdPortraitEmbers extends LitElement {
  static styles = css`
    :host { position: absolute; inset: 0; display: block; pointer-events: none; }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  `;

  constructor() {
    super();
    this._parts = [];
    this._raf = 0;
    this._last = 0;
    this._w = 0;
    this._h = 0;
    this._dpr = 1;
    this._ro = null;
    this._mq = null;
    this._onMq = () => this._sync();
    this._onVis = () => this._sync();
    this._tick = (now) => {
      this._raf = 0;
      const dt = this._last ? (now - this._last) / 1000 : 0;
      this._last = now;
      this._parts = stepEmbers(this._parts, dt, this._w, this._h, Math.random);
      this._draw();
      this._sync();
    };
  }

  render() {
    return html`<canvas aria-hidden="true"></canvas>`;
  }

  firstUpdated() {
    this._canvas = this.renderRoot.querySelector('canvas');
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this);
    }
    this._resize();
    this._sync();
  }

  connectedCallback() {
    super.connectedCallback();
    if (typeof window !== 'undefined' && window.matchMedia) {
      this._mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this._mq.addEventListener?.('change', this._onMq);
    }
    document.addEventListener('visibilitychange', this._onVis);
    if (this._canvas) {
      if (this._ro) this._ro.observe(this);
      this._resize();
      this._sync();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stop();
    this._ro?.disconnect();
    this._mq?.removeEventListener?.('change', this._onMq);
    this._mq = null;
    document.removeEventListener('visibilitychange', this._onVis);
    this._parts = [];
    this._clear();
  }

  _shouldRun() {
    return this.isConnected && !document.hidden && !this._mq?.matches && this._w > 0 && this._h > 0;
  }

  // Start or stop the loop to match the current conditions.
  _sync() {
    if (this._shouldRun()) {
      if (!this._raf) this._raf = requestAnimationFrame(this._tick);
    } else {
      this._stop();
      this._parts = [];
      this._clear();
    }
  }

  _stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._last = 0;
  }

  _resize() {
    if (!this._canvas) return;
    const r = this.getBoundingClientRect();
    this._w = r.width;
    this._h = r.height;
    this._dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    this._canvas.width = Math.max(0, Math.round(this._w * this._dpr));
    this._canvas.height = Math.max(0, Math.round(this._h * this._dpr));
    this._sync();
  }

  _clear() {
    const c = this._canvas;
    const ctx = c?.getContext?.('2d');
    if (ctx) ctx.clearRect(0, 0, c.width, c.height);
  }

  _draw() {
    const c = this._canvas;
    const ctx = c?.getContext?.('2d');
    if (!ctx) return;
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    ctx.clearRect(0, 0, this._w, this._h);
    for (const p of this._parts) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      if (p.kind === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(255, 190, 90, ${0.9 * a})`);
        g.addColorStop(0.4, `rgba(255, 110, 30, ${0.4 * a})`);
        g.addColorStop(1, 'rgba(255, 80, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(30, 24, 22, ${0.45 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

customElements.define('ed-portrait-embers', EdPortraitEmbers);
