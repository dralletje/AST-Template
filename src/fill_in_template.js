let { namedTypes: t } = require('ast-types');
let {
  isObject,
  flatten,
  mapValues,
} = require('lodash');

let { is_placeholder, get_placeholder, remove_keys, TemplatePrimitives } = require('./types.js');
let { show_mismatch } = require('./debug.js');

let normalize_template_input = (value) => {
  if (value.ast && value.ast.type === 'File') {
    // Passed in template.statements`...`, need to get the individual statements
    return value.ast.program.body;
  } else {
    return value;
  }
}

let fill_in_template = (template, values, placeholders) => {
  if (typeof template === 'function') {
    template = template(null);
  }
  if (!isObject(template)) {
    return template;
  }

  if (t.Node.check(template)) {
    if (is_placeholder(template)) {
      let placeholder = get_placeholder(template, placeholders);
      let value = values[placeholder.name];
      return fill_in_template(placeholder, value);
    } else {
      template = remove_keys(template);
      return mapValues(remove_keys(template), (node, key) => {
        return fill_in_template(node, values, placeholders);
      });
    }
  } else {
    if (Array.isArray(template)) {
      return flatten(
        template.map((list_item) => {
          let placeholder = get_placeholder(list_item, placeholders);
          if (placeholder && placeholder.type === TemplatePrimitives.REPEAT_TYPE) {
            let { name, min, max, subtemplate } = placeholder;
            let array_to_insert = normalize_template_input(values[placeholder.name]);

            if (!Array.isArray(array_to_insert)) {
              // prettier-ignore
              throw new Error(`Value for placeholder "${name}" is not an array`);
            }
            if (placeholder.min > array_to_insert.length) {
              // prettier-ignore
              let mismatch = show_mismatch(`> ${min}`, array_to_insert.length);
              // prettier-ignore
              throw new Error(`Placeholder '${name}' got too few items ${mismatch}`);
            }
            if (array_to_insert.length > max) {
              // prettier-ignore
              let mismatch = show_mismatch(`< ${min}`, array_to_insert.length);
              // prettier-ignore
              throw new Error(`Placeholder '${name}' got too many items ${mismatch}`);
            }

            return array_to_insert.map((value) => {
              return fill_in_template(subtemplate, value);
            });
          } else {
            return [fill_in_template(list_item, values, placeholders)];
          }
        })
      );
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

      let err = new Error(`Didn't match any subtemplate:` + errors.map(error => `\n- ${error}`));
      err.errors = errors;
      throw err;
    }

    if (template.type === TemplatePrimitives.NODE) {
      if (t.Node.check(values)) {
        return values;
      } else {
        return values.ast;
      }
    }

    if (template.type === TemplatePrimitives.TEMPLATE) {
      return fill_in_template(template.ast, values, template.placeholders);
    }

    if (template.type === TemplatePrimitives.UNPARSABLE) {
      return fill_in_template(template.ast, values, template.placeholders);
    }

    throw new Error(`Unknown template type "${template.type}"`);
  }
};

module.exports = { fill_in_template };
