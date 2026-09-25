const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const { TanStackRouterWebpack } = require( '@tanstack/router-plugin/webpack' );
const path = require( 'path' );

/**
 * Fail the build process when the compilation has errors.
 *
 * webpack-cli sets process.exitCode = 1 for a compilation with errors, but
 * @tanstack/router-plugin (code splitter and route generator) calls
 * process.exit(0) from a timer after the `done` hook in production mode, which
 * discards that exit code: `npm run build` then succeeds although no index
 * bundle was emitted (seen in CI on 2026-09-21, the settings page 404'd on the
 * script and showed the adblocker overlay). The exit code is decided here.
 */
class FailOnCompilationErrorsPlugin {
  apply( compiler ) {
    compiler.hooks.done.tap( 'BurstFailOnCompilationErrors', ( stats ) => {
      if ( ! stats.hasErrors() ) {
        return;
      }
      process.exitCode = 1;
      const exit = process.exit.bind( process );
      process.exit = ( code ) => exit( code ? code : 1 );
    });
  }
}

module.exports = {
  ...defaultConfig,
  target: 'web',
  externals: {
    ...( defaultConfig.externals || {}),
    react: 'React',
    'react-dom': 'ReactDOM'
  },
  output: {
    ...defaultConfig.output,
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].js',
    clean: { keep: /^(fonts|images)\/|^tailwind\.generated\.css(\.map)?$/ }, // keep wp-scripts' fonts/images rule, plus the postcss output that lives next to the JS bundle
  },
  resolve: {
    ...defaultConfig.resolve,
    extensions: [ '.ts', '.tsx', '.js', '.jsx' ], // Add .ts and .tsx extensions
    alias: {
      '@': path.resolve( __dirname, 'src' ), // Add alias for src directory
      'styled-components': path.resolve( __dirname, 'node_modules/styled-components' ) //fix style components error in console.
    }
  },
  module: {
    ...defaultConfig.module,
    rules: [
      ...defaultConfig.module.rules,

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
      }
    ]
  },
  plugins: [
    ...defaultConfig.plugins,
    TanStackRouterWebpack({ target: 'react', autoCodeSplitting: true }), // Add TanStackRouterWebpack plugin
    new FailOnCompilationErrorsPlugin()
  ],
  optimization: {
    ...defaultConfig.optimization,
    minimize: true, // Enable minification for production
    splitChunks: {
      ...defaultConfig.optimization.splitChunks,
      cacheGroups: {
        ...defaultConfig.optimization.splitChunks.cacheGroups,

        // wp-scripts disables the default group, so modules from src/ used by
        // several route chunks were copied into each of them. Share them.
        shared: {
          chunks: 'async',
          minChunks: 2,
          minSize: 30000,
          priority: -20,
          reuseExistingChunk: true
        }
      }
    }
  }
};
