import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ScopeBar } from '../../src/components/search/ScopeBar';

jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));

describe('ScopeBar', () => {
  it('renders all four scopes', () => {
    const { getByTestId } = render(<ScopeBar value="All" onChange={() => {}} />);
    expect(getByTestId('scope-All')).toBeTruthy();
    expect(getByTestId('scope-Marvel')).toBeTruthy();
    expect(getByTestId('scope-DC')).toBeTruthy();
    expect(getByTestId('scope-Other')).toBeTruthy();
  });

  it('calls onChange with the pressed scope', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<ScopeBar value="All" onChange={onChange} />);
    fireEvent.press(getByTestId('scope-Marvel'));
    expect(onChange).toHaveBeenCalledWith('Marvel');
  });
});
