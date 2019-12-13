let { template: t, MismatchError, match_precise } = require("../");
// let { minivaluate } = require("../../minivaluate.js");

class CompositeError extends Error {
  constructor(message) {
    super(message);
    this.cases = [];
  }

  add(description) {
    this.cases.push(description);
  }
}

// Always boolean result
let Assert = (argument_one, operator, argument_two) => {
  return {
    type: "Assert",
    operator: operator,
    argument_one: argument_one,
    argument_two: argument_two,
  };
};

// Can have any `Value` as result
let Express = (argument_one, operator, argument_two) => {
  return {
    type: "Express",
    operator: operator,
    argument_one: argument_one,
    argument_two: argument_two,
  };
};

let Jump = ({ to, with: result }) => {
  if (to == null) {
    throw new Error(`Can't jump to null`);
  }
  return {
    type: "Jump",
    to: to,
    with: result,
  };
};

let Condition = (condition, { inverse = false } = {}) => {
  return {
    type: "Condition",
    condition: condition,
    inverse: inverse,
  };
};

let Fork = (condition, assertions) => {
  return {
    type: "Fork",
    condition: condition,
    assertions: assertions,
  };
};

// :: Context
// {
//   scope, // Current scope reference variable
//   return, // Return result of the current expression. Not settable in statements.
// }

let let_assignment = ({ source, context }) => {
  // prettier-ignore
  let template = t.statements`
    let ${t.Identifier('identifier')} = ${t.Expression('expression')};
  `;
  let {
    areas: { identifier, expression },
  } = match_precise(template, source);

  let { return: result, assertions } = context.evaluate_expression(expression);

  return [
    assertions,
    Assert(Express(context.scope, ".", identifier), `becomes`, result),
  ];
};

let if_statement = ({ source, context }) => {
  let template = t.statements`
    if (${t.Expression("condition")}) {
      ${t.many("statements", t.Statement)}
    }
  `;
  let {
    areas: { condition, statements },
  } = match_precise(template, source);

  let condition_result = context.evaluate_expression(condition);

  let { assertions } = context.evaluate_statements(statements);

  return [
    condition_result.assertions,
    Fork(Condition(condition_result.result), assertions),
  ];
};

let if_else = ({ source, context }) => {
  // prettier-ignore
  let template = t.statements`
    if (${t.Expression("condition")}) {
      ${t.many("if_statements", t.Statement)}
    } else {
      ${t.many("else_statements", t.Statement)}
    }
  `;

  let {
    areas: { condition, if_statements, else_statements },
  } = match_precise(template, source);

  let condition_result = context.evaluate_expression(condition);

  let if_result = context.evaluate_statements(if_statements);
  let else_result = context.evaluate_statements(else_statements);

  return [
    condition_result.assertions,
    Fork(Condition(condition_result.result), if_result.assertions),
    Fork(
      Condition(condition_result.result, { inverse: true }),
      else_statements.assertions
    ),
  ];
};

let return_statement = ({ source, context }) => {
  // prettier-ignore
  let template = t.statements`return ${t.Expression('result')}`;

  let {
    areas: { result },
  } = match_precise(template, source);

  let result_result = context.evaluate_expression(result);

  return [
    result_result.assertions,
    Jump({
      to: context.jump_return,
      with: result_result.return,
    }),
  ];
};

let constant_literal = ({ source, context }) => {
  // prettier-ignore
  let template = t.expression`${t.$literal('literal')}`;
  let {
    areas: { literal },
  } = match_precise(template, t.as_expression(source));
  let memory = context.allocate();
  return [Assert(memory, `creates`, literal), Assert(context.return, `becomes`, memory)];
};
let gte_operator = ({ source, context }) => {
  // prettier-ignore
  let template = t.expression`${t.Expression('left')} > ${t.Expression('right')}`;
  let {
    areas: { left, right },
  } = match_precise(template, source);

  let _left = context.evaluate_expression(left);
  let _right = context.evaluate_expression(right);
  return [
    _left.assertions,
    _right.assertions,
    Condition(Assert(_left.return, `>`, _right.return)),
  ];
};

let variable = ({ source, context }) => {
  // prettier-ignore
  let template = t.expression`${t.Identifier('name')}`;
  let {
    areas: { name },
  } = match_precise(template, t.as_expression(source));

  return [Assert(context.return, `becomes`, Express(context.scope, ".", name))];
};

