import React from 'react';
import { render, fireEvent, userEvent } from '@testing-library/react-native';
import { HeartButton } from '../../src/components/HeartButton';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('HeartButton', () => {
  it('renders without crashing when not favourited', () => {
    const { getByTestId } = render(
      <HeartButton favourited={false} loading={false} onPress={() => {}} />,
    );
    expect(getByTestId('heart-button')).toBeTruthy();
  });

  it('renders without crashing when favourited', () => {
    const { getByTestId } = render(
      <HeartButton favourited={true} loading={false} onPress={() => {}} />,
    );
    expect(getByTestId('heart-button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <HeartButton favourited={false} loading={false} onPress={onPress} />,
    );
    fireEvent.press(getByTestId('heart-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when loading', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    const { getByTestId } = render(
      <HeartButton favourited={false} loading={true} onPress={onPress} />,
    );
    await user.press(getByTestId('heart-button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
