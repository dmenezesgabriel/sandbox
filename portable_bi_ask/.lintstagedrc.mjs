export default {
  '*': 'prettier --ignore-unknown --write',
  'src/**/*.{js,jsx,ts,tsx}': 'eslint --fix --cache --cache-location .cache/eslint/.eslintcache',
  'src/**/*.css': 'stylelint --fix --cache --cache-location .cache/stylelint/',
};
