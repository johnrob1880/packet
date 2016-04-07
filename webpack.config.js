var path = require('path')
var webpack = require('webpack')

module.exports = {
  entry: [
    './src/packet.js'
  ],
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'packet.js'
  },
  plugins: [
    new webpack.optimize.OccurenceOrderPlugin()
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loaders: [ 'babel' ],
        exclude: /node_modules/,
        include: __dirname
      },
      {
        test: /\.json$/,
        loaders: [ 'json' ],
        exclude: /node_modules/,
        include: __dirname
      }
    ]
  },
  resolve: {
    modulesDirectories: ['node_modules'],
    extensions: ['', '.js', '.jsx']
  }
}
