// Jest stub for `import X from '*.svg'`. Metro uses react-native-svg-transformer
// to turn SVGs into components; jest doesn't run that transform, so map .svg to
// this stub component (a function, matching the real component shape the
// PublisherBadge type-guards on with `typeof logo === 'function'`).
const React = require('react');

function SvgMock(props) {
  return React.createElement('svg', props);
}

module.exports = SvgMock;
module.exports.default = SvgMock;
