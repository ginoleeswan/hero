import React from 'react';
import { render } from '@testing-library/react-native';
import { HeroCard } from '../../src/components/HeroCard';

jest.mock('react-native-touchable-scale', () => 'TouchableScale');
jest.mock('@react-native-masked-view/masked-view', () => ({
  __esModule: true,
  default: 'MaskedView',
}));
jest.mock('react-native-figma-squircle', () => ({
  SquircleView: 'SquircleView',
}));
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

describe('HeroCard', () => {
  it('renders the hero name', () => {
    const { getByText } = render(
      <HeroCard id="620" name="Spider-Man" imageUrl={null} onPress={() => {}} />,
    );
    expect(getByText('Spider-Man')).toBeTruthy();
  });

  it('renders with a portraitUrl without crashing', () => {
    const { getByText } = render(
      <HeroCard
        id="620"
        name="Spider-Man"
        imageUrl={null}
        portraitUrl="https://storage.example.com/620.jpg"
        onPress={() => {}}
      />,
    );
    expect(getByText('Spider-Man')).toBeTruthy();
  });
});
