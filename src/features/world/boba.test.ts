import { describe, expect, it } from 'vitest';
import { bobaLine } from './places';

describe('her bubble tea', () => {
  it('is only perfect with tapioca, lots of sugar and a little ice', () => {
    expect(bobaLine({ pearls: 1, sugar: 3, ice: 1 }).perfect).toBe(true);
    expect(bobaLine({ pearls: 1, sugar: 1, ice: 1 }).text).toContain('Meer suiker');
    expect(bobaLine({ pearls: 1, sugar: 3, ice: 2 }).text).toContain('weinig ijs');
    expect(bobaLine({ pearls: 0, sugar: 3, ice: 1 }).perfect).toBe(false);
  });
});
