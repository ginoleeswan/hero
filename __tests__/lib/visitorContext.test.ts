import { parseUserAgent } from '../../src/lib/visitorContext';

const UA = {
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1',
  edgeWin:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  samsungAndroid:
    'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  ipadOsDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
};

describe('parseUserAgent', () => {
  it.each([
    ['chromeMac', 'Chrome', 'macOS'],
    ['safariIphone', 'Safari', 'iOS'],
    ['chromeIos', 'Chrome', 'iOS'],
    ['edgeWin', 'Edge', 'Windows'],
    ['firefoxLinux', 'Firefox', 'Linux'],
    ['samsungAndroid', 'Samsung Internet', 'Android'],
    ['ipadOsDesktopMode', 'Safari', 'iPadOS'],
    ['googlebot', 'Bot', 'Other'],
  ] as const)('%s → %s on %s', (key, browser, os) => {
    expect(parseUserAgent(UA[key])).toEqual({ browser, os });
  });

  it('degrades to Other/Other for empty input', () => {
    expect(parseUserAgent('')).toEqual({ browser: 'Other', os: 'Other' });
    expect(parseUserAgent(null)).toEqual({ browser: 'Other', os: 'Other' });
  });
});
