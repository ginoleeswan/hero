import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ImageLightbox } from '../../src/components/ImageLightbox';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const IMAGES = [
  { url: 'https://example.com/a.jpg', caption: 'Art 1' },
  { url: 'https://example.com/b.jpg', caption: null },
];

describe('ImageLightbox', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <ImageLightbox images={IMAGES} initialIndex={0} onClose={jest.fn()} />,
    );
    expect(getByTestId('lightbox-modal')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <ImageLightbox images={IMAGES} initialIndex={0} onClose={onClose} />,
    );
    fireEvent.press(getByTestId('lightbox-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
