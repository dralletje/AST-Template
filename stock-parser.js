let { template } = require('./app.js');
let fs = require('mz/fs');
let Path = require('path');
let chalk = require('chalk');
let dedent = require('dedent');

let definition_template = template.statements`
  ${template.many('import_functions', template.either(null, [
    // template.statement`let ${template.Pattern('id')} = ${template.Expression('exp')}`,
    template.Statement,
  ]))}

  let ${template.Identifier('fetch_fn')} = async (${template.arguments('arguments')}) => {
    ${template.many('fetch_functions', template.Statement)}

    return flow([
      ${template.many('flow_functions', template.either(null, [
        template.expression`
          iterate.map(${template.function_expression('func')})
        `,
        template.expression`
          iterate.filter(${template.function_expression('func')})
        `,
        template.expression`
          iterate.${template.Identifier('iterate_fn')}(${template.many('inputs', template.Expression)})
        `,
        template.expression`
          iterate.${template.Identifier('iterate_fn')}
        `,
      ]))}
    ])(${template.Identifier('rows_variable')})
  }

  ${template.many('post_statements', template.Statement)}

  module.exports = ${template.Expression('export')};
`;

let display_code = (code) => {
  if (Array.isArray(code)) {
    return code.join('\n');
  } else {
    return code;
  }
}

let display_path = (path) => {
  // subject_key, template_key, template, subject
  console.log(dedent`
    Subject key:  ${chalk.red(path.subject_key)}
    ${chalk.red(display_code(path.subject))}
    Template key: ${chalk.green(path.template_key)}
    ${chalk.green(display_code(path.template))}
    >>>>
  `);
};

let show_suberrors = (error) => {
  if (error.sub_errors) {
    for (let suberror of error.sub_errors) {
      show_stack(suberror);
      show_suberrors(suberror);
    }
  }
}

let show_stack = (error) => {
  console.log(error.stack.replace(RegExp(process.cwd() + '/', 'g'), ''));
}

(async () => {
  let folder = '../stock/src/suppliers';
  let files = await fs.readdir(folder);

  for (let file of files) {
    let supplier_path = Path.join(folder, file);
    try {
      let content = (await fs.readFile(supplier_path)).toString();
      let result = definition_template.match(content);
      console.log(`supplier_path:`, supplier_path)
      console.log(`result:`, result.areas);
    } catch (err) {
      console.log(`path:`, supplier_path);

      // for (let entry of err.path) {
      //   display_path(entry);
      // }
      // show_suberrors(err);
      // show_stack(err);
    }
  }
})();
