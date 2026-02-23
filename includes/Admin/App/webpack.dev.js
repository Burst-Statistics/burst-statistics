const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const { TanStackRouterWebpack } = require( '@tanstack/router-plugin/webpack' );
const path = require( 'path' );
const webpack = require( 'webpack' );
const ESLintPlugin = require( 'eslint-webpack-plugin' );

module.exports = {
  ...defaultConfig,
  target: 'web',
  externals: {
    ...( defaultConfig.externals || {}),
    react: 'React',
    'react-dom': 'ReactDOM'
  },
  mode: 'development',
  devtool: 'eval-source-map', // Faster source maps for development
  output: {
    ...defaultConfig.output,
    filename: '[name].js',
    chunkFilename: '[name].js'
  },
  resolve: {
    ...defaultConfig.resolve,
    extensions: [ '.ts', '.tsx', '.js', '.jsx' ], // Add .ts and .tsx extensions
    alias: {
      '@': path.resolve( __dirname, 'src' ), // Alias for src directory
      'styled-components': path.resolve( __dirname, 'node_modules/styled-components' ) //fix style components error in console.
    }
  },
  module: {
    ...defaultConfig.module,
    rules: [

      // Exclude the default CSS rule to prevent conflicts
      ...defaultConfig.module.rules.filter(
        ( rule ) => ! String( rule.test ).includes( '\\.css$' )
      ),

      // Add TypeScript loader
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve( __dirname, 'tsconfig.json' )
            }
          }
        ]
      },

      // Add rule for processing CSS with PostCSS loader (for Tailwind)
      {
        test: /\.css$/,

        // include: path.resolve(__dirname, "src"), // Adjust path as needed
        use: [
          'style-loader', // Injects styles into DOM
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1 // Number of loaders applied before css-loader
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {

                // Use your custom postcss.config.js
                config: path.resolve( __dirname, 'postcss.config.js' )
             }
            }
          }
        ]
      }
    ]
  },
  plugins: [
    ...defaultConfig.plugins,
    TanStackRouterWebpack({ target: 'react', autoCodeSplitting: true }), // Add TanStackRouterWebpack plugin
    new ESLintPlugin({
      extensions: [ 'js', 'jsx', 'ts', 'tsx' ],
      emitWarning: true, // Show warnings in the output
      failOnError: false, // Optionally fail the build when an error is found
      overrideConfig: {
        rules: {
          'react/prop-types': 'off',
          'no-unused-vars': 'off'
        }
      }
    })
  ],
  watchOptions: {
    ignored: /node_modules/,
    poll: 1000,           // check for changes every second
    aggregateTimeout: 200
  },
  devServer: {
    hot: true,
    liveReload: true,
    static: {
      directory: path.resolve( __dirname, 'dist' ),
      watch: true
    },
    watchFiles: {
      paths: [ 'src/**/*' ],
      options: { usePolling: true, interval: 1000 }
    },
    client: { overlay: true }
  }
};
