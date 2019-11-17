// a simple parser for Valve's KeyValue format
// https://developer.valvesoftware.com/wiki/KeyValues
//
// authors: Rossen Popov, 2014-2016; p0358, 2019

const TYPEEX = {
    INT: /^\d+$/,
    FLOAT: /^\d+\.\d+$/,
    BOOLEAN: /true|false/i,
}

function parse(text, types = true) {
    if (typeof text != "string") {
        throw new TypeError("VDF.parse: Expecting parameter to be a string");
    }
    types = (typeof types == "boolean") ? types : true;

    lines = text.split("\n");

    var obj = {};
    var stack = [obj];
    var expect_bracket = false;
    var name = "";

    var re_kv = new RegExp(
        '^("((?:\\\\.|[^\\\\"])+)"|([a-zA-Z0-9\\-\\_]+))' +
        '([ \t]*(' +
        '"((?:\\\\.|[^\\\\"])*)(")?' +
        '|([a-zA-Z0-9\\-\\_]+)' +
        '))?'
    );

    var i = 0, j = lines.length;
    for (; i < j; i++) {
        line = lines[i].trim();

        // skip empty and comment lines
        if ( line == "" || line[0] == '/') { continue; }

        // one level deeper
        if ( line[0] == "{" ) {
            expect_bracket = false;
            continue;
        }

        if (expect_bracket) {
            throw new SyntaxError("VDF.parse: invalid syntax on line " + (i+1));
        }

        // one level back
        if ( line[0] == "}" ) {
            if (Array.isArray(stack[stack.length-2])) stack.pop(); // if the element above is an array, we need to pop twice
            stack.pop();
            continue;
        }

        // parse keyvalue pairs
        while (true) {
            m = re_kv.exec(line);

            if (m === null) {
                throw new SyntaxError("VDF.parse: invalid syntax on line " + (i+1));
            }

            // qkey = 2
            // key = 3
            // qval = 6
            // vq_end = 7
            // val = 8
            var key = (m[2] !== undefined) ? m[2] : m[3];
            var val = (m[6] !== undefined) ? m[6] : m[8];

            if (val === undefined) {
                // parent key

                // does not exist at all yet
                if (stack[stack.length-1][key] === undefined || typeof stack[stack.length-1][key] !== 'object') {
                    stack[stack.length-1][key] = {};
                    stack.push(stack[stack.length-1][key]);
                }

                // exists already, is an object, but not an array, we turn it into an array to push the next object there
                if (stack[stack.length-1][key] !== undefined && !Array.isArray(stack[stack.length-1][key])) {
                    stack[stack.length-1][key] = [stack[stack.length-1][key], {}]; // turn current object into array with the object and new empty object
                    stack.push(stack[stack.length-1][key]); // push our array to stack
                    stack.push(stack[stack.length-1][1]); // push our newly created (2nd) object to stack
                }

                // exists already, is an array of objects
                if (stack[stack.length-1][key] !== undefined && Array.isArray(stack[stack.length-1][key])) {
                    stack.push(stack[stack.length-1][key]); // push current array on stack
                    stack[stack.length-1].push({}); // append new object to that array
                    stack.push(stack[stack.length-1][ (stack[stack.length-1]).length-1 ]); // push that new (last) object on stack
                }

                expect_bracket = true;
            }
            else {
                // value key

                if (types) {
                    if (TYPEEX.INT.test(val)) {
                        val = parseInt(val)
                    } else if (TYPEEX.FLOAT.test(val)) {
                        val = parseFloat(val)
                    } else if (TYPEEX.BOOLEAN.test(val)) {
                        val = val.toLowerCase() == "true"
                    }
                }

                if (m[7] === undefined && m[8] === undefined) {
                    line += "\n" + lines[++i];
                    continue;
                }

                stack[stack.length-1][key] = val;
            }

            break;
        }
    }

    if (stack.length != 1) throw new SyntaxError("VDF.parse: open parentheses somewhere");

    return obj;
}

function stringify(obj, pretty) {
    if ( typeof obj != "object") {
            throw new TypeError("VDF.stringify: First input parameter is not an object");
    }

    pretty = (typeof pretty == "boolean" && pretty) ? true : false;

    return _dump(obj,pretty,0);
}

function _dump(obj, pretty, level) {
    if ( typeof obj != "object" ) {
        throw new TypeError("VDF.stringify: a key has value of type other than string or object");
    }

    var indent = "\t";
    var buf = "";
    var line_indent = "";


    if (pretty) {
        for (var i = 0; i < level; i++ ) {
            line_indent += indent;
        }
    }

    for (var key in obj) {
        if ( typeof obj[key] == "object" ) {
            if (Array.isArray(obj[key])) {
                obj[key].forEach(function (element) {
                    buf += [line_indent, '"', key, '"\n', line_indent, '{\n', _dump(element,pretty,level+1), line_indent, "}\n"].join('');
                });
            }
            else
            buf += [line_indent, '"', key, '"\n', line_indent, '{\n', _dump(obj[key],pretty,level+1), line_indent, "}\n"].join('');
        }
        else {
            buf += [line_indent, '"', key, '" "', String(obj[key]), '"\n'].join('');
        }
    }

    return buf;
}

exports.parse = parse;
exports.stringify = stringify;
