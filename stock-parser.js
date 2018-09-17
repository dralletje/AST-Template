let { template } = require('./app.js');
let fs = require('mz/fs');
let Path = require('path');

let definition_template = template.statements`
  ${template.many('import_functions', template.Statement)}

  let ${template.Identifier('fetch_fn')} = async (${template.optional('argument', template.Identifier)}) => {
    ${template.many('fetch_functions', template.Statement)}

    return flow([
      ${template.many('flow_functions', template.Expression)},
    ])(${template.Identifier('rows_variable')})
  }

  module.exports = ${template.Expression('exports')};
`;

(async () => {
  let folder = '../stock/src/suppliers';
  let files = await fs.readdir(folder);

  for (let file of files.slice(0, 1)) {
    let supplier_path = Path.join(folder, file);
    try {
      let content = (await fs.readFile(supplier_path)).toString();
      let result = definition_template.match(content);
      console.log(`result:`, result);
    } catch (err) {
      console.log(`path:`, supplier_path)
      console.log(`err:`, err)
    }
  }
})();
