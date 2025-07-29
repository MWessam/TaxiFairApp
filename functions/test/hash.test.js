const { hashIp } = require('../index');

describe('hashIp', () => {
  it('hashes consistently', () => {
    const ip = '192.168.0.1';
    const first = hashIp(ip);
    const second = hashIp(ip);
    expect(first).toBe(second);
  });

  it('returns unknown when ip missing', () => {
    expect(hashIp()).toBe('unknown');
  });
}); 