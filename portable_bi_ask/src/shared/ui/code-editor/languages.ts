import { javascript } from '@codemirror/lang-javascript';
import { sql, StandardSQL } from '@codemirror/lang-sql';
import type { Extension } from '@codemirror/state';

export const SQL: Extension = sql({ dialect: StandardSQL, upperCaseKeywords: true });
export const JAVASCRIPT: Extension = javascript();
