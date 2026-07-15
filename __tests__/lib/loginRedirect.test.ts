import { sanitizeReturnTo, loginHref, signupHref } from '../../src/lib/loginRedirect';

describe('sanitizeReturnTo', () => {
  it('accepts same-app absolute paths', () => {
    expect(sanitizeReturnTo('/character/123')).toBe('/character/123');
    expect(sanitizeReturnTo('/versus/team/abc?x=y')).toBe('/versus/team/abc?x=y');
  });

  it('takes the first element of an array param', () => {
    expect(sanitizeReturnTo(['/character/9', '/other'])).toBe('/character/9');
  });

  it('rejects empty / missing values', () => {
    expect(sanitizeReturnTo(undefined)).toBeNull();
    expect(sanitizeReturnTo('')).toBeNull();
    expect(sanitizeReturnTo([])).toBeNull();
  });

  it('rejects external and protocol-relative URLs', () => {
    expect(sanitizeReturnTo('https://evil.com')).toBeNull();
    expect(sanitizeReturnTo('//evil.com')).toBeNull();
    expect(sanitizeReturnTo('http://evil.com/path')).toBeNull();
    expect(sanitizeReturnTo('javascript:alert(1)')).toBeNull();
  });

  it('rejects the root and the auth group (would loop / be pointless)', () => {
    expect(sanitizeReturnTo('/')).toBeNull();
    expect(sanitizeReturnTo('/(auth)/login')).toBeNull();
    expect(sanitizeReturnTo('/(auth)/signup')).toBeNull();
  });
});

describe('loginHref / signupHref', () => {
  it('returns a bare route string when there is no safe returnTo', () => {
    expect(loginHref(null)).toBe('/(auth)/login');
    expect(loginHref('/')).toBe('/(auth)/login');
    expect(loginHref('https://evil.com')).toBe('/(auth)/login');
    expect(signupHref(undefined)).toBe('/(auth)/signup');
  });

  it('carries a sanitized returnTo as a param object', () => {
    expect(loginHref('/character/9')).toEqual({
      pathname: '/(auth)/login',
      params: { returnTo: '/character/9' },
    });
    expect(signupHref('/versus/team/abc')).toEqual({
      pathname: '/(auth)/signup',
      params: { returnTo: '/versus/team/abc' },
    });
  });
});
