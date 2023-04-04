// a simple parser for Valve's KeyValue format
// https://developer.valvesoftware.com/wiki/KeyValues
//
// authors:
// Rossen Popov, 2014-2016
// p0358, 2019-2021

const TYPEEX = {
    INT: /^\-?\d+$/,
    FLOAT: /^\-?\d+\.\d+$/,
    BOOLEAN: /^(true|false)$/i,
}

function parse(text, options) {
    if (typeof text !== "string") {
        throw new TypeError("VDF.parse: Expecting parameter to be a string");
    }

    options = {
        types:
            (typeof options === "boolean") ? options // backward compatibility with the old boolean param
            : ((typeof options === "object" && "types" in options) ? options.types : true),
        arrayify: (typeof options === "object" && "arrayify" in options) ? options.arrayify : true,
        conditionals: (typeof options === "object" && "conditionals" in options) ? options.conditionals : undefined
    };
    if (options.conditionals && !Array.isArray(options.conditionals) && typeof options.conditionals === "string") options.conditionals = [options.conditionals];

    var lines = text.split("\n");

    var obj = {};
    var stack = [obj];
    var expect_bracket = false;
    var odd = false;

    var re_kv = new RegExp(
        '^[ \\t]*' +
        '("((?:\\\\.|[^\\\\"])+)"|([a-zA-Z0-9\\-\\_]+))' + // qkey, key
    
        '([ \\t]*(' +
        '"((?:\\\\.|[^\\\\"])*)(")?' + // qval, vq_end
        '|([a-zA-Z0-9\\-\\_.]+)' + // val
        '))?' +
    
        '(?:[ \\t]*\\[(\\!?\\$[A-Z0-9]+(?:(?:[\\|]{2}|[\\&]{2})\\!?\\$[A-Z0-9]+)*)\\])?' // conditionals
    );

    var i = -1, j = lines.length, line, sublines;
    var getNextLine = function() {
        if (sublines && sublines.length)
        {
            var _subline = sublines.shift();
            if (!odd) _subline = _subline.trim(); // we need to trim the line if outside of quoted value
            return _subline;
        }

        var _line = lines[++i];
        
        // skip empty and comment lines
        // but only if we are not inside of a quote value
        while ( !odd && _line !== undefined && (_line = _line.trim()) && (_line == "" || _line[0] == '/') )
            _line = lines[++i];

        if (_line === undefined)
            return false; // this is the end

        // make sure brackets are in separate lines, as this code assumes
        // done separately to retain correct line numbers in errors
        
        // skip tricky comments + add newlines around brackets, while making sure that slashes are not part of some key/value (inside quotes)
        //var odd = false; // odd number of quotes encountered means we are inside of a quote value
        var comment_slash_pos = -1;
        sanitization: for (var l = 0; l < _line.length; l++) {
            switch (_line.charAt(l)) {
                case '"': if (_line.charAt(l-1) !== '\\' || _line.charAt(l-2) === '\\') odd = !odd; break;
                case '/': if (!odd) { comment_slash_pos = l; break sanitization; } break;
                case '{': if (!odd) { _line = _line.slice(0, l) + "\n{\n" + _line.slice(l+1); l+=2; } break;
                case '}': if (!odd) { _line = _line.slice(0, l) + "\n}\n" + _line.slice(l+1); l+=2; } break;
            }
        }
        if (comment_slash_pos > -1) _line = _line.substr(0, comment_slash_pos);

        //if (!odd) _line = _line.trim(); // isn't that redundant?
        sublines = _line.split("\n"); // no trim here
        return getNextLine();
    }

    while ((line = getNextLine()) !== false) {

        // skip empty and comment lines, again
        if ( line == "" || line[0] == '/') { continue; }

        // one level deeper
        if ( line[0] == "{" ) {
            expect_bracket = false;
            continue;
        }

        if (expect_bracket) {
            throw new SyntaxError("VDF.parse: invalid syntax on line " + (i+1) + " (expected opening bracket, empty unquoted values are not allowed):\n" + line);
        }

        // one level back
        if ( line[0] == "}" ) {
            if (Array.isArray(stack[stack.length-2])) stack.pop(); // if the element above is an array, we need to pop twice
            stack.pop();
            continue;
        }

        // parse keyvalue pairs
        while (true) {
            var m = re_kv.exec(line);

            if (m === null) {
                throw new SyntaxError("VDF.parse: invalid syntax on line " + (i+1) + ":\n" + line);
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

                // exists already, is an object, but not an array
                else if (stack[stack.length-1][key] !== undefined && !Array.isArray(stack[stack.length-1][key])) {
                    if (options.arrayify) {
                        // we turn it into an array to push the next object there
                        stack[stack.length-1][key] = [stack[stack.length-1][key], {}]; // turn current object into array with the object and new empty object
                        stack.push(stack[stack.length-1][key]); // push our array to stack
                        stack.push(stack[stack.length-1][1]); // push our newly created (2nd) object to stack
                    } else {
                        // push it on stack and let it get patched with new values
                        stack.push(stack[stack.length-1][key]);
                    }
                }

                // exists already, is an array of objects
                else if (stack[stack.length-1][key] !== undefined && Array.isArray(stack[stack.length-1][key])) {
                    if (!options.arrayify)
                        throw new Error("VDF.parse: this code block should never be reached with arrayify set to false! [1]");
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
                    line += "\n" + getNextLine();
                    continue;
                }

                if (options.conditionals !== undefined && Array.isArray(options.conditionals) && m[9]) {
                    var conditionals = m[9];
                    var single_cond_regex = new RegExp('^(\\|\\||&&)?(!)?\\$([A-Z0-9]+)');
                    var ok = false;
                    while (conditionals) {
                        var d = single_cond_regex.exec(conditionals);
                        if (d === null || !d[3])
                            throw new SyntaxError("VDF.parse: encountered an incorrect conditional: " + conditionals);
                        conditionals = conditionals.replace(d[0], '').trim(); // erase parsed fragment from the list
                        var op = d[1];
                        var not = d[2] && d[2] === '!';
                        var cond = d[3];
                        var includes = options.conditionals.indexOf(cond) !== -1;
                        var _ok = not ? !includes : includes;
                        if (!op || op === '||')
                            ok = ok || _ok;
                        else // &&
                            ok = ok && _ok;
                    }
                    //console.log('cond', key, val, _ok);
                    if (!ok) {
                        // conditions are not met
                        // continue processing the line (code duplicated from the bottom of our while loop)
                        line = line.replace(m[0], "");
                        if (!line || line[0] == '/') break; // break if there is nothing else (of interest) left in this line
                        continue;
                    }
                }
                
                if (options.types) {
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

                // exists already, but is not an array
                else if (stack[stack.length-1][key] !== undefined && !Array.isArray(stack[stack.length-1][key])) {
                    if (options.arrayify) {
                        // we turn it into an array and push the next object there
                        stack[stack.length-1][key] = [stack[stack.length-1][key], val]; // turn current object into array with the old object and the new object
                    } else {
                        // replace it with the new value
                        stack[stack.length-1][key] = val;
                    }
                }

                // exists already, is an array
                else if (stack[stack.length-1][key] !== undefined && Array.isArray(stack[stack.length-1][key])) {
                    if (!options.arrayify)
                        throw new Error("VDF.parse: this code block should never be reached with arrayify set to false! [2]");
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

    if (stack.length != 1) throw new SyntaxError("VDF.parse: open parentheses somewhere");

    return obj;
}

function stringify(obj, options) {
    if (typeof obj !== "object") {
        throw new TypeError("VDF.stringify: First input parameter is not an object");
    }

    options = {
        pretty:
            (typeof options === "boolean") ? options // backward compatibility with the old boolean param
            : ((typeof options === "object" && "pretty" in options) ? options.pretty : false),
        indent: (typeof options === "object" && "indent" in options) ? options.indent : "\t"
    };

    return _dump(obj, options, 0);
}

function _dump(obj, options, level) {
    if (typeof obj !== "object") {
        throw new TypeError("VDF.stringify: a key has value of type other than string or object: " + typeof obj);
    }

    var indent = options.indent; // "\t"
    var buf = "";
    var line_indent = "";


    if (options.pretty) {
        for (var i = 0; i < level; i++ ) {
            line_indent += indent;
        }
    }

    for (var key in obj) {
        if (typeof obj[key] === "object") {
            if (Array.isArray(obj[key])) {
                obj[key].forEach(function (element) {
                    if (typeof element !== "object") {
                        // de-arrayifying a non-object (strings etc)
                        // fake an object to write:
                        _element = {};
                        _element[key] = element;
                        buf += _dump(_element,options,level);
                    }
                    else {
                        // de-arrayifying an object
                        buf += [line_indent, '"', key, '"\n', line_indent, '{\n', _dump(element,options,level+1), line_indent, "}\n"].join('');
                    }
                });
            }
            else
            buf += [line_indent, '"', key, '"\n', line_indent, '{\n', _dump(obj[key],options,level+1), line_indent, "}\n"].join('');
        }
        else {
            buf += [line_indent, '"', key, '" "', String(obj[key]), '"\n'].join('');
        }
    }

    return buf;
}

exports.parse = parse;
exports.stringify = stringify;