let function_call = ({ source, context }) => {
  // prettier-ignore
  let template = t.expression`${t.Expression('callee')}(${t.many('args', t.Expression)})`;
  let {
    areas: { callee, args },
  } = match_precise(template, t.as_expression(source));

  let callee_result = context.evaluate_expression(callee);
  let arguments_results = args.map(arg => context.evaluate_expression(arg));

  return [
    callee_result.assertions,
    arguments_results.map(x => x.assertions),
    Assert(callee_result.return, `()`, arguments_results.map(x => x.result)),
  ];
};

let object_property = ({ source, context }) => {
  // prettier-ignore
  let template = t.expression`${t.Expression('object')}.${t.Identifier('property')}`
  let {
    areas: { object, property },
  } = match_precise(template, t.as_expression(source));

  let object_result = context.evaluate_expression(object);
  let property_result = context.evaluate_expression(`"${property}"`);

  return [
    object_result.assertions,
    property_result.assertions,
    Assert(
      context.return,
      `becomes`,
      Express(object_result.return, `.`, property_result.return)
    ),
  ];
};

let Expressions = {
  constant_literal: constant_literal,
  gte_operator: gte_operator,
  function_call: function_call,
  variable: variable,
  object_property: object_property,
};

let Statements = {
  let_assignment: let_assignment,
  if_statement: if_statement,
  if_else: if_else,
  return: return_statement,
};

let create_context = ({
  path = "root",
  jump_return = Symbol(`Jump return @${path}`),
  jump_throw = Symbol(`Jump throw @${path}`),
} = {}) => {
  let context_counter = 0;

  return {
    scope: Symbol(`Current scope reference @ ${path}`),
    return: Symbol(`Return reference @ ${path}`),
    jump_return: jump_return,
    jump_throw: jump_throw,
    allocate: () => {
      context_counter = context_counter + 1;
      return Symbol(`Allocation @ ${path}.${context_counter}`)
    },

    evaluate_expression: expression => {
      context_counter = context_counter + 1;
      let context = create_context({
        path: `${path}.${context_counter}`,
        jump_return: jump_return,
        jump_throw: jump_throw,
      });

      // prettier-ignore
      let errors = new CompositeError(`Evaluate expressions couldn't find anything`);
      for (let [name, match] of Object.entries(Expressions)) {
        try {
          let x = match({
            source: t.expression([expression]).ast,
            context: context,
          });

          if (x != null) {
            return { return: context.return, assertions: x };
          }
        } catch (error) {
          errors.add({
            match_name: match.name,
            expression: expression,
            error: error,
          });
        }
      }

      console.log('errors.cases:');
      for (let error_case of errors.cases) {
        console.log(`
          match: ${error_case.match};
          cause: ${error_case.cause};
        `);
      }

      throw errors;
    },
    evaluate_statements: statements => {
      if (typeof statements === "string") {
        // prettier-ignore
        let template = t.statements`${t.many('statement', t.Statement)}`;
        statements = match_precise(template, statements).areas.statement;
      }

      let matchables = [
        ...Object.entries(Expressions),
        ...Object.entries(Statements),
      ];
      let matched = [];

      statement_loop: for (let statement of statements) {
        let errors = new CompositeError(`Didn't find anything`);
        errors.statement = statement;

        for (let [name, match] of matchables) {
          context_counter = context_counter + 1;
          let context = create_context({
            path: `${path}.${context_counter}`,
            jump_throw: jump_throw,
            jump_return: jump_return,
          });

          try {
            let result = match({
              source: statement,
              context: context,
            });
            if (result != null) {
              matched.push(result);
              continue statement_loop;
            }
          } catch (err) {
            if (err instanceof MismatchError) {
              errors.add({
                match: match.name || "Anonymous match fn",
                cause: err.message,
              });
            } else {
              errors.add({
                match: match.name || "Anonymous match fn",
                cause: err,
              });
            }
          }
        }

        console.log(`errors.statement:`, errors.statement);
        console.log('errors.cases:');
        for (let error_case of errors.cases) {
          console.log(`
            match: ${error_case.match};
            cause: ${error_case.cause};
          `);
        }
        throw errors;
      }

      return matched;
    },
  };
};

module.exports = { create_context };
