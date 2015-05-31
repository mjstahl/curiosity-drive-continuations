module.exports = {
	"*": function(a, b) {
        return a * b;
    },
    ";": function(a, b) {
        return b;
    },
    "+": function(a, b) {
        return a + b;
    },
    "-": function(a, b) {
        return a - b;
    },
    "%": function(a, b) {
        return a % b;
    },
    ">": function(a, b) {
        return this[a > b];
    }
};