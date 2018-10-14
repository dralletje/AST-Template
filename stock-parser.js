let { template, fill_in_template } = require('./astemplate.js');
let fs = require('mz/fs');
let Path = require('path');
let chalk = require('chalk');
let dedent = require('dedent');
let generate = require('babel-generator').default;

let definition_template = template.statements`
  ${template.many(
    'import_functions',
    template.either(null, [
      // template.statement`let ${template.Pattern('id')} = ${template.Expression('exp')}`,
      template.Statement,
    ])
  )}

  let ${template.Identifier('fetch_fn')} = async (${template.arguments(
  'arguments'
)}) => {
    ${template.many('fetch_functions', template.Statement)}

    return flow([
      ${template.many(
        'flow_functions',
        template.either(null, [
          template.expression`
            iterate.map((${template.arguments('map_args')}) => {
              ${template.many(
                'map_statements',
                template.either(null, [
                  // template.statement`let ${template.Pattern('id')} = ${template.Expression('exp')}`,
                  template.Statement,
                ])
              )}
              return {
                ${template.many(
                  'map_results',
                  template.entry`
                  ${template.Identifier('key')}: ${template.Expression(
                    'expression'
                  )}
                `
                )}
              }
            })
          `,
          template.expression`
            iterate.filter(${template.function_expression('filter_fn')})
          `,
          template.expression`
            iterate.${template.Identifier('iterate_fn')}(${template.many(
              'inputs',
              template.Expression
            )})
          `,
          template.expression`
            iterate.${template.Identifier('iterate_simple')}
          `,
        ])
      )}
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
};

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
};

let show_stack = (error) => {
  console.log(error.stack.replace(RegExp(process.cwd() + '/', 'g'), ''));
};

(async () => {
  let MATCH = false;
  if (MATCH) {
    let folder = '../stock/src/suppliers';
    let files = await fs.readdir(folder);

    let results = [];
    for (let file of files) {
      let supplier_path = Path.join(folder, file);
      try {
        let content = (await fs.readFile(supplier_path)).toString();
        let result = definition_template.match(content);
        results.push(
          JSON.stringify({
            folder: Path.resolve(folder),
            ...result.areas,
          })
        );
      } catch (err) {
        console.log(`path:`, supplier_path);
        console.log(`err:`, err.message);
        console.log('');
        // for (let entry of err.path) {
        //   display_path(entry);
        // }
        // show_suberrors(err);
        // show_stack(err);
      }
    }
    let json = JSON.stringify(results);
    await fs.writeFile('../stock-parser-ui/src/stock-files-data.json', json);
    console.log('Done!');
  } else {
    let FILL_IN = {
      imports:
        "let { parse_xls_sync, parse_csv, parse_xlsx, parse_json } = require('./utils/parse.js');\n// let { retrieve_from_incoming } = require('./utils/retrieve.js');",
      fetch: '',
      functions: [
        { function_id: 'iterate.skip', config: { skip: 1 } },
        { function_id: 'iterate.first_is_headers' },
        {
          function_id: 'iterate.filter',
          config: { filter_fn: "row['Lab'] === 'GIA'" },
        },
        {
          function_id: 'iterate.map',
          config: {
            statements: '',
            expressions: [
              { key: 'certificate_number', expression: "diamond['Report No']" },
              { key: 'carats', expression: "diamond['Cts']" },
              { key: 'supplier_name', expression: '"Akarsh"' },
              { key: 'supplier_stockId', expression: "diamond['Packet No']" },
              { key: 'price', expression: "diamond['Net Value']" },
              { key: 'discount', expression: "diamond['Disc %']" },
              { key: 'image', expression: '' },
              { key: 'v360', expression: 'null' },
              { key: 'brown', expression: 'null' },
              { key: 'green', expression: 'null' },
              { key: 'milky', expression: 'null' },
              { key: 'eyeclean', expression: 'null' },
            ],
          },
        },
      ],
    };

    try {
      let yesss = fill_in_template(definition_template, {
        arguments: [],
        import_functions: template.statements(FILL_IN.imports),
        fetch_fn: template.expression`fetch_fn`,
        export: template.expression`{ fetch_fn }`,
        fetch_functions: template.statements(FILL_IN.fetch),
        rows_variable: template.expression`rows`,
        flow_functions: FILL_IN.functions.map((fn) => {
          if (fn.function_id === 'iterate.skip') {
            return {
              iterate_fn: template.expression`skip`,
              inputs: [template.expression(`${fn.config.skip}`)],
            }
          }
          if (fn.function_id === 'iterate.first_is_headers') {
            return {
              iterate_simple: template.expression`first_is_headers`,
              // inputs: [template.expression(`${fn.config.skip}`)],
            }
          }
          if (fn.function_id === 'iterate.filter') {
            return {
              filter_fn: fill_in_template(template.expression`(row) => ${template.Expression('expression')}`, {
                expression: template.expression(fn.config.filter_fn),
              }),
              // inputs: [template.expression(`${fn.config.skip}`)],
            }
          }
          if (fn.function_id === 'iterate.map') {
            return {
              // filter_fn: fill_in_template(template.expression`(row) => ${template.Expression('expression')}`, {
              //   expression: template.expression(fn.config.filter_fn),
              // }),
              map_args: [template.expression`diamond`],
              map_statements: [],
              map_results: [{ key: template.expression('key'), expression: template.expression`"value"`}],
            }
          }
          return null
        }).filter(Boolean),
        post_statements: [],
      });
      console.log(`yesss:`, generate(yesss).code);
    } catch (err) {
      console.log(`err:`, err);
    }
  }
})();
