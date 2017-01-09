var assert = require("assert");
var uglify = require("../../");

describe("Left-hand side expressions", function () {
    it("Should parse destructuring with const/let/var correctly", function () {
        var decls = uglify.parse('var {a,b} = foo, { c, d } = bar');

        assert.equal(decls.body[0].TYPE, 'Var');
        assert.equal(decls.body[0].definitions.length, 2);
        assert.equal(decls.body[0].definitions[0].name.TYPE, 'Destructuring');
        assert.equal(decls.body[0].definitions[0].value.TYPE, 'SymbolRef');

        var nested_def = uglify.parse('var [{x}] = foo').body[0].definitions[0];

        assert.equal(nested_def.name.names[0].names[0].TYPE, 'SymbolVar');
        assert.equal(nested_def.name.names[0].names[0].name, 'x');

        var holey_def = uglify.parse('const [,,third] = [1,2,3]').body[0].definitions[0];

        assert.equal(holey_def.name.names[0].TYPE, 'Hole');
        assert.equal(holey_def.name.names[2].TYPE, 'SymbolConst');

        var expanding_def = uglify.parse('var [first, ...rest] = [1,2,3]').body[0].definitions[0];

        assert.equal(expanding_def.name.names[0].TYPE, 'SymbolVar');
        assert.equal(expanding_def.name.names[1].TYPE, 'Expansion');
        assert.equal(expanding_def.name.names[1].expression.TYPE, 'SymbolVar');
    });

    it("Parser should use AST_Array for array literals", function() {
        var ast = uglify.parse('["foo", "bar"]');
        assert(ast.body[0] instanceof uglify.AST_SimpleStatement);
        assert(ast.body[0].body instanceof uglify.AST_Array);

        ast = uglify.parse('a = ["foo"]');
        assert(ast.body[0] instanceof uglify.AST_SimpleStatement);

        assert(ast.body[0].body instanceof uglify.AST_Assign);
        assert(ast.body[0].body.left instanceof uglify.AST_SymbolRef);
        assert.equal(ast.body[0].body.operator, "=");
        assert(ast.body[0].body.right instanceof uglify.AST_Array);
    });

    it("Parser should use AST_Object for object literals", function() {
        var ast = uglify.parse('({foo: "bar"})');
        assert(ast.body[0] instanceof uglify.AST_SimpleStatement);
        assert(ast.body[0].body instanceof uglify.AST_Object);

        // This example should be fine though
        ast = uglify.parse('a = {foo: "bar"}');
        assert(ast.body[0] instanceof uglify.AST_SimpleStatement);

        assert(ast.body[0].body instanceof uglify.AST_Assign);
        assert(ast.body[0].body.left instanceof uglify.AST_SymbolRef);
        assert.equal(ast.body[0].body.operator, "=");
        assert(ast.body[0].body.right instanceof uglify.AST_Object);
    });

    it("Parser should use AST_Destructuring for array assignment patterns", function() {
        var ast = uglify.parse('[foo, bar] = [1, 2]');
        assert(ast.body[0] instanceof uglify.AST_SimpleStatement);

        assert(ast.body[0].body instanceof uglify.AST_Assign);
        assert(ast.body[0].body.left instanceof uglify.AST_Destructuring);
        assert.strictEqual(ast.body[0].body.left.is_array, true);
        assert.equal(ast.body[0].body.operator, "=");
        assert(ast.body[0].body.right instanceof uglify.AST_Array);
    });

    it("Parser should use AST_Destructuring for object assignement patterns", function() {
        var ast = uglify.parse('({a: b, b: c} = {b: "c", c: "d"})');
        assert(ast.body[0] instanceof uglify.AST_SimpleStatement);

        assert(ast.body[0].body instanceof uglify.AST_Assign);
        assert(ast.body[0].body.left instanceof uglify.AST_Destructuring);
        assert.strictEqual(ast.body[0].body.left.is_array, false);
        assert.equal(ast.body[0].body.operator, "=");
        assert(ast.body[0].body.right instanceof uglify.AST_Object);
    });

    it("Parser should be able to handle nested destructuring", function() {
        var ast = uglify.parse('[{a,b},[d, e, f, {g, h}]] = [{a: 1, b: 2}, [3, 4, 5, {g: 6, h: 7}]]');
        assert(ast.body[0] instanceof uglify.AST_SimpleStatement);

        assert(ast.body[0].body instanceof uglify.AST_Assign);
        assert(ast.body[0].body.left instanceof uglify.AST_Destructuring);
        assert.strictEqual(ast.body[0].body.left.is_array, true);
        assert.equal(ast.body[0].body.operator, "=");
        assert(ast.body[0].body.right instanceof uglify.AST_Array);

        assert(ast.body[0].body.left.names[0] instanceof uglify.AST_Destructuring);
        assert.strictEqual(ast.body[0].body.left.names[0].is_array, false);

        assert(ast.body[0].body.left.names[1] instanceof uglify.AST_Destructuring);
        assert.strictEqual(ast.body[0].body.left.names[1].is_array, true);

        assert(ast.body[0].body.left.names[1].names[3] instanceof uglify.AST_Destructuring);
        assert.strictEqual(ast.body[0].body.left.names[1].names[3].is_array, false);
    });

    it("Should handle spread operator in destructuring", function() {
        var ast = uglify.parse("[a, b, ...c] = [1, 2, 3, 4, 5]");
        assert(ast.body[0] instanceof uglify.AST_SimpleStatement);

        assert(ast.body[0].body instanceof uglify.AST_Assign);
        assert(ast.body[0].body.left instanceof uglify.AST_Destructuring);
        assert.strictEqual(ast.body[0].body.left.is_array, true);
        assert.equal(ast.body[0].body.operator, "=");
        assert(ast.body[0].body.right instanceof uglify.AST_Array);

        assert(ast.body[0].body.left.names[0] instanceof uglify.AST_SymbolRef);
        assert(ast.body[0].body.left.names[1] instanceof uglify.AST_SymbolRef);

        assert(ast.body[0].body.left.names[2] instanceof uglify.AST_Expansion);
    });

    it("Should handle default assignments in destructuring", function() {
        var ast = uglify.parse("({x: v, z = z + 5} = obj);");
        assert(ast.body[0] instanceof uglify.AST_SimpleStatement);

        assert(ast.body[0].body instanceof uglify.AST_Assign);
        assert(ast.body[0].body.left instanceof uglify.AST_Destructuring);
        assert.strictEqual(ast.body[0].body.left.is_array, false);
        assert.equal(ast.body[0].body.operator, "=");
        assert(ast.body[0].body.right instanceof uglify.AST_SymbolRef);

        assert(ast.body[0].body.left.names[0].value instanceof uglify.AST_SymbolRef);
        assert.strictEqual(ast.body[0].body.left.names[0].start.value, "x");

        assert(ast.body[0].body.left.names[1].value instanceof uglify.AST_SymbolRef);
        assert.strictEqual(ast.body[0].body.left.names[1].start.value, "z");


        ast = uglify.parse("[x, y = 5] = foo");
        assert(ast.body[0] instanceof uglify.AST_SimpleStatement);

        assert(ast.body[0].body instanceof uglify.AST_Assign);
        assert(ast.body[0].body.left instanceof uglify.AST_Destructuring);
        assert.strictEqual(ast.body[0].body.left.is_array, true);
        assert.equal(ast.body[0].body.operator, "=");
        assert(ast.body[0].body.right instanceof uglify.AST_SymbolRef);

        assert(ast.body[0].body.left.names[0] instanceof uglify.AST_SymbolRef);
        assert.strictEqual(ast.body[0].body.left.names[0].start.value, "x");

        // Do not change assignments for arrays yet
        assert(ast.body[0].body.left.names[1] instanceof uglify.AST_Assign);
        assert(ast.body[0].body.left.names[1].left instanceof uglify.AST_SymbolRef);
        assert.strictEqual(ast.body[0].body.left.names[1].start.value, "y");
    });
});
