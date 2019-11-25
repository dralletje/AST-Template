let { create_context } = require("../mapping.js");
let { evaluate } = require('../evaluate.js');

it("should do something with the return", () => {
  let context = create_context();
  let conditions = context.evaluate_statements(`return x`);

  let eval = evaluate(context, conditions);
  console.log(`eval:`, eval)
});
