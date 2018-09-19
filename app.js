let generate_unsafe = require('babel-generator').default;
let { parse, parseExpression } = require('@babel/parser');
let { namedTypes: t } = require('ast-types');
let { zip, isEqual, omit, isObject, range } = require('lodash');
let chalk = require('chalk');

let generate = (ast) => {
  try {
    if (Array.isArray(ast)) {
      let x = ast.map(generate);
      return x;
    }
    if (ast.ast) {
      return generate(ast.ast);
    }

    let code = generate_unsafe(ast).code;

    // TODO Make something separate to show the path nicely instead of this hack
    // if (code.length > 80) {
    //   return `${code.slice(0, 35)}...${code.slice(-35, Infinity)}`;
    // } else {
    //   return code;
    // }
    return code;
  } catch (err) {
    return ast;
  }
};

let babeloptions = {
  allowAwaitOutsideFunction: true,
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
  allowSuperOutsideMethod: true,

  plugins: ['asyncGenerators'],
};

let remove_keys = (object) => {
  let unnecessary_keys = [
    'start',
    'end',
    'loc',
    '__clone',
    'trailingComments',
    'leadingComments',
    'comments',
    'extra',
  ];
  return omit(object, unnecessary_keys);
};

let show_mismatch = (expected, received, vs = 'vs') => {
  return `${chalk.red(`'${received}'`)} ${vs} ${chalk.green(`'${expected}'`)}`;
};

class MismatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MismatchError';
  }
}

let container_nodes = {
  ExpressionStatement: {
    type: 'ExpressionStatement',
    get: (x) => x.expression,
  },
  ObjectProperty: {
    type: 'ObjectProperty',
    get: (property) => property.shorthand && property.key,
  }
};

let get_contained_node = (node) => {
  if (container_nodes[node.type]) {
    return container_nodes[node.type].get(node) || node;
  } else {
    return node;
  }
};

let is_placeholder = (_node) => {
  let node = get_contained_node(_node);
  return node.type === 'Identifier' && node.name.startsWith('$$placeholder_');
};

let get_placeholder = (node_template, placeholders) => {
  if (is_placeholder(node_template)) {
    let placeholder_id = get_contained_node(node_template).name;
    let placeholder_description = placeholders[placeholder_id];
    return placeholder_description;
  } else {
    return null;
  }
};

let is_primitive = (x) => !isObject(x);

let match_subtemplate = ({ template: _template, node }) => {
  if (typeof _template === 'function') {
    let x = template.expression`${_template('basic')}`.match(node);
    return {
      areas: x.areas.basic,
    };
  } else {
    if (typeof _template.match === 'function') {
      return _template.match(node);
    } else {
      let t = {
        ..._template,
        name: 'basic',
      };
      let x = template.expression`${t}`.match(node);
      return {
        areas: x.areas.basic,
      };
    }
  }
};

// TODO Immutable?
// TODO Add the key, template and filled_in to the actual stack?
let add_path_to_error = ({
  error,
  subject_key,
  template_key,
  template,
  subject,
}) => {
  error.path = [
    {
      subject_key: subject_key,
      template_key: template_key,
      template: generate(template),
      subject: generate(subject),
    },
    ...(error.path || []),
  ];
  return error;
};

let match_repeat_to_array = ({ repeat_placeholder, subject_array }) => {
  let { name, min, max, subtemplate } = repeat_placeholder;

  let matched = [];
  for (let subject_value of subject_array) {
    if (matched.length >= max) {
      break;
    }

    try {
      let result = match_subtemplate({
        template: subtemplate,
        node: subject_value,
      });
      matched.push(result.areas);
    } catch (err) {
      // TODO Maybe save the error, still?
      // throw add_path_to_error({
      //   error: err,
      //   template_key: 1,
      //   subject_key: matched.length,
      //   template: subtemplate,
      //   subject: subject_value,
      // });
      break;
    }
  }

  if (matched.length < min) {
    let mismatch = show_mismatch(min, matched.length, '<');
    throw new MismatchError(
      `Repeat matches less nodes than required (${mismatch})`
    );
  }

  return matched;
};

