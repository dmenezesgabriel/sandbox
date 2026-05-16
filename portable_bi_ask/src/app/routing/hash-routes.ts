export type Route =
  | { view: 'list' }
  | { view: 'editor'; slug: string; isNew?: boolean }
  | { view: 'questions' }
  | { view: 'question-editor'; slug: string; isNew?: boolean }
  | { view: 'datasources' }
  | { view: 'datasource-editor'; slug: string; isNew?: boolean };

type EditorView = 'editor' | 'question-editor' | 'datasource-editor';
type EditorRoute = { view: EditorView; slug: string; isNew?: boolean };

function parseEditorSegment(view: EditorView, rest: string): EditorRoute {
  if (rest === 'new') return { view, slug: 'new', isNew: true };
  if (rest.startsWith('new/')) {
    const slug = rest.replace(/^new\//, '');
    return { view, slug: slug || 'new', isNew: true };
  }
  return { view, slug: rest };
}

function editorHash(prefix: string, route: { slug: string; isNew?: boolean }): string {
  if (route.isNew) {
    return route.slug === 'new' ? `#/${prefix}/new` : `#/${prefix}/new/${route.slug}`;
  }
  return `#/${prefix}/${route.slug}`;
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (!path || path === '/') return { view: 'list' };

  if (path.startsWith('dashboard/'))
    return parseEditorSegment('editor', path.replace('dashboard/', ''));

  if (path === 'questions') return { view: 'questions' };
  if (path.startsWith('question/'))
    return parseEditorSegment('question-editor', path.replace('question/', ''));

  if (path === 'datasources') return { view: 'datasources' };
  if (path.startsWith('datasource/'))
    return parseEditorSegment('datasource-editor', path.replace('datasource/', ''));

  return { view: 'list' };
}

export function routeToHash(route: Route): string {
  if (route.view === 'list') return '#/';
  if (route.view === 'questions') return '#/questions';
  if (route.view === 'datasources') return '#/datasources';
  if (route.view === 'editor') return editorHash('dashboard', route);
  if (route.view === 'question-editor') return editorHash('question', route);
  if (route.view === 'datasource-editor') return editorHash('datasource', route);
  return '#/';
}
