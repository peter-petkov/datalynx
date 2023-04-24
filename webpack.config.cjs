const path = require('path');

module.exports = {
    entry: {
        "index": "./src/autocomplete.ts",
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "[name].js",
    },
    devtool: "inline-source-map",
    experiments: {
        topLevelAwait: true
    },
    resolve: {
        extensions: [".ts"]
    },
    module: {
        rules: [
            {test: /\.ts/, use: "ts-loader"}
        ]
    }
};