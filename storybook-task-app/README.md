- **Create a project**:

```sh
pnpm create vite@latest
```

- **Add storybook**:

```sh
pnpm create storybook@latest
```

- **Add storybook addons**:

```sh
pnpm install -D @storybook/addon-interactions @storybook/addon-links msw msw-storybook-addon
```

## Usage

### Storybook

#### Build

```sh
npx http-server ./storybook-static
```

or

```sh
python3 -m http.server 5000
# then go to http://localhost:5000/storybook-static
```

## TODO

- [screen](https://storybook.js.org/tutorials/intro-to-storybook/react/en/test/)

## Related

- [intro-storybook-react-template](https://github.com/chromaui/intro-storybook-react-template/tree/master)
- [intro-to-storybook](https://storybook.js.org/tutorials/intro-to-storybook/react/en/simple-component/)
- [using-storybook-and-mock-service-worker-for-mocked-api-responses](https://blog.logrocket.com/using-storybook-and-mock-service-worker-for-mocked-api-responses/)
