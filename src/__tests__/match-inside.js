let { template, match_inside } = require('../ast-template.js');

it('should match a react component', () => {
  let source = `
    <Route path="/asdf" />
  `;

  let t = template.statements`
    <Route path={${template.Expression('hey')}} />
  `;

  expect(t.match(source)).toMatchSnapshot();
})

it('should match a react component', () => {
  let source = `
    <Route path="/asdf" />
  `;

  let t = template.statements`
    <Route ${template.JSXIdentifier('z')}={${template.Expression('hey')}} />
  `;

  expect(t.match(source)).toMatchSnapshot();
})

it('should match a shorthand jsx attribute', () => {
  let source = `
    <Route exact />
  `;

  let t = template.statements`
    <Route exact />
  `;

  expect(t.match(source)).toMatchSnapshot();
})

it.skip('should match a shorthand jsx attribute to expanded version', () => {
  let source = `
    <Route exact />
  `;

  let t = template.statements`
    <Route exact={true} />
  `;

  console.log(`t.match(source):`, t.match(source))
});

it('should match multiple jsx attributes', () => {
  let source = `
    <Route path="/asdf" />
  `;

  let t = template.statements`
    <Route ${template.many('y', template.jsxAttribute`${template.JSXIdentifier('l')}={${template.Expression('hey')}}`)} />
  `;

  expect(t.match(source)).toMatchSnapshot();
})

it.only('should match multiple boolean attributes', () => {
  let source = `
    <Route exact />
  `;

  let t = template.statements`
    <Route
      ${template.JSXIdentifier('l')}
    />
  `;

  expect(t.match(source)).toMatchSnapshot();
})

it('should find React Components inside a file', () => {
  let source = `
    let App = () => {
      return (
        <div>
          <Route path="/asdf" x={10 } />
          <Route path="/heythere" x={<Route path="/heythere" x={12} />} />
        </div>
      )
    }
  `;

  let xs = match_inside(source, template.expression`
    <Route path={${template.Expression('path')}} x={${template.Expression('x')}} />
  `);

  expect(xs).toMatchSnapshot();
})
