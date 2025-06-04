import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import typescript from '@rollup/plugin-typescript';

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                file: 'dist/index.js',
                format: 'es',
                sourcemap: true
            },
            {
                file: 'dist/index.cjs',
                format: 'cjs',
                exports: 'auto',
                sourcemap: true
            }
        ],
        plugins: [
            nodeResolve(),
            commonjs(),
            typescript(),
            terser()
        ]
    },
    {
        input: './dist/types/index.d.ts',
        output: [{ file: 'dist/index.d.ts', format: 'es' }],
        plugins: [dts()],
        external: [/node_modules/]
    }
];