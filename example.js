var lang = require("./bangalang.js");
var ops = require("./operators.js");
var globals = require("./globals.js");

var code = "2 + 3 * 6";

var expression = lang.parse(lang.scan(code), ops);
var identity = function(value) { return value };

lang.interpret(expression, globals, identity, function (result) {
	console.log(result);
});