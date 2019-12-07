// a simple parser for Valve's KeyValue format
// https://developer.valvesoftware.com/wiki/KeyValues
//
// authors: Rossen Popov, 2014-2016; p0358, 2019

const TYPEEX = {
    INT: /^\-?\d+$/,
    FLOAT: /^\-?\d+\.\d+$/,
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
        '^("((?:\\\\.|[^\\\\"])+)"|([a-zA-Z0-9\\-\\_]+))' + // qkey, key
        '([ \t]*(' +
        '"((?:\\\\.|[^\\\\"])*)(")?' + // qval, vq_end
        '|([a-zA-Z0-9\\-\\_.]+)' + // val
        '))?' +
        '(?:\s*\[\!?\$[A-Z0-9]+(?:(?:[\|]{2}|[\&]{2})\!?\$[A-Z0-9]+)*\])?' // conditionals -- ignore
    );

    var i = 0, j = lines.length, line;
    for (; i < j; i++) {
        line = lines[i].trim();

        // skip empty and comment lines
        if ( line == "" || line[0] == '/') { continue; }

        // make sure brackets are in separate lines, as this code assumes
        // done in separate if to retain correct line numbers in errors
        
        // skip tricky comments + add newlines around brackets, while making sure that slashes are not part of some key/value (inside quotes)
        var odd = false;
        var comment_slash_pos = -1;
        sanitization: for (var l = 0; l < line.length; l++) {
            switch (line.charAt(l)) {
                case '"': if (line.charAt(l-1) != '\\') odd = !odd; break;
                case '/': if (!odd) { comment_slash_pos = l; break sanitization; } break;
                case '{': if (!odd) { line = line.slice(0, l) + "\n{\n" + line.slice(l+1); l+=2; } break;
                case '}': if (!odd) { line = line.slice(0, l) + "\n}\n" + line.slice(l+1); l+=2; } break;
            }
        }
        if (comment_slash_pos > -1) line = line.substr(0, comment_slash_pos);

        var sublines = line.trim().split("\n");

        for (line of sublines) {
            line = line.trim();

            // skip empty and comment lines, again
            if ( line == "" || line[0] == '/') { continue; }

            // one level deeper
            if ( line[0] == "{" ) {
                expect_bracket = false;
                continue;
            }

            if (expect_bracket) {
                throw new SyntaxError("VDF.parse: invalid syntax on line " + (i+1) + " (expected opening bracket, empty unquoted values are not allowed)");
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
                    if (stack[stack.length-1][key] === undefined /*|| typeof stack[stack.length-1][key] !== 'object'*/) {
                        stack[stack.length-1][key] = {};
                        stack.push(stack[stack.length-1][key]);
                    }

                    // exists already, is an object, but not an array, we turn it into an array to push the next object there
                    else if (stack[stack.length-1][key] !== undefined && !Array.isArray(stack[stack.length-1][key])) {
                        stack[stack.length-1][key] = [stack[stack.length-1][key], {}]; // turn current object into array with the object and new empty object
                        stack.push(stack[stack.length-1][key]); // push our array to stack
                        stack.push(stack[stack.length-1][1]); // push our newly created (2nd) object to stack
                    }

                    // exists already, is an array of objects
                    else if (stack[stack.length-1][key] !== undefined && Array.isArray(stack[stack.length-1][key])) {
                        stack.push(stack[stack.length-1][key]); // push current array on stack
                        stack[stack.length-1].push({}); // append new object to that array
                        stack.push(stack[stack.length-1][ (stack[stack.length-1]).length-1 ]); // push that new (last) object on stack
                    }

                    expect_bracket = true;
                }
                else {
                    // value key
                    
                    if (m[7] === undefined && m[8] === undefined) {
                        if (i + 1 >= j) {
                            throw new SyntaxError("VDF.parse: un-closed quotes at end of file");
                        }
                        line += "\n" + lines[++i];
                        continue;
                    }
                    
                    if (types) {
                        if (TYPEEX.INT.test(val)) {
                            val = parseInt(val);
                        } else if (TYPEEX.FLOAT.test(val)) {
                            val = parseFloat(val);
                        } else if (TYPEEX.BOOLEAN.test(val)) {
                            val = val.toLowerCase() == "true";
                        }
                    }

                    // does not exist at all yet
                    if (stack[stack.length-1][key] === undefined) {
                        stack[stack.length-1][key] = val;
                    }

                    // exists already, is an object, but not an array, we turn it into an array and push the next object there
                    else if (stack[stack.length-1][key] !== undefined && !Array.isArray(stack[stack.length-1][key])) {
                        stack[stack.length-1][key] = [stack[stack.length-1][key], val]; // turn current object into array with the old object and the new object
                    }

                    // exists already, is an array
                    else if (stack[stack.length-1][key] !== undefined && Array.isArray(stack[stack.length-1][key])) {
                        stack[stack.length-1][key].push(val);
                    }
                    
                }

                if (expect_bracket) break; // there was just key, no value, the next line should contain bracket (to go one level deeper)
                line = line.replace(m[0], "").trim();
                if (!line || line[0] == '/') break; // break if there is nothing else (of interest) left in this line
                line = line.replace(/^\s*\[\!?\$[A-Z0-9]+(?:(?:[\|]{2}|[\&]{2})\!?\$[A-Z0-9]+)*\]/, "").trim(); // ignore conditionals
                if (!line || line[0] == '/') break; // again; if there's nothing left after skipping the conditional
            }
        }
    }

    if (stack.length != 1) throw new SyntaxError("VDF.parse: open parentheses somewhere");

    return obj;
}

function stringify(obj, pretty) {
    if (typeof obj != "object") {
        throw new TypeError("VDF.stringify: First input parameter is not an object");
    }

    pretty = (typeof pretty == "boolean" && pretty) ? true : false;

    return _dump(obj,pretty,0);
}

function _dump(obj, pretty, level) {
    if (typeof obj != "object") {
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
        if (typeof obj[key] == "object") {
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
