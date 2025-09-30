const esbuild = require('esbuild');
const {copy} = require('esbuild-plugin-copy');
const fs = require('fs');

function convertRequireToImport(code) {
  // 处理默认导入：const x = require('y')
  code = code.replace(
    /(?:const|let|var)\s+([\w_$]+)\s*=\s*require\((['"`])([^'"]+)\2\)/g,
    'import $1 from $2$3$2'
  );
  
  // 处理解构导入：const {x} = require('y')
  code = code.replace(
    /(?:const|let|var)\s+({[\s\w_$,]+})\s*=\s*require\((['"`])([^'"]+)\2\)/g,
    'import $1 from $2$3$2'
  );
  
  // 处理直接调用：require('x')
  code = code.replace(
    /require\((['"`])([^'"]+)\1\)/g,
    'import $2'
  );
  
  return code;
}

const requireToImportPlugin = {
  name: 'require-to-import',
  setup(build) {
    build.onLoad({ filter: /\.js$/ }, async (args) => {
      const code = await fs.promises.readFile(args.path, 'utf8');
      const transformed =  convertRequireToImport(code);
      return { contents: transformed, loader: 'js' };
    });
  }
};


const config = {
  entryPoints:{
    index: 'lib/index.js',
  },
  bundle: true,
  outdir: './dist',
  external: ['fsevents','process','path','fs','fs-extra','lodash','chokidar','events','acorn','acorn-jsx','chalk','crypto'],
  format: 'esm',
  platform: 'node',
  minify:false,
  mainFields: ['module', 'main'],
  define: {},
  plugins: [
    copy({
      resolveFrom: 'cwd',
      assets: {
        from: ['./lib/typing/**'],
        to: ['./dist/types/'],
      },
      keepStructure: false,
    }),
    //requireToImportPlugin,
  ],
};

const config2 = {
  entryPoints:{
    index: 'lib/index.js',
  },
  bundle: true,
  outdir: './dist',
  outExtension:{'.js':'.cjs'},
  external: ['fsevents','process','path','fs','fs-extra','lodash','chokidar','events','acorn','acorn-jsx','chalk'],
  format: 'cjs',
  platform: 'node',
  minify:false,
  define: {},
  plugins: [],
};

esbuild.build(config).then( ()=>{
  console.log('Build done.\r\n')
}).catch((e) =>{
  console.log( e )
  console.log('Build error.\r\n')
  process.exit(1);
});

esbuild.build(config2).then( ()=>{
  console.log('Build cjs done.\r\n')
}).catch((e) =>{
  console.log( e )
  console.log('Build cjs error.\r\n')
  process.exit(1);
});



