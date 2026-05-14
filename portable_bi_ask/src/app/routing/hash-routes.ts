export type Route =
  | { view: 'list' }
  | { view: 'editor'; slug: string; isNew?: boolean }
  | { view: 'questions' }
  | { view: 'question-editor'; slug: string; isNew?: boolean };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (!path || path === '/') return { view: 'list' };

  if (path.startsWith('dashboard/')) {
    const rest = path.replace('dashboard/', '');
    if (rest === 'new') return { view: 'editor', slug: 'new', isNew: true };
    if (rest.startsWith('new/')) {
      const slug = rest.replace(/^new\//, '');
      return { view: 'editor', slug: slug || 'new', isNew: true };
    }
    return { view: 'editor', slug: rest };
  }

  if (path === 'questions') return { view: 'questions' };

  if (path.startsWith('question/')) {
    const rest = path.replace('question/', '');
    if (rest === 'new') return { view: 'question-editor', slug: 'new', isNew: true };
    if (rest.startsWith('new/')) {
      const slug = rest.replace(/^new\//, '');
      return { view: 'question-editor', slug: slug || 'new', isNew: true };
    }
    return { view: 'question-editor', slug: rest };
  }

  return { view: 'list' };
}

export function routeToHash(route: Route): string {
  if (route.view === 'list') return '#/';
  if (route.view === 'questions') return '#/questions';
  if (route.view === 'editor') {
    if (route.isNew) {
      return route.slug === 'new' ? '#/dashboard/new' : `#/dashboard/new/${route.slug}`;
    }
    return `#/dashboard/${route.slug}`;
  }
  if (route.view === 'question-editor') {
    if (route.isNew) {
      return route.slug === 'new' ? '#/question/new' : `#/question/new/${route.slug}`;
    }
    return `#/question/${route.slug}`;
  }
  return '#/';
}
