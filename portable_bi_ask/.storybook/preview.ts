import '../src/shared/styles/styles.css';
import type { Preview } from '@storybook/web-components-vite';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo'  — surface violations in the test UI without blocking CI
      // 'error' — fail CI on any violation (switch to this when baseline is clean)
      // 'off'   — skip automated checks entirely
      test: 'todo',
      options: {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
    },

    docs: {
      // Show the live source code panel in every canvas view (replaced Storysource addon in SB 9+)
      codePanel: true,
    },
  },
};

export default preview;
