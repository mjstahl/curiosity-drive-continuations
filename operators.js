// The operators helper object is used to resolve how tightly
// operators bind or what their associativity is.  Only
// a few operators have predefined precedence that is adjusted
// so that the syntax seems similar to the C family programming
// languages.
module.exports = (function() {
	var NOT_OPERATOR = null;
	var WORD_OPERATOR = 5;
	var CUSTOM_OPERATOR = 10;

	function getPrecedence(operator) {
		if (!operator) return;

		var operators = {
			"{": NOT_OPERATOR,
			"(": NOT_OPERATOR,
			"}": NOT_OPERATOR,
			")": NOT_OPERATOR,
			",": NOT_OPERATOR,
			";": 2,
			"=": 3,
			"+": 20,
			"-": 20,
			"*": 40,
			"/": 40
		};

		if (operator in operators) return operators[operator];
		// identifiers
		if (/^[A-Za-z0-9_]/.test(operator)) return WORD_OPERATOR;
		// new operators
		return CUSTOM_OPERATOR;
	}

	function bindsToRight(operator) {
		return operator === ":";
	}

	return {
		getPrecedence: getPrecedence,
		bindsToRight: bindsToRight,
		// higher than ; but lower than word operators
		SMALL_PRECEDENCE: 4,
		LOW_PRECEDENCE: 0
	};
}());