let match_array = ({ template_array, subject_array, placeholders }) => {
  let template_length_without_repeat = template_array.length - 1;

  // Now I need to figure out how to match the template with repeat, to the real thing.
  // One thing I figured, is I can see how much is before the repeat, and how much is after.
  // Because from these, I know exactly how many there should be.
  let areas = {};
  let subject_index = -1;
  for (let [template_index, template_element] of Object.entries(
    template_array
  )) {
    subject_index = subject_index + 1;

    let fill_sub = subject_array[subject_index];
    // Check if the current template element is a repeat placeholder
    if (
      is_placeholder(template_element) &&
      get_placeholder(template_element, placeholders).type === REPEAT_TYPE
    ) {
      // If it is a repeat placeholder we need to
      let repeat = get_placeholder(template_element, placeholders);

      // if (repeat_length > repeat.max) {
      //   let mismatch = show_mismatch(repeat.min, repeat_length, '>');
      //   throw new MismatchError(
      //     `Repeat matches more nodes than allowed (${mismatch})`
      //   );
      // }
      //
      // if (repeat_length < repeat.min) {
      //   let mismatch = show_mismatch(repeat.max, repeat_length, '<');
      //   throw new MismatchError(
      //     `Repeat matches less nodes than required (${mismatch})`
      //   );
      // }

      let matched_array = match_repeat_to_array({
        repeat_placeholder: repeat,
        subject_array: subject_array.slice(subject_index),
      });


      let errors = [];
      // I am walking from high to low here, so it is greedy:
      // It will first try out the biggest collection it could match,
      // and step-by-step match less and less until it finds a good match
      for (let i of range(matched_array.length, repeat.min - 1)) {
        try {
          let index = Number(template_index);
          let result = match_array({
            template_array: template_array.slice(index + 1),
            subject_array: subject_array.slice(index + i),
            placeholders,
          });

          return {
            areas: {
              ...areas,
              [repeat.name]: matched_array.slice(0, i),
              ...result.areas,
            },
          };
        } catch (err) {
          errors.push(err);
          if (i === repeat.min - 1) {
            // Last attempt at matching this array,
            // if this fails (which it does if it reaches this code) it means
            // there is no valid match at all

            // console.log(`errors:`, errors)
            throw new Error(`No possible way to match the repeat`)
          }
        }
      }

    } else {
      // Just compare the two values in the array on these indexes
      try {
        let result = compare_node(template_element, fill_sub, placeholders);

        // Warn by multiple areas
        areas = {
          ...areas,
          ...result.areas,
        };
      } catch (err) {
        throw add_path_to_error({
          error: err,
          template_key: Number(template_index),
          subject_key: subject_index,
          template: template_element,
          subject: fill_sub,
        });
      }
    }
  }

  if (subject_index + 1 < subject_array.length) {
    throw new MismatchError(`Not all items in array are matched`);
  }

  return { areas };
};

