let fs = require('mz/fs');
let { template, fill_in_template } = require('../ast-template');
let generate = require('babel-generator').default;
let prettier = require('prettier/standalone.js');
let barserBabylon = require('prettier/parser-babylon.js');

// let simple_arrow_function_template = template.expression`
//   (${template.Identifier('arg')}, ${template.$arguments('rest')}) => ${template.either('body', [
//     template.statements`{
//       ${template.many('statements', template.Statement)}
//     }`,
//     template.expression('expression'),
//   ])}
// `;

let pretty = (ast) => {
  return prettier.format(generate(ast).code, {
    parser: 'babylon',
    plugins: [barserBabylon],
    singleQuote: true,
    trailingComma: 'es5',
    arrowParens: 'always',
  });
}

let block_with_return = template.statements`
  ${template.many('statements', template.Statement)}
  return ${template.Identifier('result_var')}
`

let simple_arrow_function_template = template.expression`
  (${template.Identifier('arg')}, ${template.$arguments('rest')}) => ${template.either('body', [
    template.statements`{
      ${template.many('statements', template.Statement)}
    }`,
    template.Expression('expression'),
  ])}
`;

let stock_template = template.statements`
  ${template.many(
    'import_functions',
    template.either(null, [
      // template.statement`let ${template.Pattern('id')} = ${template.Expression('exp')}`,
      template.Statement,
    ])
  )}

  let ${template.Identifier('fetch_fn')} = async (${template.$arguments(
  'arguments'
)}) => {
    ${template.many('fetch_functions', template.Statement)}

    return flow([
      ${template.many(
        'flow_functions',
        template.either(null, [
          template.expression`
            iterate.map((${template.one_or_more('map_args')}) => {
              ${template.many(
                'map_statements',
                template.either(null, [
                  // template.statement`let ${template.Pattern('id')} = ${template.Expression('exp')}`,
                  template.Statement,
                ])
              )}
              return {
                ${template.one_or_more(
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
            iterate.filter(${template.$function_expression('filter_fn')})
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

let code_to_config = (code) => {
  try {
    let raw = stock_template.match(code);
    // console.log(`raw:`, raw);

    return {
      imports: raw.areas.import_functions.join('\n'),
      fetch: generate(fill_in_template(block_with_return, {
        statements: template.statements(raw.areas.fetch_functions.join('\n')),
        result_var: template.expression(raw.areas.rows_variable),
      })).code,
      functions: raw.areas.flow_functions.map(fn => {
        if (fn.iterate_fn != null) {
          if (fn.iterate_fn === 'skip') {
            return {
              function_id: 'iterate.skip',
              config: {
                skip: Number(fn.inputs[0]),
              },
            };
          }
        }
        if (fn.iterate_simple != null) {
          if (fn.iterate_simple === 'first_is_headers') {
            return {
              function_id: 'iterate.first_is_headers',
            };
          }
        }
        if (fn.filter_fn != null) {
          let x = simple_arrow_function_template.match(fn.filter_fn);
          // console.log(`x:`, x)
          if (x.areas.body.statements != null) {
            throw new Error(`Damnit, a filter with a block`);
          }

          return {
            function_id: 'iterate.filter',
            config: {
              arg_name: x.areas.arg,
              filter_fn: x.areas.body,
            },
          };
        }

        if (fn.map_results != null) {
          // map_args: [template.expression`diamond`],
          // map_statements: [],
          // map_results: fn.config.expressions.map(({ key, expression }) => {
          //   return {
          //     key: template.expression(key),
          //     expression: template.expression(expression),
          //   }
          // }),
          return {
            function_id: 'iterate.map',
            config: {
              arg: fn.map_args[0],
              statements: '',
              expressions: fn.map_results
            },
          };
        }

        throw new Error(`Not matched ${JSON.stringify(fn)}`);
      }).filter(Boolean),
    }

    // let ast = fill_in_template(stock_template, {
    //   arguments: [],
    //   import_functions: template.statements(config.imports),
    //   fetch_fn: template.expression`fetch_fn`,
    //   export: template.expression`{ fetch_fn }`,
    //   fetch_functions: template.statements(config.fetch),
    //   rows_variable: template.expression`rows`,
    //   flow_functions: config.functions.map((fn) => {
    //     if (fn.function_id === 'iterate.skip') {
    //       return {
    //         iterate_fn: template.expression`skip`,
    //         inputs: [template.expression(`${fn.config.skip}`)],
    //       }
    //     }
    //     if (fn.function_id === 'iterate.first_is_headers') {
    //       return {
    //         iterate_simple: template.expression`first_is_headers`,
    //         // inputs: [template.expression(`${fn.config.skip}`)],
    //       }
    //     }
    //     if (fn.function_id === 'iterate.filter') {
    //       let result = fill_in_template(template.expression`(row) => ${template.Expression('expression')}`, {
    //         expression: template.expression(fn.config.filter_fn),
    //       });
    //
    //       return {
    //         filter_fn: result,
    //       };
    //     }
    //     if (fn.function_id === 'iterate.map') {
    //       return {
    //         // filter_fn: fill_in_template(template.expression`(row) => ${template.Expression('expression')}`, {
    //         //   expression: template.expression(fn.config.filter_fn),
    //         // }),
    //         map_args: [template.expression`diamond`],
    //         map_statements: [],
    //         map_results: fn.config.expressions.map(({ key, expression }) => {
    //           return {
    //             key: template.expression(key),
    //             expression: template.expression(expression),
    //           }
    //         }),          }
    //     }
    //     return null
    //   }).filter(Boolean),
    //   post_statements: [],
    // });
  } catch (err) {
    throw err;
  }
}

let config_to_code = (config) => {
  // console.log(`config:`, JSON.stringify(config, null, 2))
  try {
    // console.log(`config.fetch:`, config.fetch)
    // console.log(`config.imports:`, config.imports)
    let ast = fill_in_template(stock_template, {
      arguments: [],
      import_functions: template.statements(config.imports),
      fetch_fn: template.expression`fetch_fn`,
      export: template.expression`{ fetch_fn }`,
      fetch_functions: template.statements(config.fetch),
      rows_variable: template.expression`rows`,
      flow_functions: config.functions.map((fn) => {
        if (fn.function_id === 'iterate.skip') {
          return {
            iterate_fn: template.expression`skip`,
            inputs: [template.expression(`${fn.config.skip}`)],
          }
        }
        if (fn.function_id === 'iterate.first_is_headers') {
          console.log(`fn:`, fn)
          return {
            iterate_simple: template.expression`first_is_headers`,
          }
        }
        if (fn.function_id === 'iterate.filter') {
          let result = fill_in_template(template.expression`(${template.Identifier('arg_name')}) => ${template.Expression('expression')}`, {
            expression: template.expression(fn.config.filter_fn),
            arg_name: template.expression(fn.config.arg_name || 'row'),
          });

          return {
            filter_fn: result,
          };
        }
        if (fn.function_id === 'iterate.map') {
          return {
            // filter_fn: fill_in_template(template.expression`(row) => ${template.Expression('expression')}`, {
            //   expression: template.expression(fn.config.filter_fn),
            // }),
            map_args: [template.expression`diamond`],
            map_statements: [],
            map_results: fn.config.expressions.map(({ key, expression }) => {
              return {
                key: template.expression(key),
                expression: template.expression(expression),
              }
            }),
          }
        }
        return null
      }).filter(Boolean),
      post_statements: [],
    });

    return pretty(ast);
  } catch (err) {
    console.log(`err:`, err)
    return `throw new SyntaxError('${err.message}')`;
  }
}

let supplier_list = template.statements`
  let suppliers = {
    ${template.many('suppliers', template.entry`
      ${template.Identifier('key')}: {
        fetch: ${template.either('fetch', [
          template.expression`
            require(${template.String('require')})
          `,
          template.expression`
            require(${template.String('require')}).${template.Identifier('property')}
          `,
        ])},
        ${template.optional('problem', template.entry`
          problem: ${template.String('string')},
        `)},
        ${template.optional('warning', template.entry`
          warning: ${template.String('string')},
        `)},
        title: ${template.String('title')},
        author: ${template.String('author')},
      },
    `)}
  }

  module.exports = { suppliers };
`;

let fill_in_supplierlist = (files) => {
  let input = {
    suppliers: files.map(x => {
      return {
        key: template.expression(`${x.key}`),
        title: template.expression(`"${x.title}"`),
        author: template.expression(`"${x.author}"`),
        problem: x.problem ? [{
          string: template.expression(`"${x.problem}"`)
        }] : null,
        warning: x.warning ? [{
          string: template.expression(`"${x.warning}"`)
        }] : null,
        fetch: {
          require: template.expression(`"${x.require_path}"`),
          property: x.require_key ? template.expression(`${x.require_key}`) : { ast: null },
        },
      };
    }),
  };
  return fill_in_template(supplier_list, input)
}

module.exports = { supplier_list, code_to_config, config_to_code, fill_in_supplierlist, pretty };

if (module.parent == null) {
  (async () => {
    try {
      // let supplier_list_file = (await fs.readFile('./src/suppliers.js')).toString();
      // let result = supplier_list.match(supplier_list_file);
      // console.log(`result:`, result.areas.suppliers)
      let x = config_to_code(require('./json.json'));
      console.log(`x:`, x)
    } catch (err) {
      console.log(`err:`, err);
    }
  })()
}
