'use strict';

const { View, Text, Image, ScrollView } = require('react-native');

const NOOP = () => {};
const ID = (t) => t;
const IMMEDIATE_CALLBACK_INVOCATION = (callback) => callback();

const useSharedValue = (init) => {
  const value = { value: init };
  return new Proxy(value, {
    get(target, prop) {
      if (prop === 'value') return target.value;
      if (prop === 'get') return () => target.value;
      if (prop === 'set')
        return (v) => {
          target.value = typeof v === 'function' ? v(target.value) : v;
        };
    },
    set(target, prop, newValue) {
      if (prop === 'value') {
        target.value = newValue;
        return true;
      }
      return false;
    },
  });
};

const useAnimatedStyle = IMMEDIATE_CALLBACK_INVOCATION;

const withSpring = (toValue, _config, callback) => {
  if (callback) callback(true);
  return toValue;
};

const withTiming = (toValue, _config, callback) => {
  if (callback) callback(true);
  return toValue;
};

const withSequence = (..._args) => 0;

const withDelay = (_delay, nextAnimation) => nextAnimation;

const withRepeat = ID;

const cancelAnimation = NOOP;

const runOnJS = ID;
const runOnUI = ID;

const createAnimatedComponent = ID;

const Animated = {
  View,
  Text,
  Image,
  ScrollView,
  createAnimatedComponent,
  interpolate: NOOP,
  interpolateColor: NOOP,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps: IMMEDIATE_CALLBACK_INVOCATION,
  useAnimatedRef: () => ({ current: null }),
  useAnimatedScrollHandler: () => NOOP,
  useDerivedValue: (processor) => {
    const result = processor();
    return { value: result, get: () => result };
  },
  useAnimatedReaction: NOOP,
  useAnimatedSensor: () => ({
    sensor: { value: {} },
    unregister: NOOP,
    isAvailable: false,
    config: {},
  }),
  useAnimatedKeyboard: () => ({ height: 0, state: 0 }),
  useScrollViewOffset: () => ({ value: 0 }),
  useScrollOffset: () => ({ value: 0 }),
  useEvent: () => NOOP,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  cancelAnimation,
  runOnJS,
  runOnUI,
  createAnimatedComponent,
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  interpolate: NOOP,
  interpolateColor: NOOP,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  SensorType: {},
  IOSReferenceFrame: {},
  InterfaceOrientation: {},
  KeyboardState: {},
  ColorSpace: {},
  reanimatedVersion: '4.0.0',
  setUpTests: NOOP,
  withReanimatedTimer: NOOP,
  advanceAnimationByTime: NOOP,
  advanceAnimationByFrame: NOOP,
  getAnimatedStyle: (style) => style,
  enableLayoutAnimations: NOOP,
  makeMutable: ID,
};
