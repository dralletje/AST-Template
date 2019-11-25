let { namedTypes: t } = require('ast-types');
let {
  isObject,
  flatten,
  mapValues,
} = require('lodash');

let { is_placeholder, get_placeholder, remove_keys, TemplatePrimitives } = require('./types.js');
let { show_mismatch } = require('./debug.js');

let fill_in_template = (template, values, placeholders) => {
  if (typeof template === 'function') {
    template = template(null);
  }
  if (!isObject(template)) {
    return template;
  }


  if (values && 'ast' in values) {
    console.log(values);
    return fill_in_template(values.ast);
  }

  if (is_placeholder(template)) {
    let placeholder = get_placeholder(template, placeholders);
    let value = values[placeholder.name];

    if (placeholder.type === TemplatePrimitives.EITHER_TYPE) {
      let errors = [];
      for (let possibility of placeholder.possibilities) {
        try {
          return fill_in_template(possibility, value);
        } catch (err) {
          errors.push(err);
          continue;
        }
      }

      let err = new Error(`Didn't match any subtemplate`);
      err.errors = errors;
      throw err;
    }

    // NOTE I guess this should never happen
    // console.log(`value:`, value)
    // console.log(`values:`, values)
    // console.log(`placeholders:`, placeholders)
    // console.log(`template:`, template)
    if (value == null) {
      throw new Error(`No value provided for placeholder '${placeholder.name}'`);
    }

    return ('ast' in value) ? value.ast : value;
  }

  if (template.type === TemplatePrimitives.EITHER_TYPE) {
    let errors = [];
    for (let possibility of template.possibilities) {
      try {
        return fill_in_template(possibility, values);
      } catch (err) {
        errors.push(err);
        continue;
      }
    }

    let err = new Error(`Didn't match any subtemplate`);
    err.errors = errors;
    throw err;
  }

  if (placeholders == null) {
    if (t.Node.check(template)) {
      return template;
    } else if (template.ast) {
      return fill_in_template(template.ast, values, template.placeholders);
    } else {
      // TODO Check if the input matches the standalone template/type
      return ('ast' in values) ? values.ast : values;
    }
  }

  if (!t.Node.check(template)) {
    // console.log(`template:`, template);
    throw new Error('Template is not a node');
  }

  template = remove_keys(template);

  return mapValues(template, (node, key) => {
    if (Array.isArray(node)) {
      return flatten(
        node.map((list_item) => {
          let possible_repeat = get_placeholder(list_item, placeholders);
          if (possible_repeat && possible_repeat.type === TemplatePrimitives.REPEAT_TYPE) {
            let value_list = values[possible_repeat.name];

            if (value_list == null) {
              value_list = [];
            }

            if (!Array.isArray(value_list)) {
              if (value_list.ast && value_list.ast.type === 'File') {
                // Passed in template.statements`...`, need to get the individual statements
                value_list = value_list.ast.program.body;
              } else {
                throw new Error('value_list is not an array');
              }
            }

            if (possible_repeat.min > value_list.length) {
              let mismatch = show_mismatch(`> ${possible_repeat.min}`, value_list.length);
              throw new Error(`Placeholder '${possible_repeat.name}' got too few items ${mismatch}`);
            }
            if (value_list.length > possible_repeat.max) {
              let mismatch = show_mismatch(`< ${possible_repeat.min}`, value_list.length);
              throw new Error(`Placeholder '${possible_repeat.name}' got too many items ${mismatch}`);
            }

            // console.log(`possible_repeat.subtemplate:`, possible_repeat.subtemplate)
            return value_list.map((value) => {
              // console.log(`value:`, value)
              return fill_in_template(possible_repeat.subtemplate, value);
            });
          } else {
            // console.log(`list_item:`, list_item)
            return [fill_in_template(list_item, values, placeholders)];
          }
        })
      );
    } else {
      return fill_in_template(node, values, placeholders);
    }
  });
};

module.exports = { fill_in_template };
