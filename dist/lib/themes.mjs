// Domain identities. Shared by the browser, the build and the tests.
// `motif` is the key-visual type used when an app has not published its own graph.
// `title` picks the title-treatment style used for title art (see styles.css .title-art--*).
export const THEMES = {
  Manufacturing: {accent: '#B8A6FF', deep: '#2A1F4A', label: 'Build systems',         motif: 'flow',    title: 'condensed'},
  Data:          {accent: '#9CC8FF', deep: '#132A4D', label: 'Connected knowledge',   motif: 'network', title: 'wide'},
  Quality:       {accent: '#8FE3CF', deep: '#103833', label: 'Quality and trust',     motif: 'matrix',  title: 'didone'},
  Engineering:   {accent: '#E7A9F3', deep: '#3C1C43', label: 'Engineering signals',   motif: 'wave',    title: 'wide'},
  Finance:       {accent: '#F2C38F', deep: '#3B2A18', label: 'Cost and planning',     motif: 'bar',     title: 'didone'},
  Platform:      {accent: '#CE96FF', deep: '#2B1F55', label: 'Apps and intelligence', motif: 'radial',  title: 'condensed'}
};
export const DOMAINS = Object.keys(THEMES);
export const TITLE_STYLES = ['didone', 'condensed', 'wide'];
