let { create_context } = require("../mapping.js");

it("should do let_assigment", () => {
  expect(
    create_context().evaluate_statements(`let x = "hey";`)
  ).toMatchSnapshot();
});

it("should do if_statement with statements", () => {
  expect(
    create_context().evaluate_statements(`
      if (3 > x) {
        console.log('x');
      }
    `)
  ).toMatchSnapshot();
});

it("should do if_else with statements", () => {
  expect(
    create_context().evaluate_statements(`
      if (x > 3) {
        console.log('x');
      } else {
        console.log('y');
      }
    `)
  ).toMatchSnapshot();
});

it("should do gte_operator", () => {
  expect(
    create_context().evaluate_expression(`10 > 4`)
  ).toMatchSnapshot();
});

it("should do function_call", () => {
  expect(
    create_context().evaluate_expression(`func()`)
  ).toMatchSnapshot();
});
it("should do function_call with arguments", () => {
  expect(
    create_context().evaluate_expression(`func(10, "hey", func())`)
  ).toMatchSnapshot();
});
it("should do function_call with arguments", () => {
  expect(
    create_context().evaluate_expression(`func(10, "hey", func())`)
  ).toMatchSnapshot();
});
it("should do variable", () => {
  expect(
    create_context().evaluate_expression(`func`)
  ).toMatchSnapshot();
});
it("should do return_statement", () => {
  expect(
    create_context().evaluate_statements(`return x`)
  ).toMatchSnapshot();
});

it("should do object_property", () => {
  expect(
    create_context().evaluate_statements(`object_variable.property_name`)
  ).toMatchSnapshot();
});

it("should do constant_literal string", () => {
  expect(
    create_context().evaluate_expression(`"Hey"`)
  ).toMatchSnapshot();
});
it("should do constant_literal number", () => {
  expect(
    create_context().evaluate_statements(`10`)
  ).toMatchSnapshot();
});

it("should parse program", () => {
  let simple_program = `
    let x = Math.random();
    if (x > 2) {
      return "Universe broke";
    } else {
      return "Good";
    }
  `;

  let context = create_context();

  let assertions = context.evaluate_statements(simple_program);

  expect(assertions).toMatchSnapshot();
});
