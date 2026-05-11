/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'custom-property-pattern': null,
    'selector-class-pattern': null,
    'selector-id-pattern': null,
    'no-descending-specificity': null,
    'declaration-block-no-duplicate-properties': true,
    'comment-empty-line-before': null,
    'comment-whitespace-inside': null,
  },
};
