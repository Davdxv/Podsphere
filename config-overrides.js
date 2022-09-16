/* eslint-disable */
const webpack = require('webpack');

module.exports = function override(config) {
  const loaders = config.resolve;
  loaders.fallback = {
    path: require.resolve('path-browserify'),
    zlib: require.resolve('browserify-zlib'),
    stream: require.resolve('stream-browserify'),
    crypto: require.resolve('crypto-browserify'),
    assert: require.resolve('assert'),
    constants: require.resolve('constants-browserify'),
    // buffer: require.resolve('buffer/'),
  };
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ]);
  // config.module.rules.push({
  //   test: /\.scss$/,
  //   // use: ['style-loader', 'css-loader', 'sass-loader'],
  //   use: [
  //     {
  //       loader: "style-loader",
  //     },
  //     {
  //       loader: "css-loader", // translates CSS into CommonJS
  //     },
  //     {
  //       loader: "sass-loader", // compiles sass to CSS
  //     },
  //   ],
  // });

  return config;
};