let compare_node = (_node_template, _node_filled_in, placeholders) => {
  // First case is easy, this is to compare primitives.
  // If they match, nice
  // If they don't, we have a mismatch
  if (!isObject(_node_template) || !isObject(_node_filled_in)) {
    if (_node_template === _node_filled_in) {
      return { areas: {} };
    } else {
      let mismatch = show_mismatch(_node_template, _node_filled_in);
      throw new MismatchError(`Primitives not equal (${mismatch})`);
    }
  }

  // We strip all the bloat (like line numers and locations) from the nodes,
  // because these will never be equal (or mostly never, we don't care about them anyway)
  let node_template = remove_keys(_node_template);
  let node_filled_in = remove_keys(_node_filled_in);

  // If the node we look at is a placeholder, we need to store the value we are currently at
  if (is_placeholder(node_template)) {
    let {
      // map_fn allows for extra checks and simplification
      map_fn = (x) => x,
      type,
      name,
      ...placeholder_props
    } = get_placeholder(node_template, placeholders);

    // TODO Maybe REPEAT_TYPE optional should be useful here if seomthing could be undefined?
    if (type === REPEAT_TYPE) {
      throw new MismatchError(`Repeat used in a non-array place`);
    }

    if (type === EITHER_TYPE) {
      let { possibilities } = placeholder_props;

      let errors = [];
      for (let possibility of possibilities) {
        try {
          let result = match_subtemplate({
            template: possibility,
            node: _node_filled_in,
          });
          return { areas: { [name]: result.areas } };
        } catch (err) {
          // Do something with error
          errors.push(err);
          continue;
        }
      }
      let err = new MismatchError(`None of the possibilities matched`);
      err.sub_errors = errors;
      throw err;
    }

    if (!type.check(node_filled_in)) {
      let mismatch = show_mismatch(type, node_filled_in.type);
      throw new MismatchError(`Types not matching (${mismatch})`);
    }

    let result = map_fn(node_filled_in, (template_sub, filled_sub) => {
      // TODO I'm not entirely sure if this `placeholders` is the right one to pass on,
      // .... it seems like this would not contain the "sub placeholders" that we actually care about
      return match_ast(template_sub, filled_sub, placeholders);
    });

    return {
      areas: {
        [name]: result,
      },
    };
  }

  if (node_template.type == null) {
    if (isEqual(node_template, node_filled_in)) {
      return { areas: {} };
    } else {
      throw new MismatchError(`'node_template' has type null?`);
    }
  }

  // Same thing about the types, if those don't match we are done
  if (node_template.type !== node_filled_in.type) {
    let mismatch = show_mismatch(node_template.type, node_filled_in.type);
    throw new MismatchError(`Node types do not match (${mismatch})`);
  }

  // Now for the deeper equality check, we check if the keys match up.
  // If they don't, no reason to look further: Those are different
  if (!isEqual(Object.keys(node_template), Object.keys(node_filled_in))) {
    let mismatch = show_mismatch(
      Object.keys(node_template),
      Object.keys(node_filled_in)
    );
    throw new MismatchError(`Different keys (${mismatch})`);
  }

  let areas = {};

  // For every key, we are going to check if it is equal
  // This is where stuff gets tricky, because if we encounter an array in here,
  // we can be in for a heck of a ride with optionals/repeats
  // But you will see that later in this block
  for (let [key, template_value] of Object.entries(node_template)) {
    let filled_in_value = node_filled_in[key];

    // Catches all errors related to this object key
    try {
      // THIS, is where the real magic begins (at least, for now)
      // If it is an array, I need to check if this array contains any placeholder identifiers.
      //   If it contains a placeholder identifier, I need to check if it is a REPEAT_TYPE, because
      //     If it is actually a REPEAT_TYPE, I need to try out the possible combinations that this
      //     could work out it, and find one that does. So "giving" more elements to the repeat placeholder
      //     until it matches the template (or runs out)
      if (Array.isArray(template_value)) {
        let result = match_array({
          template_array: template_value,
          subject_array: filled_in_value,
          placeholders,
        });
        areas = {
          ...areas,
          ...result.areas,
        };
      } else {
        // If the value is not an array, that means it is a "normal" object or primitive.
        // in which case, we can compare them with `compare_node`, which is great.
        let result = compare_node(
          template_value,
          filled_in_value,
          placeholders
        );

        // TODO Warn if there are multiple areas in result?
        areas = {
          ...areas,
          ...result.areas,
        };
      }
    } catch (err) {
      throw add_path_to_error({
        error: err,
        template_key: key,
        subject_key: key,
        template: template_value,
        subject: filled_in_value,
      });
    }
  }

  return {
    areas: areas,
  };
};

let match_ast = (template_ast, filled_ast, placeholders) => {
  let { areas } = compare_node(
    template_ast.program || template_ast,
    filled_ast.program || filled_ast,
    placeholders
  );

  for (let [key, placeholder] of Object.entries(placeholders)) {
    let node = areas[placeholder.name];
    if (node == null && placeholder.type !== REPEAT_TYPE) {
      throw new MismatchError(`Unmatched placeholder '${placeholder.name}'`);
    }
  }

  return {
    areas,
  };
};

let generate_placeholders = (text, nodes) => {
  let next_placeholder_id = 0;
  let placeholders = {};

  let source = zip(text, nodes)
    .map(([text, node]) => {
      if (node) {
        let name = `$$placeholder_${next_placeholder_id}`;
        placeholders[name] = node;

        next_placeholder_id = next_placeholder_id + 1;
        return `${text}${name}`;
      }
      return text;
    })
    .join('');

  return { placeholders, source };
};

let expression = (text, ...nodes) => {
  let { placeholders, source } = generate_placeholders(text, nodes);
  let template_ast = parseExpression(source, babeloptions);

  return {
    match: (compare_source) => {
      let ast_filled_in =
        typeof compare_source === 'string'
          ? parseExpression(compare_source, babeloptions)
          : compare_source;
      return match_ast(template_ast, ast_filled_in, placeholders);
    },
    ast: template_ast,
  };
};

