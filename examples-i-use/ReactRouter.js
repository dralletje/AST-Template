let { template, match_inside, fill_in_template } = require('./astemplate.js');
let fs = require('mz/fs');
let Path = require('path');
let chalk = require('chalk');
let dedent = require('dedent');

// let definition_template = template.expression`
//   <Route path={${template.Expression('idk')}} component={${template.Expression('dik')}} />
// `;
let definition_template = template.expression`
  <Route
    ${template.optional(
      'path',
      template.jsxAttribute`
        path={${template.Expression('path')}}
      `
    )}
    ${template.optional(
      'exact',
      template.jsxAttribute`
        exact
      `
    )}

    ${template.either('render', [
      template.jsxAttribute`
        component={${template.Expression('component')}}
      `,
      template.jsxAttribute`
        render={${template.Expression('render')}}
      `,
    ])}
    ${template.many(
      'booleans',
      template.jsxAttribute`
        ${template.JSXIdentifier('key')}
      `
    )}
    ${template.many(
      'rest',
      template.jsxAttribute`
        ${template.JSXIdentifier('key')}={${template.Expression('value')}}
      `
    )}
  />
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
  try {
    let content = (await fs.readFile('../web/src/App.js')).toString();
    let result = match_inside(content, definition_template);
    // console.log(`result:`, result);
    // let result = fill_in_template(definition_template, {
    //   idk: template.expression`10`,
    //   dik: template.expression`'KD!!!'`,
    // });
    console.log(
      `result:`,
      result.map(({ areas }) => {
        return {
          path: areas.path && areas.path[0].path,
          exact: areas.exact && areas.exact[0] ? true : false,
          render: areas.render,
          rest: {
            ...areas.rest,
            ...areas.booleans,
          },
        };
      })
    );
    console.log(`result.length:`, result.length);
  } catch (err) {
    console.log(`err:`, err);
    // for (let entry of err.path) {
    //   display_path(entry);
    // }
    // show_suberrors(err);
    // show_stack(err);
  }
})();
