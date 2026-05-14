import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta = {
  title: 'Pages/Question Editor',
  component: 'question-editor',
  tags: ['autodocs', '!test'],
  render: (args) =>
    html`<question-editor
      .slug=${args['slug'] as string}
      .isNew=${args['isNew'] as boolean}
    ></question-editor>`,
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

export const NewQuestion: StoryObj = { args: { slug: 'new', isNew: true } };
export const ExistingQuestion: StoryObj = { args: { slug: 'sales-by-region', isNew: false } };
export const NotFound: StoryObj = { args: { slug: 'does-not-exist', isNew: false } };
