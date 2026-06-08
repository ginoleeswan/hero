import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FilterChips, type FilterOption } from '../../src/components/search/FilterChips';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));

const OPTIONS: FilterOption<string>[] = [
  { value: 'All', label: 'All' },
  { value: 'Marvel', label: 'Marvel' },
  { value: 'DC', label: 'DC' },
];

describe('FilterChips', () => {
  it('renders every option with its testID prefix', () => {
    const { getByTestId } = render(
      <FilterChips value="All" options={OPTIONS} onChange={() => {}} idPrefix="scope" />,
    );
    expect(getByTestId('scope-All')).toBeTruthy();
    expect(getByTestId('scope-Marvel')).toBeTruthy();
    expect(getByTestId('scope-DC')).toBeTruthy();
  });

  it('calls onChange with the pressed value', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <FilterChips value="All" options={OPTIONS} onChange={onChange} idPrefix="scope" />,
    );
    fireEvent.press(getByTestId('scope-Marvel'));
    expect(onChange).toHaveBeenCalledWith('Marvel');
  });
});
