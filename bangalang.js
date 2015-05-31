/*
 * Typed by: 
 * 		Mark Stahl 
 * 		https://github.com/mjstahl
 * Almost word-for-word from:
 *   	https://curiosity-driven.org/continuations
 * Comments are licensed under: 
 * 		Creative Commons Attribution 3.0 License 
 * 		https://creativecommons.org/licenses/by/3.0/
 * Code licensed under:
 * 		Apache 2.0 License 
 * 		https://www.apache.org/licenses/LICENSE-2.0
 */
"use strict";

// The syntax tree is comprised of three elements - identifiers,
// function definitions, and function calls.
function Identifier(name) {
	this.name = name;
}

function FuncDefinition(args, body) {
	this.args = args;
	this.body = body;
}

function FuncCall(func, args) {
	this.func = func;
	this.args = args;
}

// Scanner splits the source code into individual tokens
var scan = function(text) {
	var REAL = "[0-9]+\\.[0-9]+";
	var INTEGER = "[0-9]+";
	var INDENTIFIER = "[@A-Za-z_][A-Za-z0-9_]*";
	var OPERATOR = ",|[(){}\\[\\]]|[+/*=<>:;!%&\|\\-\\.]+";
	var WHITESPACE = "\\n|[\\r \\t]+";

	var pattern = 
		new RegExp([REAL, INTEGER, INDENTIFIER, OPERATOR, WHITESPACE].join("|"), "g");

	var match, matches = [], index = -1;
	while ((match = pattern.exec(text)) !== null) {
		matches.push(match[0]);
	}

	return {
		next: function() {
			index++;
			return {
				value: matches[index],
				done: index >= matches.length
			}
		}
	};
}

// The parser returns a syntax tree for the given stream of tokens
var parse = function(tokens, ops) {
	var currentToken;

	function nextToken() {
		currentToken = tokens.next().value;
		if (currentToken && currentToken.trim() === "") {
			nextToken();
		}
	}

	function nextExpression(precedence) {
		var left = nextPrimary();
		return nextBinaryOperator(precedence, left);
	}

	function nextPrimary() {
		if (!currentToken) throw new SyntaxError("Unexpected end of input.");

		var primary, annotations = nextAnnotations();
		if (currentToken === "fn") primary = nextFunctionDefinition();
		else if (currentToken === "{") primary = nextParams();
		else primary = nextIdentifier();
		while (currentToken === "(") primary = nextFunctionArguments(primary);

		primary.annotations = annotations;
		return primary;
	}

	function nextFunctionDefinition() {
		nextToken() // eat 'fn'
		if (currentToken !== "(") {
			throw new SyntaxError("Expected '(' in function definition but found " + currentToken);
		}
		var args = nextArguments();
		var body = nextExpression(ops.SMALL_PRECEDENCE);
		return new FuncDefinition(args, body);
	}

	function nextParams() {
		nextToken(); // eat '{'
		var expression = nextExpression(ops.LOW_PRECEDENCE);
		if (currentToken !== "}") {
			throw new SyntaxError("Expected '}' but found " + currentToken);
		}

		nextToken(); // eat '}'
		return expression;
	}

	function nextIdentifier() {
		var identifier = new Identifier(currentToken);

		nextToken(); // eat identifier
		return identifier;
	}

	function nextBinaryOperator(precedence, left) {
		while (true) {
			var tokenPrec = ops.getPrecedence(currentToken);

			if (!tokenPrec || tokenPrec < precedence) return left;

			var operator = nextIdentifier();
			var right = nextPrimary();
			var nextTokenPrec = ops.getPrecedence(currentToken);
			if (nextTokenPrec) {
				var nextPrec;
				if (tokenPrec < nextTokenPrec) {
					nextPrec = tokenPrec + 1;
				} else if ((tokenPrec === nextTokenPrec) && ops.bindsToRight(operator.name)) {
					nextPrec = tokenPrec;
				}

				if (nextPrec) {
					right = nextBinaryOperator(nextPrec, right);
				}
			}
			left = new FuncCall(operator, [left, right]);
		}
	}

	function nextArguments() {
		nextToken(); // eat '('
		var args = [];

		if (currentToken === ')') {
			nextToken(); // eat ')'
			return args;
		}

		while (true) {
			args.push(nextExpression());
			if (currentToken === ")") {
				nextToken(); // eat ')'
				return args;
			}
			if (currentToken !== ",") {
				throw new SyntaxError("Expected ',' but found " + currentToken);
			}
			nextToken(); // eat ','
		}
	}

	function nextAnnotations() {
		var annotations = [];
		while (currentToken && /^\@[A-Za-z0-9_]+$/.test(currentToken)) {
			annotations.push(currentToken);
			nextToken();
		}
		return annotations;
	}

	nextToken(); // initialize
	var topExpression = nextExpression();
	if (currentToken) {
		throw new SyntaxError("Text after the end of input: " + currentToken);
	}
	return topExpression;
}

