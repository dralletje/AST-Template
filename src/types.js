let { namedTypes: t } = require('ast-types');
let { omit } = require('lodash');

let container_nodes = {
  ExpressionStatement: {
    type: 'ExpressionStatement',
    get: (x) => x.expression,
  },
  ObjectProperty: {
    type: 'ObjectProperty',
    get: (property) => property.shorthand && property.key,
  },
  JSXExpressionContainer: {
    type: 'JSXExpressionContainer',
    get: (container) =>
      container.type === 'StringLiteral' ? container : container.expression,
    wrap: (expression) => {
      if (!t.Expression.check(expression)) {
        // prettier-ignore
        throw new Error(`Trying to wrap non-expression (${expression.type}) into JSXExpressionContainer`);
      }

      return {
        type: 'JSXExpressionContainer',
        expression: expression,
      };
    },
  },
  JSXAttribute: {
    type: 'JSXAttribute',
    get: (container) => container.value == null && container.name,
  },
};

let get_contained_node = (node) => {
  let container_type = container_nodes[node.type];
  if (container_type) {
    let value = container_type.get(node) || node;
    return {
      ...value,
      astemplate_wrap: container_type.wrap || ((x) => x),
      astemplate_get: container_type.get || ((x) => x),
    };
  } else {
    return {
      ...node,
      astemplate_wrap: ((x) => x),
      astemplate_get: ((x) => x),
    };
  }
};

let is_placeholder = (_node) => {
  if (_node == null) {
    return false;
  }
  let node = get_contained_node(_node);
  return (
    (node.type === 'Identifier' || node.type === 'JSXIdentifier') &&
    node.name.startsWith('$$placeholder_')
  );
};

let get_placeholder = (node_template, placeholders) => {
  if (is_placeholder(node_template)) {
    let placeholder_node = get_contained_node(node_template);
    let placeholder_id = placeholder_node.name;
    let placeholder_description = placeholders[placeholder_id];
    return {
      wrap: placeholder_node.astemplate_wrap,
      get: placeholder_node.astemplate_get,
      ...placeholder_description,
    };
  } else {
    return null;
  }
};

let remove_keys = (object) => {
  let unnecessary_keys = [
    'start',
    'end',
    'loc',
    '__clone',
    'trailingComments',
    'leadingComments',
    'innerComments',
    'comments',
    'extra',
  ];
  return omit(object, unnecessary_keys);
};

let TemplatePrimitives = {
  REPEAT_TYPE: Symbol('Repeat a part a certain number of times'),
  EITHER_TYPE: Symbol('Matches one of multiple subtemplates'),
  NODE: Symbol('Match a node of specific type'),
  TEMPLATE: Symbol('an template containing ast and placeholder info'),
  UNPARSABLE: Symbol('Unparsable nested template'),
}

module.exports = { is_placeholder, get_placeholder, REPEAT_TYPE: TemplatePrimitives.REPEAT_TYPE, EITHER_TYPE: TemplatePrimitives.EITHER_TYPE, remove_keys, TemplatePrimitives }
