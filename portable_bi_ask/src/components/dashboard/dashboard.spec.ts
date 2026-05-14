import { describe, expect, it } from 'vitest';

import { parseHash, routeToHash } from './dashboard';

describe('parseHash — dashboard routes', () => {
  it('parses empty hash', () => {
    expect(parseHash('')).toEqual({ view: 'list' });
  });
  it('parses #/', () => {
    expect(parseHash('#/')).toEqual({ view: 'list' });
  });
  it('parses #/dashboard/my-dash', () => {
    expect(parseHash('#/dashboard/my-dash')).toEqual({ view: 'editor', slug: 'my-dash' });
  });
  it('parses #/dashboard/new', () => {
    expect(parseHash('#/dashboard/new')).toEqual({ view: 'editor', slug: 'new', isNew: true });
  });
  it('parses #/dashboard/new/my-slug', () => {
    expect(parseHash('#/dashboard/new/my-slug')).toEqual({
      view: 'editor',
      slug: 'my-slug',
      isNew: true,
    });
  });
});

describe('parseHash — question routes', () => {
  it('parses #/questions', () => {
    expect(parseHash('#/questions')).toEqual({ view: 'questions' });
  });
  it('parses #/question/my-chart', () => {
    expect(parseHash('#/question/my-chart')).toEqual({
      view: 'question-editor',
      slug: 'my-chart',
    });
  });
  it('parses #/question/new', () => {
    expect(parseHash('#/question/new')).toEqual({
      view: 'question-editor',
      slug: 'new',
      isNew: true,
    });
  });
  it('parses #/question/new/my-slug', () => {
    expect(parseHash('#/question/new/my-slug')).toEqual({
      view: 'question-editor',
      slug: 'my-slug',
      isNew: true,
    });
  });
});

describe('routeToHash — dashboard routes', () => {
  it('serialises list view', () => {
    expect(routeToHash({ view: 'list' })).toBe('#/');
  });
  it('serialises editor view', () => {
    expect(routeToHash({ view: 'editor', slug: 'my-dash' })).toBe('#/dashboard/my-dash');
  });
  it('serialises new editor (no slug)', () => {
    expect(routeToHash({ view: 'editor', slug: 'new', isNew: true })).toBe('#/dashboard/new');
  });
  it('serialises new editor (with slug)', () => {
    expect(routeToHash({ view: 'editor', slug: 'my-dash', isNew: true })).toBe(
      '#/dashboard/new/my-dash',
    );
  });
});

describe('routeToHash — question routes', () => {
  it('serialises questions view', () => {
    expect(routeToHash({ view: 'questions' })).toBe('#/questions');
  });
  it('serialises question-editor view', () => {
    expect(routeToHash({ view: 'question-editor', slug: 'my-chart' })).toBe('#/question/my-chart');
  });
  it('serialises new question-editor', () => {
    expect(routeToHash({ view: 'question-editor', slug: 'new', isNew: true })).toBe(
      '#/question/new',
    );
  });
  it('serialises new question-editor with slug', () => {
    expect(routeToHash({ view: 'question-editor', slug: 'my-chart', isNew: true })).toBe(
      '#/question/new/my-chart',
    );
  });
});
