const { tripSchema } = require('../schema');

describe('Trip schema validation', () => {
  it('accepts a valid payload', () => {
    const data = {
      fare: 50,
      distance: 10,
      duration: 20,
      passenger_count: 2,
      from: { lat: 30, lng: 31 },
      to: { lat: 30.1, lng: 31.1 }
    };
    expect(() => tripSchema.parse(data)).not.toThrow();
  });

  it('rejects negative fare', () => {
    const data = { fare: -5, distance: 5 };
    const result = tripSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects distance > 100', () => {
    const data = { fare: 10, distance: 150 };
    const result = tripSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
}); 