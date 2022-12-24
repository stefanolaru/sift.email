// webpack v5
const webpack = require("webpack");
const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserJSPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const WebpackBar = require("webpackbar");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { VueLoaderPlugin } = require("vue-loader");
const Dotenv = require("dotenv-webpack");
const fs = require("fs");

const config = {
    entry: {
        main: "./src/js/index.js",
    },
    resolve: {
        alias: {
            vue: "vue/dist/vue.esm-bundler.js",
        },
    },
    optimization: {
        minimizer: [new TerserJSPlugin({}), new CssMinimizerPlugin()],
    },
    output: {
        path: path.join(__dirname, "./build"),
        publicPath: "/",
        filename: "[name].js",
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                },
            },
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    "css-loader",
                    "postcss-loader",
                ],
            },
            {
                test: /\.(gif|png|jpe?g|ico|svg)$/i,
                generator: {
                    filename: "img/[name][ext]",
                },
                type: "asset/resource",
            },
            {
                test: /\.vue$/,
                loader: "vue-loader",
            },
        ],
    },
    plugins: [
        new WebpackBar(),
        new webpack.DefinePlugin({
            __VUE_OPTIONS_API__: true,
            __VUE_PROD_DEVTOOLS__: false,
        }),
        new VueLoaderPlugin(),
        new HtmlWebpackPlugin({
            inject: false,
            template: "./src/index.html",
            filename: "index.html",
        }),
        new MiniCssExtractPlugin(),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: "src/img",
                    to: "img",
                },
                {
                    from: "src/img/favicon.ico",
                    to: "favicon.ico",
                },
            ],
        }),
    ],
};

module.exports = (env, argv) => {
    //
    if (argv.mode == "development") {
        Object.assign(config, {
            devServer: {
                static: path.join(process.cwd(), "build"),
                compress: false,
                watchFiles: {
                    paths: ["build/*.html"],
                    options: {
                        usePolling: false,
                    },
                },
                devMiddleware: {
                    writeToDisk: true,
                },
                host: "lvh.me",
                port: 3000,
                server: {
                    type: "https",
                    options: {
                        key: fs.readFileSync("lvh.me-key.pem"),
                        cert: fs.readFileSync("lvh.me.pem"),
                    },
                },
                headers: {
                    "Access-Control-Allow-Origin": "*",
                },
            },
        });
        // load .env.dev vars
        config.plugins.push(
            new Dotenv({
                path: "../.env.prod",
            })
        );
    } else {
        // production mode by default
        config.plugins.push(
            new Dotenv({
                path: "../.env.prod",
            })
        );
    }

    console.log(process.env);

    return config;
};
