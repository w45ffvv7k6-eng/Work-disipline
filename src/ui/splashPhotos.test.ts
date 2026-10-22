import { describe, expect, it } from 'vitest';
import { isImageDataUrl } from './splashPhotos';

describe('images acceptées (photos, sauvegardes)', () => {
  it('accepte une vraie image encodée', () => {
    expect(isImageDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
    expect(isImageDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('refuse tout le reste (texte, code, image SVG, adresse extérieure)', () => {
    expect(isImageDataUrl('javascript:alert(1)')).toBe(false);
    expect(isImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isImageDataUrl('data:image/jpeg;base64,AAA") ; background: url("https://evil.example')).toBe(false);
    expect(isImageDataUrl('https://exemple.com/photo.jpg')).toBe(false);
    expect(isImageDataUrl(undefined)).toBe(false);
  });
});
