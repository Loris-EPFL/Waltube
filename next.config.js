/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  trailingSlash: false,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Handle Node.js modules for browser environment
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        'node:module': false,
        'node:fs': false,
        'node:path': false,
        'node:url': false,
        'node:crypto': false,
        'node:stream': false,
        'node:util': false,
        'node:buffer': false,
        'node:process': false,
      };
      
      // Ignore specific modules that cause issues with Tusky SDK
      const webpack = require('webpack');
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(node:module|node:fs|node:path|node:url|node:crypto|node:stream|node:util|node:buffer|node:process)$/,
        }),
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        })
      );
      
      // Handle dynamic imports for Tusky SDK
      config.module.rules.push({
        test: /@tusky-io\/ts-sdk/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-syntax-dynamic-import']
          }
        }
      });
      
      // Handle dynamic imports for Tusky SDK
      config.module.rules.push({
        test: /@tusky-io\/ts-sdk/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-syntax-dynamic-import']
          }
        }
      });
    }
    return config;
  },
};
