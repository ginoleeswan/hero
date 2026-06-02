import React from 'react';
import { render } from '@testing-library/react-native';
import { HeroCard } from '../../src/components/HeroCard';

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

describe('HeroCard', () => {
  it('renders the hero name', () => {
    const { getByText } = render(
      <HeroCard id="620" name="Spider-Man" imageUrl={null} width={240} height={300} />,
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
        width={240}
        height={300}
      />,
    );
    expect(getByText('Spider-Man')).toBeTruthy();
  });
});
