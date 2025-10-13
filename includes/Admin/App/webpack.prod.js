const defaultConfig = require("@wordpress/scripts/config/webpack.config");
const { TanStackRouterWebpack } = require("@tanstack/router-plugin/webpack");
const path = require("path");

module.exports = {
  ...defaultConfig,
  target: 'web',
  externals: {
    ...(defaultConfig.externals || {}),
    react: 'React',
    'react-dom': 'ReactDOM',
  },
  output: {
    ...defaultConfig.output,
    filename: "[name].[contenthash].js",
    chunkFilename: "[name].[contenthash].js",
  },
  resolve: {
    ...defaultConfig.resolve,
    extensions: [".ts", ".tsx", ".js", ".jsx"], // Add .ts and .tsx extensions
    alias: {
      "@": path.resolve(__dirname, "src"), // Add alias for src directory
    },
  },
  module: {
    ...defaultConfig.module,
    rules: [
      // Exclude the default CSS rule to prevent conflicts
      ...defaultConfig.module.rules.filter(
        (rule) => !String(rule.test).includes("\\.css$"),
      ),
      // Add TypeScript loader
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: path.resolve(__dirname, "tsconfig.json"),
            },
          },
        ],
      },
      // Add rule for processing CSS with PostCSS loader (for Tailwind)
      {
        test: /\.css$/,
        include: path.resolve(__dirname, "src"), // Adjust path as needed
        use: [
          "style-loader", // Injects styles into DOM
          {
            loader: "css-loader",
            options: {
              importLoaders: 1, // Number of loaders applied before css-loader
            },
          },
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                // Use your custom postcss.config.js
                config: path.resolve(__dirname, "postcss.config.js"),
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    ...defaultConfig.plugins,
    TanStackRouterWebpack({ target: 'react', autoCodeSplitting: true }), // Add TanStackRouterWebpack plugin
  ], 
  optimization: {
    ...defaultConfig.optimization,
    minimize: true, // Enable minification for production
  },
};
