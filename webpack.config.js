const path = require('path');

module.exports = [
  {
    name: 'popup',
    mode: 'production',
    entry: './src/popup/popup.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'popup.js'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    }
  },
  {
    name: 'content',
    mode: 'production',
    entry: './src/content/content-script.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'content-script.js'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    }
  },
  {
    name: 'background',
    mode: 'production',
    entry: './src/background/background-script.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'background-script.js'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    }
  }
];
