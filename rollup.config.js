import { terser } from "rollup-plugin-terser";
import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import { name } from "./package.json";

export default {
    input: "src/stockdata-query.js",
    external: ["moment", "lodash", "pino"],
    plugins: [
        resolve(),
        babel({
            exclude: "node_modules/**",
            babelHelpers: "runtime",
        }),
        commonjs({
            include: "node_modules/**",
        }),
        terser(),
    ],
    output: [
        {
            file: "stockdata-query.js",
            format: "umd",
            name,
            sourcemap: true,
        },
        {
            file: "stockdata-query.esm.js",
            format: "es",
        },
    ],
};
