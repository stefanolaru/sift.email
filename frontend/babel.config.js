const presets = [
    [
        "@babel/env",
        {
            targets: {
                edge: "17",
                firefox: "60",
                chrome: "67",
                safari: "11.1",
            },
            corejs: "3.0.0",
            useBuiltIns: "usage",
        },
    ],
];

// const plugins = ["@babel/plugin-syntax-dynamic-import"];

module.exports = { presets };
