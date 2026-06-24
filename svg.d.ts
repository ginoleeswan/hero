// react-native-svg-transformer turns `import Logo from './logo.svg'` into a
// react-native-svg component (not an image asset). Declare the module so TS
// treats .svg imports as SVG components.
declare module '*.svg' {
  import type React from 'react';
  import type { SvgProps } from 'react-native-svg';

  const content: React.FC<SvgProps>;
  export default content;
}
