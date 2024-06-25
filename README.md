# @cyansalt/vue-loader

> webpack loader for Vue Single-File Components

## What is Vue Loader?

`@cyansalt/vue-loader` is a loader for [webpack](https://webpack.js.org/) that allows you to author Vue components in a format called [Single-File Components (SFCs)](https://github.com/vuejs/vue-loader/blob/main/docs/spec.md):

```vue
<template>
  <div class="example">{{ msg }}</div>
</template>

<script>
export default {
  data () {
    return {
      msg: 'Hello world!'
    }
  }
}
</script>

<style>
.example {
  color: red;
}
</style>
```

There are many cool features provided by `@cyansalt/vue-loader`:

- Allows using other webpack loaders for each part of a Vue component, for example Sass for `<style>` and Pug for `<template>`;
- Allows custom blocks in a `.vue` file that can have custom loader chains applied to them;
- Treat static assets referenced in `<style>` and `<template>` as module dependencies and handle them with webpack loaders;
- Simulate scoped CSS for each component;
- State-preserving hot-reloading during development.

In a nutshell, the combination of webpack and `@cyansalt/vue-loader` gives you a modern, flexible and extremely powerful front-end workflow for authoring Vue.js applications.