let statements = (text, ...nodes) => {
  let { placeholders, source } = generate_placeholders(text, nodes);
  let template_ast = parse(source, babeloptions);

  return {
    match: (compare_source) => {
      let ast_filled_in =
        typeof compare_source === 'string'
          ? parse(compare_source, babeloptions)
          : compare_source;
      return match_ast(template_ast, ast_filled_in, placeholders);
    },
    ast: template_ast,
  };
};

let REPEAT_TYPE = Symbol('Repeat a part a certain number of times');
let EITHER_TYPE = Symbol('Matches one of multiple subtemplates');
let template = {
  expression: expression,
  statements: statements,
  entry: (text, ...nodes) => {
    // TODO Validity check
    if (text.length === 1) {
      text = [`{ ${text[0]} }`];
    } else {
      text = [
        `{ ${text[0]}`,
        ...text.slice(1, -1),
        `${text[text.length - 1]} }`,
      ]
    }

    let x = expression(text, ...nodes);
    return {
      match: (match_source) => {
        if (typeof match_source === 'string') {
          throw new Error('Impossible...');
        };

        return x.match({
         type: 'ObjectExpression',
         properties: [match_source],
       });
      },
      ast: x.ast.properties[0],
    }
  },
  statement: (text, ...nodes) => {
    let { placeholders, source } = generate_placeholders(text, nodes);
    let template_ast_full = parse(source, babeloptions);
    if (template_ast_full.program.body.length !== 1) {
      throw new Error(`Multiple statements passed to template.statement`);
    }
    let template_ast = template_ast_full.program.body[0];

    return {
      match: (compare_source) => {
        let ast_filled_in =
          typeof compare_source === 'string'
            ? parse(compare_source, babeloptions)
            : compare_source;
        return match_ast(template_ast, ast_filled_in, placeholders);
      },
      ast: template_ast,
    };
  },

  either: (name, possibilities) => {
    return {
      type: EITHER_TYPE,
      name: name,
      possibilities: possibilities,
    };
  },

  optional: (name, subtemplate) => {
    return {
      type: REPEAT_TYPE,
      name: name,
      min: 0,
      max: 1,
      subtemplate: subtemplate,
    };
  },

  repeat: (name, min, max, subtemplate) => {
    return {
      type: REPEAT_TYPE,
      name: name,
      min: min,
      max: max,
      subtemplate: subtemplate,
    };
  },

  many: (name, subtemplate) => {
    return {
      type: REPEAT_TYPE,
      name: name,
      min: 0,
      max: Infinity,
      subtemplate: subtemplate,
    };
  },

  arguments: (name) => {
    return template.many(name, template.Pattern);
  },

  Expression: (name) => {
    return {
      type: t.Expression,
      name,
      map_fn: (x) => generate(x),
    };
  },
  Statement: (name) => {
    return {
      type: t.Statement,
      name,
      map_fn: (x) => generate(x),
    };
  },
  Pattern: (name) => {
    return {
      type: t.Pattern,
      name,
      map_fn: (x) => generate(x),
    };
  },

  function_expression: (name) => {
    return template.either(name, [
      template.FunctionExpression,
      template.ArrowFunctionExpression,
    ]);
  },

  FunctionExpression: (name) => {
    return {
      type: t.FunctionExpression,
      name,
      map_fn: (x) => generate(x),
    };
  },
  ArrowFunctionExpression: (name) => {
    return {
      type: t.ArrowFunctionExpression,
      name,
      map_fn: (x) => generate(x),
    };
  },
  Identifier: (name) => {
    return {
      type: t.Identifier,
      title: 'Identifier',
      name,
      map_fn: (x) => x.name,
    };
  },
  String: (name) => {
    return { type: t.StringLiteral, name, map_fn: (x) => x.value };
  },
  Object: (name, property_rules) => {
    return {
      type: t.ObjectExpression,
      name,
      map_fn: (object) => {
        return {
          entries: object.properties.map((property) => {
            let key_match = match_subtemplate({
              template: property_rules.key,
              node: property.key,
            });
            let value_match = match_subtemplate({
              template: property_rules.value,
              node: property.value,
            });
            return {
              key: key_match.areas,
              value: value_match.areas,
            };
          }),
        };
      },
    };
  },
};

module.exports = { template };
