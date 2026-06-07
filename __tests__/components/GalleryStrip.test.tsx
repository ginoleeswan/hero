import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GalleryStrip } from '../../src/components/GalleryStrip';

jest.mock('expo-image', () => ({ Image: 'Image' }));

const IMAGES = [
  { url: 'https://example.com/a.jpg', caption: 'Issue #1' },
  { url: 'https://example.com/b.jpg', caption: null },
];

describe('GalleryStrip', () => {
  it('renders the correct number of image cards', () => {
    const { getAllByTestId } = render(
      <GalleryStrip images={IMAGES} onPress={jest.fn()} />,
    );
    expect(getAllByTestId('gallery-card')).toHaveLength(2);
  });

  it('calls onPress with the correct index', () => {
    const onPress = jest.fn();
    const { getAllByTestId } = render(
      <GalleryStrip images={IMAGES} onPress={onPress} />,
    );
    fireEvent.press(getAllByTestId('gallery-card')[1]);
    expect(onPress).toHaveBeenCalledWith(1);
  });

  it('renders nothing when images array is empty', () => {
    const { queryByTestId } = render(
      <GalleryStrip images={[]} onPress={jest.fn()} />,
    );
    expect(queryByTestId('gallery-card')).toBeNull();
  });
});