// Each expression type calls an appropriate method on the context object.
// The complexity of evaluating a value of the function call is due to 
//   the fact that all arguments and the function itself need to be
//   resolved in the continuation passing style.
Identifier.prototype.evaluate = function(context, variables, continuation) {
	continuation(context.substitute(variables, this.name));
};

FuncDefinition.prototype.evaluate = function(context, variables, continuation) {
	var func = context.compile(variables, this.args, this.body);
	continuation(func);
};

FuncCall.prototype.evaluate = function(context, variables, continuation) {
	var args = this.args;
	function continueFunc(func) {
		var values = [];
		function continueArg(index, continuation) {
			function bindArgument(value) {
				values[index] = value;
				continueArg(index + 1, continuation);
			}
			if (index < args.length) {
				context.evaluateArgument(variables, func, index, args[index], bindArgument);
			} else {
				context.invoke(variables, func, values, continuation);
			}
		}
		continueArg(0, continuation);
	}
	this.func.evaluate(context, variables, continueFunc);
};

// The main interpreter function takes four arguments:
// 		1. the expression to evaluate
// 		2. an object with global functions
// 		3. a function that wraps all function invocations
// 		4. the callback that will be invoked with the result of evaluating 
// 		   the given expression
var interpret = function(expression, globals, wrapInvocation, callback) {
	function substitute(variables, name) {
		if (!isNaN(parseInt(name, 10))) return parseInt(name, 10);
		if (!(name in variables)) throw new Error(name + " symbol is not bound.");

		return variables[name];
	}

	function compile(scope, parameters, body) {
		return {
			parameters: parameters,
			body: body,
			execute: function(context, variables, args, continuation) {
				var symbols = Object.create(scope);
				for (var i = 0; i < parameters.length; i++) {
					symbols[parameters[i].name] = args[i];
				}
				body.evaluate(context, symbols, continuation);
			},
			length: parameters.length,
			toString: function() {
				return "fn(" + parameters.join(", ") + ") { " + body + " }";
			}
		};
	}

	function invoke(variables, func, args, continuation) {
		continuation = wrapInvocation(continuation);
		if (func.length > args.length) {
			continuation({
				length: func.length - args.length,
				execute: function(context, variables, current, continuation) {
					context.invoke(variables, func, args.concat(current), continuation);
				},
				toString: function() {
					return func + "(" + args.join(", ") + ")";
				}
			});
		} else if (typeof func === "function") {
			continuation(func.apply(variables, args));
		} else if (typeof func.execute === "function") {
			func.execute(this, variables, args, continuation);
		} else {
			throw new Error("Func must be a function.");
		}
	}

	function evaluateArgument(variables, func, index, value, continuation) {
		if (hasAnnotation(func.parameters, index, "@lazy")) {
			continuation(this.compile(variables, [], value));
		} else {
			value.evaluate(this, variables, continuation);
		}
	}

	function hasAnnotation(parameters, index, annotation) {
		var annotations = parameters && parameters[index] && parameters[index].annotations;
		return annotations && annotations.some(function(parameterAnnotation) {
			return parameterAnnotation === annotation;
		});
	}

	expression.evaluate({
		substitute: substitute,
		compile: compile,
		invoke: invoke,
		evaluateArgument: evaluateArgument
	}, globals, callback);
};

module.exports = {
	scan: scan,
	parse: parse,
	interpret: interpret
};