import { retry } from './retry';

describe('retry', () => {
  it('should succeed on first attempt', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');

    const result = await retry(mockFn, {
      retries: 3,
      initialDelayMs: 100,
      factor: 2,
    });

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success');

    const result = await retry(mockFn, {
      retries: 3,
      initialDelayMs: 10,
      factor: 2,
    });

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should fail after all retries exhausted', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Persistent failure'));

    await expect(retry(mockFn, {
      retries: 2,
      initialDelayMs: 10,
      factor: 2,
    })).rejects.toThrow('Persistent failure');

    expect(mockFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should use default factor of 2', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValue('success');

    const result = await retry(mockFn, {
      retries: 3,
      initialDelayMs: 10,
    });

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should handle zero retries', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Immediate failure'));

    await expect(retry(mockFn, {
      retries: 0,
      initialDelayMs: 10,
    })).rejects.toThrow('Immediate failure');

    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
