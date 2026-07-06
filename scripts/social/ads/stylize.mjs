// Zero-dependency portrait stylization via inline SVG filters, applied at
// Chrome render time. Turns a raw render into a "clearly transformed graphic"
// for Tier A/B ad depiction. Brand palette: navy #06121a / gold #e0a83e.
export const STYLES = ['duotone', 'poster', 'halftone'];

// Inject once per page. Defines every filter; slides reference by id.
export function svgFilterDefs() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <filter id="mq-duotone" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"/>
      <feComponentTransfer>
        <feFuncR type="table" tableValues="0.024 0.878"/>
        <feFuncG type="table" tableValues="0.071 0.659"/>
        <feFuncB type="table" tableValues="0.102 0.243"/>
      </feComponentTransfer>
    </filter>
    <filter id="mq-poster" color-interpolation-filters="sRGB">
      <feComponentTransfer>
        <feFuncR type="discrete" tableValues="0 0.25 0.5 0.75 1"/>
        <feFuncG type="discrete" tableValues="0 0.25 0.5 0.75 1"/>
        <feFuncB type="discrete" tableValues="0 0.25 0.5 0.75 1"/>
      </feComponentTransfer>
    </filter>
    <filter id="mq-halftone" color-interpolation-filters="sRGB">
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="1 1"/></feComponentTransfer>
    </filter>
  </defs></svg>`;
}

export function styleAttr(style) {
  return `filter:url(#mq-${style});`;
}
