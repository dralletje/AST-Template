let transform = require('./transform-function-call.js');
let path = require('path');

module.exports = (file, api, options) => {
  let j = api.jscodeshift;
  let { statement, expression } = j.template;

  let fetch_path = path.join(process.cwd(), '../web/src/helpers.js');

  return transform(file, api, {
    export_path: path.join(process.cwd(), '../web/src/helpers.js'),
    export_name: 'getBGM',
    // imports: () => statement`
    //   import { Diamond } from ${j.stringLiteral(path.join(process.cwd(), '../web/src/helpers.js'))};
    // `,
    imports: [
      j.importDeclaration(
        [j.importSpecifier(j.identifier('Diamond'))],
        j.literal(path.join(process.cwd(), '../web/src/helpers.js'))
      ),
    ],
    replacement: (expression, args) => {
      return expression`Diamond.get_bgm(${args[0]})`;
    },
  });
};
