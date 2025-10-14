import { TokenPrice } from './token-price';

describe('TokenPrice', () => {
  describe('create', () => {
    it('should create valid token price', () => {
      const price = TokenPrice.create(1000);
      expect(price.getValue()).toBe(1000);
    });

    it('should reject negative prices', () => {
      expect(() => TokenPrice.create(-100)).toThrow('Token price must be positive');
    });

    it('should reject zero price', () => {
      expect(() => TokenPrice.create(0)).toThrow('Token price must be positive');
    });

    it('should reject prices exceeding safe integer limit', () => {
      const tooLarge = Number.MAX_SAFE_INTEGER + 1;
      expect(() => TokenPrice.create(tooLarge)).toThrow('Token price exceeds safe integer limit');
    });

    it('should accept prices with up to 8 decimal places', () => {
      const price = TokenPrice.create(1000.12345678);
      expect(price.getValue()).toBe(1000.12345678);
    });

    it('should reject prices with more than 8 decimal places', () => {
      expect(() => TokenPrice.create(1000.123456789)).toThrow('Too many decimal places for token price precision');
    });
  });

  describe('arithmetic operations', () => {
    it('should add prices correctly', () => {
      const price1 = TokenPrice.create(1000);
      const price2 = TokenPrice.create(500);
      const result = price1.add(price2);
      expect(result.getValue()).toBe(1500);
    });

    it('should subtract prices correctly', () => {
      const price1 = TokenPrice.create(1000);
      const price2 = TokenPrice.create(300);
      const result = price1.subtract(price2);
      expect(result.getValue()).toBe(700);
    });

    it('should multiply by factor correctly', () => {
      const price = TokenPrice.create(1000);
      const result = price.multiply(1.5);
      expect(result.getValue()).toBe(1500);
    });

    it('should validate arithmetic results', () => {
      const price1 = TokenPrice.create(1000);
      const price2 = TokenPrice.create(500);

      // Test that subtraction can result in negative, which should be caught
      expect(() => price2.subtract(price1)).toThrow('Token price must be positive');
    });
  });

  describe('equality', () => {
    it('should compare prices correctly', () => {
      const price1 = TokenPrice.create(1000);
      const price2 = TokenPrice.create(1000);
      const price3 = TokenPrice.create(2000);

      expect(price1.equals(price2)).toBe(true);
      expect(price1.equals(price3)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should convert to string correctly', () => {
      const price = TokenPrice.create(1000.50);
      expect(price.toString()).toBe('1000.5');
    });
  });
});
