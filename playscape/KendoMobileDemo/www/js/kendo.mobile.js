/*
* Kendo UI v2012.1.124 (http://kendoui.com)
* Copyright 2012 Telerik AD. All rights reserved.
*
* Kendo UI commercial licenses may be obtained at http://kendoui.com/license.
* If you do not own a commercial license, this file shall be governed by the
* GNU General Public License (GPL) version 3. For GPL requirements, please
* review: http://www.gnu.org/copyleft/gpl.html
*/

;(function($, undefined) {
    /**
     * @name kendo
     * @namespace This object contains all code introduced by the Kendo project, plus helper functions that are used across all widgets.
     */
    var kendo = window.kendo = window.kendo || {},
        extend = $.extend,
        each = $.each,
        proxy = $.proxy,
        noop = $.noop,
        isFunction = $.isFunction,
        math = Math,
        Template,
        JSON = JSON || {},
        support = {},
        boxShadowRegExp = /(\d+?)px\s*(\d+?)px\s*(\d+?)px\s*(\d+?)?/i,
        FUNCTION = "function",
        STRING = "string",
        NUMBER = "number",
        OBJECT = "object",
        NULL = "null",
        BOOLEAN = "boolean",
        globalize = window.Globalize;

    function Class() {}

    Class.extend = function(proto) {
        var base = function() {},
            member,
            that = this,
            subclass = proto && proto.init ? proto.init : function () {
                that.apply(this, arguments);
            },
            fn;

        base.prototype = that.prototype;
        fn = subclass.fn = subclass.prototype = extend(new base, proto);

        for (member in fn) {
            if (typeof fn[member] === OBJECT) {
                fn[member] = extend(true, {}, base.prototype[member], proto[member]);
            }
        }

        fn.constructor = subclass;
        subclass.extend = that.extend;

        return subclass;
    };

    var Observable = Class.extend(/** @lends kendo.Observable.prototype */{
        /**
         * Creates an observable instance.
         * @constructs
         * @class Represents a class that can trigger events, along with methods that subscribe handlers to these events.
         */
        init: function() {
            this._events = {};
        },

        bind: function(eventName, handlers, one) {
            var that = this,
                idx,
                eventNames = $.isArray(eventName) ? eventName : [eventName],
                length,
                handler,
                original,
                events;

            for (idx = 0, length = eventNames.length; idx < length; idx++) {
                eventName = eventNames[idx];

                handler = isFunction(handlers) ? handlers : handlers[eventName];

                if (handler) {
                    if (one) {
                        original = handler;
                        handler = function() {
                            that.unbind(eventName, handler);
                            original.call(that, arguments);
                        }
                    }
                    events = that._events[eventName] || [];
                    events.push(handler);
                    that._events[eventName] = events;
                }
            }

            return that;
        },

        one: function(eventName, handlers) {
            return this.bind(eventName, handlers, true);
        },

        trigger: function(eventName, parameter) {
            var that = this,
                events = that._events[eventName],
                isDefaultPrevented = false,
                args = extend(parameter, {
                    preventDefault: function() {
                        isDefaultPrevented = true;
                    },
                    isDefaultPrevented: function() {
                        return isDefaultPrevented;
                    }
                }),
                idx,
                length;

            if (events) {
                for (idx = 0, length = events.length; idx < length; idx++) {
                    events[idx].call(that, args);
                }
            }

            return isDefaultPrevented;
        },

        unbind: function(eventName, handler) {
            var that = this,
                events = that._events[eventName],
                idx,
                length;

            if (events) {
                if (handler) {
                    for (idx = 0, length = events.length; idx < length; idx++) {
                        if (events[idx] === handler) {
                            events.splice(idx, 1);
                        }
                    }
                } else {
                    that._events[eventName] = [];
                }
            }

            return that;
        }
    });

    /**
     * @name kendo.Template.Description
     *
     * @section Templates offer way of creating html chunks.
     *  Options such as html encoding and compilation for optimal performance are available.
     *
     * @exampleTitle Basic template
     * @example
     *
     *  var inlineTemplate = kendo.template("Hello, #= firstName # #= lastName #");
     *  var inlineData = { firstName: "John", lastName: "Doe" };
     *  $("#inline").html(inlineTemplate(inlineData));
     *
     * @exampleTitle Output:
     * @example
     *  Hello, John Doe!
     *
     * @exampleTitle Encoding HTML
     * @example
     *
     * var encodingTemplate = kendo.template("HTML tags are encoded like this - ${ html }");
     * var encodingData = { html: "<strong>lorem ipsum</strong>" };
     * $("#encoding").html(encodingTemplate(encodingData));
     *
     * @exampleTitle Output:
     * @example
     *  HTML tags are encoded like this - <strong>lorem ipsum</strong>
     */

     function compilePart(part, stringPart) {
         if (stringPart) {
             return "'" +
                 part.split("'").join("\\'")
                 .replace(/\n/g, "\\n")
                 .replace(/\r/g, "\\r")
                 .replace(/\t/g, "\\t")
                 + "'";
         } else {
             var first = part.charAt(0),
                 rest = part.substring(1);

             if (first === "=") {
                 return "+(" + rest + ")+";
             } else if (first === ":") {
                 return "+e(" + rest + ")+";
             } else {
                 return ";" + part + ";o+=";
             }
         }
     }

    var argumentNameRegExp = /^\w+/,
        encodeRegExp = /\${([^}]*)}/g,
        escapedCurlyRegExp = /\\}/g,
        curlyRegExp = /__CURLY__/g,
        escapedSharpRegExp = /\\#/g,
        sharpRegExp = /__SHARP__/g;

    /**
     * @name kendo.Template
     * @namespace
     */
    Template = /** @lends kendo.Template */ {
        paramName: "data", // name of the parameter of the generated template
        useWithBlock: true, // whether to wrap the template in a with() block
        /**
         * Renders a template for each item of the data.
         * @ignore
         * @name kendo.Template.render
         * @static
         * @function
         * @param {String} [template] The template that will be rendered
         * @param {Array} [data] Data items
         * @returns {String} The rendered template
         */
        render: function(template, data) {
            var idx,
                length,
                html = "";

            for (idx = 0, length = data.length; idx < length; idx++) {
                html += template(data[idx]);
            }

            return html;
        },
        /**
         * Compiles a template to a function that builds HTML. Useful when a template will be used several times.
         * @ignore
         * @name kendo.Template.compile
         * @static
         * @function
         * @param {String} [template] The template that will be compiled
         * @param {Object} [options] Compilation options
         * @returns {Function} The compiled template
         */
        compile: function(template, options) {
            var settings = extend({}, this, options),
                paramName = settings.paramName,
                argumentName = paramName.match(argumentNameRegExp)[0],
                useWithBlock = settings.useWithBlock,
                functionBody = "var o,e=kendo.htmlEncode;",
                parts,
                part,
                idx;

            if (isFunction(template)) {
                if (template.length === 2) {
                    //looks like jQuery.template
                    return function(d) {
                        return template($, { data: d }).join("");
                    }
                }
                return template;
            }

            functionBody += useWithBlock ? "with(" + paramName + "){" : "";

            functionBody += "o=";

            parts = template
                .replace(escapedCurlyRegExp, "__CURLY__")
                .replace(encodeRegExp, "#=e($1)#")
                .replace(curlyRegExp, "}")
                .replace(escapedSharpRegExp, "__SHARP__")
                .split("#");

            for (idx = 0; idx < parts.length; idx ++) {
                functionBody += compilePart(parts[idx], idx % 2 === 0);
            }

            functionBody += useWithBlock ? ";}" : ";";

            functionBody += "return o;";

            functionBody = functionBody.replace(sharpRegExp, "#");

            try {
                return new Function(argumentName, functionBody);
            } catch(e) {
                throw new Error(kendo.format("Invalid template:'{0}' Generated code:'{1}'", template, functionBody));
            }
        }
    };

    //JSON stringify
(function() {
    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {
            "\b": "\\b",
            "\t": "\\t",
            "\n": "\\n",
            "\f": "\\f",
            "\r": "\\r",
            "\"" : '\\"',
            "\\": "\\\\"
        },
        rep,
        formatters,
        toString = {}.toString,
        hasOwnProperty = {}.hasOwnProperty;

    if (typeof Date.prototype.toJSON !== FUNCTION) {

        /** @ignore */
        Date.prototype.toJSON = function (key) {
            var that = this;

            return isFinite(that.valueOf()) ?
                that.getUTCFullYear()     + "-" +
                pad(that.getUTCMonth() + 1) + "-" +
                pad(that.getUTCDate())      + "T" +
                pad(that.getUTCHours())     + ":" +
                pad(that.getUTCMinutes())   + ":" +
                pad(that.getUTCSeconds())   + "Z" : null;
        };

        String.prototype.toJSON = Number.prototype.toJSON = /** @ignore */ Boolean.prototype.toJSON = function (key) {
            return this.valueOf();
        };
    }

    function quote(string) {
        escapable.lastIndex = 0;
        return escapable.test(string) ? "\"" + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === STRING ? c :
                "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
        }) + "\"" : "\"" + string + "\"";
    }

    function str(key, holder) {
        var i,
            k,
            v,
            length,
            mind = gap,
            partial,
            value = holder[key],
            type;

        if (value && typeof value === OBJECT && typeof value.toJSON === FUNCTION) {
            value = value.toJSON(key);
        }

        if (typeof rep === FUNCTION) {
            value = rep.call(holder, key, value);
        }

        type = typeof value;
        if (type === STRING) {
            return quote(value);
        } else if (type === NUMBER) {
            return isFinite(value) ? String(value) : NULL;
        } else if (type === BOOLEAN || type === NULL) {
            return String(value);
        } else if (type === OBJECT) {
            if (!value) {
                return NULL;
            }
            gap += indent;
            partial = [];
            if (toString.apply(value) === "[object Array]") {
                length = value.length;
                for (i = 0; i < length; i++) {
                    partial[i] = str(i, value) || NULL;
                }
                v = partial.length === 0 ? "[]" : gap ?
                    "[\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "]" :
                    "[" + partial.join(",") + "]";
                gap = mind;
                return v;
            }
            if (rep && typeof rep === OBJECT) {
                length = rep.length;
                for (i = 0; i < length; i++) {
                    if (typeof rep[i] === STRING) {
                        k = rep[i];
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ": " : ":") + v);
                        }
                    }
                }
            } else {
                for (k in value) {
                    if (hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ": " : ":") + v);
                        }
                    }
                }
            }

            v = partial.length === 0 ? "{}" : gap ?
                "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}" :
                "{" + partial.join(",") + "}";
            gap = mind;
            return v;
        }
    }

    if (typeof JSON.stringify !== FUNCTION) {
        JSON.stringify = function (value, replacer, space) {
            var i;
            gap = "";
            indent = "";

            if (typeof space === NUMBER) {
                for (i = 0; i < space; i += 1) {
                    indent += " ";
                }

            } else if (typeof space === STRING) {
                indent = space;
            }

            rep = replacer;
            if (replacer && typeof replacer !== FUNCTION && (typeof replacer !== OBJECT || typeof replacer.length !== NUMBER)) {
                throw new Error("JSON.stringify");
            }

            return str("", {"": value});
        };
    }
})();

// Date and Number formatting
(function() {
    var formatRegExp = /{(\d+)(:[^\}]+)?}/g,
        dateFormatRegExp = /dddd|ddd|dd|d|MMMM|MMM|MM|M|yyyy|yy|HH|H|hh|h|mm|m|fff|ff|f|tt|ss|s|"[^"]*"|'[^']*'/g,
        standardFormatRegExp =  /^(n|c|p|e)(\d*)$/i,
        EMPTY = "",
        POINT = ".",
        COMMA = ",",
        SHARP = "#",
        ZERO = "0",
        EN = "en-US";

    //cultures
    kendo.cultures = {"en-US" : {
        name: EN,
        numberFormat: {
            pattern: ["-n"],
            decimals: 2,
            ",": ",",
            ".": ".",
            groupSize: [3],
            percent: {
                pattern: ["-n %", "n %"],
                decimals: 2,
                ",": ",",
                ".": ".",
                groupSize: [3],
                symbol: "%"
            },
            currency: {
                pattern: ["($n)", "$n"],
                decimals: 2,
                ",": ",",
                ".": ".",
                groupSize: [3],
                symbol: "$"
            }
        },
        calendars: {
            standard: {
                days: {
                    names: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                    namesAbbr: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                    namesShort: [ "Su", "Mo", "Tu", "We", "Th", "Fr", "Sa" ]
                },
                months: {
                    names: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
                    namesAbbr: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                },
                AM: [ "AM", "am", "AM" ],
                PM: [ "PM", "pm", "PM" ],
                patterns: {
                    d: "M/d/yyyy",
                    D: "dddd, MMMM dd, yyyy",
                    F: "dddd, MMMM dd, yyyy h:mm:ss tt",
                    g: "M/d/yyyy h:mm tt",
                    G: "M/d/yyyy h:mm:ss tt",
                    m: "MMMM dd",
                    M: "MMMM dd",
                    s: "yyyy'-'MM'-'ddTHH':'mm':'ss",
                    t: "h:mm tt",
                    T: "h:mm:ss tt",
                    u: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'",
                    y: "MMMM, yyyy",
                    Y: "MMMM, yyyy"
                },
                "/": "/",
                ":": ":",
                firstDay: 0
            }
        }
    }};

    /**
     * @name kendo.ui.Globalization
     * @namespace
     */
     /**
     * @name kendo.ui.Globalization.Description
     *
     * @section Globalization is the process of designing and developing an
     * application that works in multiple cultures. The culture defines specific information
     * for the number formats, week and month names, date and time formats and etc.
     *
     * @section Kendo exposes <strong><em>culture(cultureName)</em></strong> method which allows to select the culture
     * script coresponding to the "culture name". kendo.culture() method uses the passed culture name
     * to select culture from the culture scripts that you have included and then sets the current culture.
     * If there is no such culture, the default one is used.
     *
     * <h3>Define current culture settings</h3>
     *
     * @exampleTitle Include culture scripts and select culture
     * @example
     *
     * <script src="jquery.js" />
     * <script src="kendo.all.min.js" />
     * <script src="kendo.culture.en-GB.js" />
     * <script type="text/javascript">
     *    //set current culture to the "en-GB" culture script.
     *    kendo.culture("en-GB");
     * </script>
     *
     * @exampleTitle Get current culture
     * @example
     * var cultureInfo = kendo.culture();
     *
     * @section
     * <p> Widgets that depend on current culture are:
     *    <ul>
     *        <li> Calendar </li>
     *        <li> DatePicker </li>
     *        <li> TimePicker </li>
     *        <li> NumericTextBox </li>
     *    </ul>
     * </p>
     */
    kendo.culture = function(cultureName) {
        if (cultureName !== undefined) {
            var cultures = kendo.cultures,
                culture = cultures[cultureName] || cultures[EN];

            culture.calendar = culture.calendars.standard;
            cultures.current = culture;
        } else {
            return kendo.cultures.current;
        }
    };

    //set current culture to en-US.
    kendo.culture(EN);

    function pad(number) {
        return number < 10 ? "0" + number : number;
    }

    function formatDate(date, format) {
        var calendar = kendo.cultures.current.calendar,
            days = calendar.days,
            months = calendar.months;

        format = calendar.patterns[format] || format;

        return format.replace(dateFormatRegExp, function (match) {
            var result;

            if (match === "d") {
                result = date.getDate();
            } else if (match === "dd") {
                result = pad(date.getDate());
            } else if (match === "ddd") {
                result = days.namesAbbr[date.getDay()];
            } else if (match === "dddd") {
                result = days.names[date.getDay()];
            } else if (match === "M") {
                result = date.getMonth() + 1;
            } else if (match === "MM") {
                result = pad(date.getMonth() + 1);
            } else if (match === "MMM") {
                result = months.namesAbbr[date.getMonth()];
            } else if (match === "MMMM") {
                result = months.names[date.getMonth()];
            } else if (match === "yy") {
                result = pad(date.getFullYear() % 100);
            } else if (match === "yyyy") {
                result = date.getFullYear();
            } else if (match === "h" ) {
                result = date.getHours() % 12 || 12
            } else if (match === "hh") {
                result = pad(date.getHours() % 12 || 12);
            } else if (match === "H") {
                result = date.getHours();
            } else if (match === "HH") {
                result = pad(date.getHours());
            } else if (match === "m") {
                result = date.getMinutes();
            } else if (match === "mm") {
                result = pad(date.getMinutes());
            } else if (match === "s") {
                result = date.getSeconds();
            } else if (match === "ss") {
                result = pad(date.getSeconds());
            } else if (match === "f") {
                result = math.floor(date.getMilliseconds() / 100);
            } else if (match === "ff") {
                result = math.floor(date.getMilliseconds() / 10);
            } else if (match === "fff") {
                result = date.getMilliseconds();
            } else if (match === "tt") {
                result = date.getHours() < 12 ? calendar.AM[0] : calendar.PM[0]
            }

            return result !== undefined ? result : match.slice(1, match.length - 1);
        });
    }

    //number formatting
    function formatNumber(number, format) {
        var culture = kendo.cultures.current,
            numberFormat = culture.numberFormat,
            groupSize = numberFormat.groupSize[0],
            groupSeparator = numberFormat[COMMA],
            decimal = numberFormat[POINT],
            precision = numberFormat.decimals,
            pattern = numberFormat.pattern[0],
            symbol,
            isCurrency, isPercent,
            customPrecision,
            formatAndPrecision,
            negative = number < 0,
            integer,
            fraction,
            integerLength,
            fractionLength,
            replacement = EMPTY,
            value = EMPTY,
            idx,
            length,
            ch,
            decimalIndex,
            sharpIndex,
            zeroIndex,
            start = -1,
            end;

        //return empty string if no number
        if (number === undefined) {
            return EMPTY;
        }

        if (!isFinite(number)) {
            return number;
        }

        //if no format then return number.toString() or number.toLocaleString() if culture.name is not defined
        if (!format) {
            return culture.name.length ? number.toLocaleString() : number.toString();
        }

        formatAndPrecision = standardFormatRegExp.exec(format);

        /* standard formatting */
        if (formatAndPrecision) {
            format = formatAndPrecision[1].toLowerCase();

            isCurrency = format === "c";
            isPercent = format === "p";

            if (isCurrency || isPercent) {
                //get specific number format information if format is currency or percent
                numberFormat = isCurrency ? numberFormat.currency : numberFormat.percent;
                groupSize = numberFormat.groupSize[0];
                groupSeparator = numberFormat[COMMA];
                decimal = numberFormat[POINT];
                precision = numberFormat.decimals;
                symbol = numberFormat.symbol;
                pattern = numberFormat.pattern[negative ? 0 : 1];
            }

            customPrecision = formatAndPrecision[2];

            if (customPrecision) {
                precision = +customPrecision;
            }

            //return number in exponential format
            if (format === "e") {
                return customPrecision ? number.toExponential(precision) : number.toExponential(); // toExponential() and toExponential(undefined) differ in FF #653438.
            }

            // multiply if format is percent
            if (isPercent) {
                number *= 100;
            }

            number = number.toFixed(precision);
            number = number.split(POINT);

            integer = number[0];
            fraction = number[1];

            //exclude "-" if number is negative.
            if (negative) {
                integer = integer.substring(1);
            }

            value = integer;
            integerLength = integer.length;

            //add group separator to the number if it is longer enough
            if (integerLength >= groupSize) {
                value = EMPTY;
                for (idx = 0; idx < integerLength; idx++) {
                    if (idx > 0 && (integerLength - idx) % groupSize === 0) {
                        value += groupSeparator;
                    }
                    value += integer.charAt(idx);
                }
            }

            if (fraction) {
                value += decimal + fraction;
            }

            if (format === "n" && !negative) {
                return value;
            }

            number = EMPTY;

            for (idx = 0, length = pattern.length; idx < length; idx++) {
                ch = pattern.charAt(idx);

                if (ch === "n") {
                    number += value;
                } else if (ch === "$" || ch === "%") {
                    number += symbol;
                } else {
                    number += ch;
                }
            }

            return number;
        }

        //custom formatting
        //
        //separate format by sections.
        format = format.split(";");
        if (negative && format[1]) {
            //make number positive and get negative format
            number = -number;
            format = format[1];
        } else if (number === 0) {
            //format for zeros
            format = format[2] || format[0];
            if (format.indexOf(SHARP) == -1 && format.indexOf(ZERO) == -1) {
                //return format if it is string constant.
                return format;
            }
        } else {
            format = format[0];
        }

        isCurrency = format.indexOf("$") != -1;
        isPercent = format.indexOf("%") != -1;

        //multiply number if the format has percent
        if (isPercent) {
            number *= 100;
        }

        if (isCurrency || isPercent) {
            //get specific number format information if format is currency or percent
            numberFormat = isCurrency ? numberFormat.currency : numberFormat.percent;
            groupSize = numberFormat.groupSize[0];
            groupSeparator = numberFormat[COMMA];
            decimal = numberFormat[POINT];
            precision = numberFormat.decimals;
            symbol = numberFormat.symbol;
        }

        decimalIndex = format.indexOf(POINT);
        length = format.length;

        if (decimalIndex != -1) {
            sharpIndex = format.lastIndexOf(SHARP);
            zeroIndex = format.lastIndexOf(ZERO);

            if (zeroIndex != -1) {
                value = number.toFixed(zeroIndex - decimalIndex);
                number = number.toString();
                number = number.length > value.length && sharpIndex > zeroIndex ? number : value;
            }
        } else {
            number = number.toFixed(0);
        }

        sharpIndex = format.indexOf(SHARP);
        zeroIndex = format.indexOf(ZERO);

        //define the index of the first digit placeholder
        if (sharpIndex == -1 && zeroIndex != -1) {
            start = zeroIndex;
        } else if (sharpIndex != -1 && zeroIndex == -1) {
            start = sharpIndex;
        } else {
            start = sharpIndex > zeroIndex ? zeroIndex : sharpIndex;
        }

        sharpIndex = format.lastIndexOf(SHARP);
        zeroIndex = format.lastIndexOf(ZERO);

        //define the index of the last digit placeholder
        if (sharpIndex == -1 && zeroIndex != -1) {
            end = zeroIndex;
        } else if (sharpIndex != -1 && zeroIndex == -1) {
            end = sharpIndex;
        } else {
            end = sharpIndex > zeroIndex ? sharpIndex : zeroIndex;
        }

        if (start == length) {
            end = start;
        }

        if (start != -1) {
            value = number.toString().split(POINT);
            integer = value[0];
            fraction = value[1] || EMPTY;

            integerLength = integer.length;
            fractionLength = fraction.length;

            //add group separator to the number if it is longer enough
            if (integerLength >= groupSize && format.indexOf(COMMA) != -1) {
                value = EMPTY;
                for (idx = 0; idx < integerLength; idx++) {
                    if (idx > 0 && (integerLength - idx) % groupSize === 0) {
                        value += groupSeparator;
                    }
                    value += integer.charAt(idx);
                }
                integer = value;
            }

            number = format.substring(0, start);

            for (idx = start; idx < length; idx++) {
                ch = format.charAt(idx);

                if (decimalIndex == -1) {
                    if (end - idx < integerLength) {
                        number += integer;
                        break;
                    }
                } else {
                    if (zeroIndex != -1 && zeroIndex < idx) {
                        replacement = EMPTY;
                    }

                    if ((decimalIndex - idx) <= integerLength && decimalIndex - idx > -1) {
                        number += integer;
                        idx = decimalIndex;
                    }

                    if (decimalIndex === idx) {
                        number += (fraction ? decimal : EMPTY) + fraction;
                        idx += end - decimalIndex + 1;
                        continue;
                    }
                }

                if (ch === ZERO) {
                    number += ch;
                    replacement = ch;
                } else if (ch === SHARP) {
                    number += replacement;
                } else if (ch === COMMA) {
                    continue;
                }
            }

            if (end >= start) {
                number += format.substring(end + 1);
            }

            //replace symbol placeholders
            if (isCurrency || isPercent) {
                value = EMPTY;
                for (idx = 0, length = number.length; idx < length; idx++) {
                    ch = number.charAt(idx);
                    value += (ch === "$" || ch === "%") ? symbol : ch;
                }
                number = value;
            }
        }

        return number;
    }

    function toString(value, fmt) {
        if (fmt) {
            if (value instanceof Date) {
                return formatDate(value, fmt);
            } else if (typeof value === NUMBER) {
                return formatNumber(value, fmt);
            }
        }

        return value !== undefined ? value : "";
    }

    if (globalize) {
        toString = proxy(globalize.format, globalize);
    }

    kendo.format = function(fmt) {
        var values = arguments;

        return fmt.replace(formatRegExp, function(match, index, placeholderFormat) {
            var value = values[parseInt(index) + 1];

            return toString(value, placeholderFormat ? placeholderFormat.substring(1) : "");
        });
    };

    kendo.toString = toString;
    })();


(function() {

    var nonBreakingSpaceRegExp = /\u00A0/g,
        formatsSequence = ["G", "g", "d", "F", "D", "y", "m", "T", "t"];

    function outOfRange(value, start, end) {
        return !(value >= start && value <= end);
    }

    function parseExact(value, format, culture) {
        if (!value) {
            return null;
        }

        var lookAhead = function (match) {
                var i = 0;
                while (format[idx] === match) {
                    i++;
                    idx++;
                }
                if (i > 0) {
                    idx -= 1;
                }
                return i;
            },
            getNumber = function(size) {
                var rg = new RegExp('^\\d{1,' + size + '}'),
                    match = value.substr(valueIdx, size).match(rg);

                if (match) {
                    match = match[0];
                    valueIdx += match.length;
                    return parseInt(match, 10);
                }
                return null;
            },
            getIndexByName = function (names) {
                var i = 0,
                    length = names.length,
                    name, nameLength;

                for (; i < length; i++) {
                    name = names[i];
                    nameLength = name.length;

                    if (value.substr(valueIdx, nameLength) == name) {
                        valueIdx += nameLength;
                        return i + 1;
                    }
                }
                return null;
            },
            checkLiteral = function() {
                if (value.charAt(valueIdx) == format[idx]) {
                    valueIdx++;
                }
            },
            calendar = culture.calendar,
            year = null,
            month = null,
            day = null,
            hours = null,
            minutes = null,
            seconds = null,
            milliseconds = null,
            idx = 0,
            valueIdx = 0,
            literal = false,
            date = new Date(),
            defaultYear = date.getFullYear(),
            shortYearCutOff = 30,
            ch, count, AM, PM, pmHour, length, pattern;

        if (!format) {
            format = "d"; //shord date format
        }

        //if format is part of the patterns get real format
        pattern = calendar.patterns[format];
        if (pattern) {
            format = pattern;
        }

        format = format.split("");
        length = format.length;

        for (; idx < length; idx++) {
            ch = format[idx];

            if (literal) {
                if (ch === "'") {
                    literal = false;
                } else {
                    checkLiteral();
                }
            } else {
                if (ch === "d") {
                    count = lookAhead("d");
                    day = count < 3 ? getNumber(2) : getIndexByName(calendar.days[count == 3 ? "namesAbbr" : "names"]);

                    if (day === null || outOfRange(day, 1, 31)) {
                        return null;
                    }
                } else if (ch === "M") {
                    count = lookAhead("M");
                    month = count < 3 ? getNumber(2) : getIndexByName(calendar.months[count == 3 ? 'namesAbbr' : 'names']);

                    if (month === null || outOfRange(month, 1, 12)) {
                        return null;
                    }
                    month -= 1; //because month is zero based
                } else if (ch === "y") {
                    count = lookAhead("y");
                    year = getNumber(count < 3 ? 2 : 4);
                    if (year === null) {
                        year = defaultYear;
                    }
                    if (year < shortYearCutOff) {
                        year = (defaultYear - defaultYear % 100) + year;
                    }
                } else if (ch === "h" ) {
                    lookAhead("h");
                    hours = getNumber(2);
                    if (hours == 12) {
                        hours = 0;
                    }
                    if (hours === null || outOfRange(hours, 0, 11)) {
                        return null;
                    }
                } else if (ch === "H") {
                    lookAhead("H");
                    hours = getNumber(2);
                    if (hours === null || outOfRange(hours, 0, 23)) {
                        return null;
                    }
                } else if (ch === "m") {
                    lookAhead("m");
                    minutes = getNumber(2);
                    if (minutes === null || outOfRange(minutes, 0, 59)) {
                        return null;
                    }
                } else if (ch === "s") {
                    lookAhead("s");
                    seconds = getNumber(2);
                    if (seconds === null || outOfRange(seconds, 0, 59)) {
                        return null;
                    }
                } else if (ch === "f") {
                    count = lookAhead("f");
                    milliseconds = getNumber(count);
                    if (milliseconds === null || outOfRange(milliseconds, 0, 999)) {
                        return null;
                    }
                } else if (ch === "t") {
                    count = lookAhead("t");
                    pmHour = getIndexByName(calendar.PM);
                } else if (ch === "'") {
                    checkLiteral();
                    literal = true;
                } else {
                    checkLiteral();
                }
            }
        }

        if (pmHour && hours < 12) {
            hours += 12;
        }

        if (day === null) {
            day = 1;
        }

        return new Date(year, month, day, hours, minutes, seconds, milliseconds);
    }

    kendo.parseDate = function(value, formats, culture) {
        if (value instanceof Date) {
            return value;
        }

        var idx = 0,
            date = null,
            length, property, patterns;

        if (!culture) {
            culture = kendo.culture();
        } else if (typeof culture === STRING) {
            kendo.culture(culture);
            culture = kendo.culture();
        }

        if (!formats) {
            formats = [];
            patterns = culture.calendar.patterns;
            length = formatsSequence.length;

            for (; idx < length; idx++) {
                formats[idx] = patterns[formatsSequence[idx]];
            }
            formats[idx] = "ddd MMM dd yyyy HH:mm:ss";

            idx = 0;
        }

        formats = $.isArray(formats) ? formats: [formats];
        length = formats.length;

        for (; idx < length; idx++) {
            date = parseExact(value, formats[idx], culture);
            if (date) {
                return date;
            }
        }

        return date;
    }

    kendo.parseInt = function(value, culture) {
        var result = kendo.parseFloat(value, culture);
        if (result) {
            result = result | 0;
        }
        return result;
    }

    kendo.parseFloat = function(value, culture) {
        if (!value && value !== 0) {
           return null;
        }

        if (typeof value === NUMBER) {
           return value;
        }

        value = value.toString();
        culture = kendo.cultures[culture] || kendo.cultures.current;

        var number = culture.numberFormat,
            percent = number.percent,
            currency = number.currency,
            symbol = currency.symbol,
            percentSymbol = percent.symbol,
            negative = value.indexOf("-") > -1,
            parts;

        if (value.indexOf(symbol) > -1) {
            number = currency;
            parts = number.pattern[0].replace("$", symbol).split("n");
            if (value.indexOf(parts[0]) > -1 && value.indexOf(parts[1]) > -1) {
                value = value.replace(parts[0], "").replace(parts[1], "");
                negative = true;
            }
        } else if (value.indexOf(percentSymbol) > -1) {
            number = percent;
            symbol = percentSymbol;
        }

        value = value.replace("-", "")
                     .replace(symbol, "")
                     .split(number[","].replace(nonBreakingSpaceRegExp, " ")).join("")
                     .replace(number["."], ".");

        value = parseFloat(value);

        if (isNaN(value)) {
            value = null;
        } else if (negative) {
            value *= -1;
        }

        return value;
    }

    if (globalize) {
        kendo.parseDate = proxy(globalize.parseDate, globalize);
        kendo.parseFloat = proxy(globalize.parseFloat, globalize);
    }
})();

    function wrap(element) {
        var browser = $.browser;

        if (!element.parent().hasClass("k-animation-container")) {
            var shadow = element.css(kendo.support.transitions.css + "box-shadow") || element.css("box-shadow"),
                radius = shadow ? shadow.match(boxShadowRegExp) || [ 0, 0, 0, 0, 0 ] : [ 0, 0, 0, 0, 0 ],
                blur = math.max((+radius[3]), +(radius[4] || 0)),
                left = (-radius[1]) + blur,
                right = (+radius[1]) + blur,
                bottom = (+radius[2]) + blur;

            if (browser.opera) { // Box shadow can't be retrieved in Opera
                left = right = bottom = 5;
            }

            element.wrap(
                         $("<div/>")
                         .addClass("k-animation-container")
                         .css({
                             width: element.outerWidth(),
                             height: element.outerHeight(),
                             marginLeft: -left,
                             paddingLeft: left,
                             paddingRight: right,
                             paddingBottom: bottom
                         }));
        } else {
            var wrap = element.parent(".k-animation-container");

            if (wrap.is(":hidden")) {
                wrap.show();
            }

            wrap.css({
                    width: element.outerWidth(),
                    height: element.outerHeight()
                });
        }

        if (browser.msie && math.floor(browser.version) <= 7) {
            element.css({
                zoom: 1
            });
        }

        return element.parent();
    }

    /**
     * Contains results from feature detection.
     * @name kendo.support
     * @namespace Contains results from feature detection.
     */
    (function() {
        /**
         * Indicates the width of the browser scrollbar. A value of zero means that the browser does not show a visual representation of a scrollbar (i.e. mobile browsers).
         * @name kendo.support.scrollbar
         * @property {Boolean}
         */
        support.scrollbar = function() {
            var div = document.createElement("div"),
                result;

            div.style.cssText = "overflow:scroll;overflow-x:hidden;zoom:1";
            div.innerHTML = "&nbsp;";
            document.body.appendChild(div);

            result = div.offsetWidth - div.scrollWidth;

            document.body.removeChild(div);
            return result;
        };

        var table = document.createElement("table");

        // Internet Explorer does not support setting the innerHTML of TBODY and TABLE elements
        try {
            table.innerHTML = "<tr><td></td></tr>";

            /**
             * Indicates whether the browser supports setting of the &lt;tbody&gt; innerHtml.
             * @name kendo.support.tbodyInnerHtml
             * @property {Boolean}
             */
            support.tbodyInnerHtml = true;
        } catch (e) {
            support.tbodyInnerHtml = false;
        }

        /**
         * Indicates whether the browser supports touch events.
         * @name kendo.support.touch
         * @property {Boolean}
         */
        support.touch = "ontouchstart" in window;
        support.pointers = navigator.msPointerEnabled;

        /**
         * Indicates whether the browser supports CSS transitions.
         * @name kendo.support.transitions
         * @property {Boolean}
         */
        var transitions = support.transitions = false;

        /**
         * Indicates whether the browser supports hardware 3d transitions.
         * @name kendo.support.hasHW3D
         * @property {Boolean}
         */
        support.hasHW3D = "WebKitCSSMatrix" in window && "m11" in new WebKitCSSMatrix();
        support.hasNativeScrolling = typeof document.documentElement.style.webkitOverflowScrolling == "string";

        each([ "Moz", "webkit", "O", "ms" ], function () {
            var prefix = this.toString();

            if (typeof table.style[prefix + "Transition"] === STRING) {
                var lowPrefix = prefix.toLowerCase();

                transitions = {
                    css: "-" + lowPrefix + "-",
                    prefix: prefix,
                    event: (lowPrefix === "o" || lowPrefix === "webkit") ? lowPrefix : ""
                };

                transitions.event = transitions.event ? transitions.event + "TransitionEnd" : "transitionend";

                return false;
            }
        });

        support.transitions = transitions;

        function detectOS(ua) {
            var os = false, match = [],
                agentRxs = {
                    fire: /(Silk)\/(\d+)\.(\d+(\.\d+)?)/,
                    android: /(Android)\s+(\d+)\.(\d+(\.\d+)?)/,
                    iphone: /(iPhone|iPod).*OS\s+(\d+)[\._]([\d\._]+)/,
                    ipad: /(iPad).*OS\s+(\d+)[\._]([\d_]+)/,
                    meego: /(MeeGo).+NokiaBrowser\/(\d+)\.([\d\._]+)/,
                    webos: /(webOS)\/(\d+)\.(\d+(\.\d+)?)/,
                    blackberry: /(BlackBerry|PlayBook).*?Version\/(\d+)\.(\d+(\.\d+)?)/
                },
                osRxs = {
                    ios: /^i(phone|pad|pod)$/i,
                    android: /^android|fire$/i
                },
                testOs = function (agent) {
                    for (var os in osRxs) {
                        if (osRxs.hasOwnProperty(os) && osRxs[os].test(agent))
                            return os;
                    }
                    return agent;
                };

            for (var agent in agentRxs) {
                if (agentRxs.hasOwnProperty(agent)) {
                    match = ua.match(agentRxs[agent]);
                    if (match) {
                        os = {};
                        os.device = agent;
                        os.name = testOs(agent);
                        os[os.name] = true;
                        os.majorVersion = match[2];
                        os.minorVersion = match[3].replace("_", ".");
                        os.flatVersion = os.majorVersion + os.minorVersion.replace(".", "");
                        os.flatVersion = os.flatVersion + (new Array(4 - os.flatVersion.length).join("0")); // Pad with zeroes
                        os.appMode = window.navigator.standalone || typeof window._nativeReady !== "undefined";

                        break;
                    }
                }
            }
            return os;
        }

        /**
         * Parses the mobile OS type and version from the browser user agent.
         * @name kendo.support.mobileOS
         */
        support.mobileOS = detectOS(navigator.userAgent);

        support.zoomLevel = function() {
            return support.touch ? (document.documentElement.clientWidth / window.innerWidth) : 1;
        };

        /**
         * Indicates the browser device pixel ratio.
         * @name kendo.support.devicePixelRatio
         * @property {Float}
         */
        support.devicePixelRatio = window.devicePixelRatio === undefined ? 1 : window.devicePixelRatio;
    })();

    /**
     * Exposed by jQuery.
     * @ignore
     * @name jQuery.fn
     * @namespace Handy jQuery plug-ins that are used by all Kendo widgets.
     */

    function size(obj) {
        var size = 0, key;
        for (key in obj) {
            obj.hasOwnProperty(key) && size++;
        }

        return size;
    }

    function getOffset(element, type) {
        if (!type) {
            type = "offset";
        }

        var result = element[type](),
            mobileOS = support.mobileOS;

        if (support.touch && mobileOS.ios && mobileOS.flatVersion < 410) { // Extra processing only in broken iOS'
            var offset = type == "offset" ? result : element.offset(),
                positioned = (result.left == offset.left && result.top == offset.top);

            if (positioned) {
                return {
                    top: result.top - window.scrollY,
                    left: result.left - window.scrollX
                };
            }
        }

        return result;
    }

    var directions = {
        left: { reverse: "right" },
        right: { reverse: "left" },
        down: { reverse: "up" },
        up: { reverse: "down" },
        top: { reverse: "bottom" },
        bottom: { reverse: "top" },
        "in": { reverse: "out" },
        out: { reverse: "in" }
    };

    function parseEffects(input) {
        var effects = {};

        each((typeof input === "string" ? input.split(" ") : input), function(idx) {
            effects[idx] = this;
        });

        return effects;
    }

    var fx = {
        promise: function (element, options) {
            if (options.show) {
                element.css({ display: element.data("olddisplay") || "block" }).css("display");
            }

            if (options.hide) {
                element.data("olddisplay", element.css("display")).hide();
            }

            if (options.completeCallback) {
                options.completeCallback(element); // call the external complete callback with the element
            }

            element.dequeue();
        },

        transitionPromise: function(element, destination, options) {
            var container = kendo.wrap(element);
            container.append(destination);

            element.hide();
            destination.show();

            if (options.completeCallback) {
                options.completeCallback(element); // call the external complete callback with the element
            }

            return element;
        }
    };

    function prepareAnimationOptions(options, duration, reverse, complete) {
        if (typeof options === STRING) {
            // options is the list of effect names separated by space e.g. animate(element, "fadeIn slideDown")

            // only callback is provided e.g. animate(element, options, function() {});
            if (isFunction(duration)) {
                complete = duration;
                duration = 400;
                reverse = false;
            }

            if (isFunction(reverse)) {
                complete = reverse;
                reverse = false;
            }

            if (typeof duration === BOOLEAN){
                reverse = duration;
                duration = 400;
            }

            options = {
                effects: options,
                duration: duration,
                reverse: reverse,
                complete: complete
            };
        }

        return extend({
            //default options
            effects: {},
            duration: 400, //jQuery default duration
            reverse: false,
            init: noop,
            teardown: noop,
            hide: false,
            show: false
        }, options, { completeCallback: options.complete, complete: noop }); // Move external complete callback, so deferred.resolve can be always executed.

    }

    function animate(element, options, duration, reverse, complete) {
        element.each(function (idx, el) { // fire separate queues on every element to separate the callback elements
            el = $(el);
            el.queue(function () {
                fx.promise(el, prepareAnimationOptions(options, duration, reverse, complete));
            });
        });

        return element;
    }

    function animateTo(element, destination, options, duration, reverse, complete) {
        return fx.transitionPromise(element, destination, prepareAnimationOptions(options, duration, reverse, complete));
    }

    extend($.fn, /** @lends jQuery.fn */{
        kendoStop: function(clearQueue, gotoEnd) {
            return this.stop(clearQueue, gotoEnd);
        },

        kendoAnimate: function(options, duration, reverse, complete) {
            return animate(this, options, duration, reverse, complete);
        },

        kendoAnimateTo: function(destination, options, duration, reverse, complete) {
            return animateTo(this, destination, options, duration, reverse, complete);
        }
    });

    function toggleClass(element, classes, options, add) {
        if (classes) {
            classes = classes.split(" ");

            each(classes, function(idx, value) {
                element.toggleClass(value, add);
            });
        }

        return element;
    }

    extend($.fn, /** @lends jQuery.fn */{
        kendoAddClass: function(classes, options){
            return toggleClass(this, classes, options, true);
        },
        kendoRemoveClass: function(classes, options){
            return toggleClass(this, classes, options, false);
        },
        kendoToggleClass: function(classes, options, toggle){
            return toggleClass(this, classes, options, toggle);
        }
    });

    var ampRegExp = /&/g,
        ltRegExp = /</g,
        gtRegExp = />/g;
    /**
     * Encodes HTML characters to entities.
     * @name kendo.htmlEncode
     * @function
     * @param {String} value The string that needs to be HTML encoded.
     * @returns {String} The encoded string.
     */
    function htmlEncode(value) {
        return ("" + value).replace(ampRegExp, "&amp;").replace(ltRegExp, "&lt;").replace(gtRegExp, "&gt;");
    }

    var touchLocation = function(e) {
        return {
            idx: 0,
            x: e.pageX,
            y: e.pageY
        };
    };

    var eventTarget = function (e) {
        return e.target;
    };

    if (support.touch) {
        /** @ignore */
        touchLocation = function(e, id) {
            var changedTouches = e.changedTouches || e.originalEvent.changedTouches;

            if (id) {
                var output = null;
                each(changedTouches, function(idx, value) {
                    if (id == value.identifier) {
                        output = {
                            idx: value.identifier,
                            x: value.pageX,
                            y: value.pageY
                        };
                    }
                });
                return output;
            } else {
                return {
                    idx: changedTouches[0].identifier,
                    x: changedTouches[0].pageX,
                    y: changedTouches[0].pageY
                };
            }
        };

        eventTarget = function(e) {
            var touches = "originalEvent" in e ? e.originalEvent.changedTouches : "changedTouches" in e ? e.changedTouches : null;

            return touches ? document.elementFromPoint(touches[0].clientX, touches[0].clientY) : null;
        };

        each(["swipe", "swipeLeft", "swipeRight", "swipeUp", "swipeDown", "doubleTap", "tap"], function(m, value) {
            $.fn[value] = function(callback) {
                return this.bind(value, callback)
            }
        });
    }

    if (support.touch) {
        support.mousedown = "touchstart";
        support.mouseup = "touchend";
        support.mousemove = "touchmove";
        support.mousecancel = "touchcancel";
    } else {
        support.mousemove = "mousemove";
        support.mousedown = "mousedown";
        support.mouseup = "mouseup";
        support.mousecancel = "mouseleave";
    }

    var wrapExpression = function(members) {
        var result = "d",
            index,
            idx,
            length,
            member,
            count = 1;

        for (idx = 0, length = members.length; idx < length; idx++) {
            member = members[idx];
            if (member !== "") {
                index = member.indexOf("[");

                if (index != 0) {
                    if (index == -1) {
                        member = "." + member;
                    } else {
                        count++;
                        member = "." + member.substring(0, index) + " || {})" + member.substring(index);
                    }
                }

                count++;
                result += member + ((idx < length - 1) ? " || {})" : ")");
            }
        }
        return new Array(count).join("(") + result;
    },
    localUrlRe = /^([a-z]+:)?\/\//i;

    extend(kendo, /** @lends kendo */ {
        /**
         * @name kendo.ui
         * @namespace Contains all classes for the Kendo UI widgets.
         */
        ui: {
            /**
             * Shows an overlay with a loading message, indicating that an action is in progress.
             * @name kendo.ui.progress
             * @function
             * @param {jQueryObject} container The container that will hold the overlay
             * @param {Boolean} toggle Whether the overlay should be shown or hidden
             */
            progress: function(container, toggle) {
                var mask = container.find(".k-loading-mask");

                if (toggle) {
                    if (!mask.length) {
                        mask = $("<div class='k-loading-mask'><span class='k-loading-text'>Loading...</span><div class='k-loading-image'/><div class='k-loading-color'/></div>")
                            .width("100%").height("100%")
                            .prependTo(container)
                            .css({ top: container.scrollTop(), left: container.scrollLeft() });
                    }
                } else if (mask) {
                    mask.remove();
                }
            }
        },
        fx: fx,
        data: {},
        mobile: {},
        keys: {
            DELETE: 46,
            BACKSPACE: 8,
            TAB: 9,
            ENTER: 13,
            ESC: 27,
            LEFT: 37,
            UP: 38,
            RIGHT: 39,
            DOWN: 40,
            END: 35,
            HOME: 36,
            SPACEBAR: 32,
            PAGEUP: 33,
            PAGEDOWN: 34,
            F12: 123
        },
        support: support,
        animate: animate,
        ns: "",
        attr: function(value) {
            return "data-" + kendo.ns + value;
        },
        wrap: wrap,
        size: size,
        getOffset: getOffset,
        parseEffects: parseEffects,
        toggleClass: toggleClass,
        directions: directions,
        Observable: Observable,
        Class: Class,
        Template: Template,
        /**
         * Shorthand for {@link kendo.Template.compile}.
         * @name kendo.template
         * @function
         */
        template: proxy(Template.compile, Template),
        /**
         * Shorthand for {@link kendo.Template.render}.
         * @name kendo.render
         * @function
         */
        render: proxy(Template.render, Template),
        stringify: proxy(JSON.stringify, JSON),
        touchLocation: touchLocation,
        eventTarget: eventTarget,
        htmlEncode: htmlEncode,
        isLocalUrl: function(url) {
            return url && !localUrlRe.test(url);
        },
        /** @ignore */
        expr: function(expression, safe) {
            expression = expression || "";

            if (expression && expression.charAt(0) !== "[") {
                expression = "." + expression;
            }

            if (safe) {
                expression =  wrapExpression(expression.split("."));
            } else {
                expression = "d" + expression;
            }

            return expression;
        },
        /** @ignore */
        getter: function(expression, safe) {
            return new Function("d", "return " + kendo.expr(expression, safe));
        },
        /** @ignore */
        setter: function(expression) {
            return new Function("d,value", "d." + expression + "=value");
        },
        /** @ignore */
        accessor: function(expression) {
            return {
                get: kendo.getter(expression),
                set: kendo.setter(expression)
            };
        },
        /** @ignore */
        guid: function() {
            var id = "", i, random;

            for (i = 0; i < 32; i++) {
                random = math.random() * 16 | 0;

                if (i == 8 || i == 12 || i == 16 || i == 20) {
                    id += "-";
                }
                id += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16);
            }

            return id;
        },

        roleSelector: function(role) {
            return "[" + kendo.attr("role") + "=" + role + "]";
        }
    });

    var Widget = Observable.extend( /** @lends kendo.ui.Widget.prototype */ {
        /**
         * Initializes widget. Sets `element` and `options` properties.
         * @constructs
         * @class Represents a UI widget. Base class for all Kendo widgets
         * @extends kendo.Observable
         */
        init: function(element, options) {
            var that = this;

            that.element = $(element);

            Observable.fn.init.call(that);

            that.options = extend(true, {}, that.options, options);

            if (!that.element.attr(kendo.attr("role"))) {
                that.element.attr(kendo.attr("role"), (that.options.name || "").toLowerCase());
            }

            /*
            kendo.notify(that);
            */
        }
    });

    kendo.notify = noop;
    kendo.widgetBinders = {};

    extend(kendo.ui, /** @lends kendo.ui */{
        Widget: Widget,
        /**
         * Helper method for writing new widgets.
         * Exposes a jQuery plug-in that will handle the widget creation and attach its client-side object in the appropriate data-* attribute.
         * Also triggers the init event, when the widget has been created.
         * @name kendo.ui.plugin
         * @function
         * @param {kendo.ui.Widget} widget The widget function.
         * @param {Object} register <kendo.ui> The object where the reference to the widget is recorded.
         * @param {Object} prefix <""> The plugin function prefix, e.g. "Mobile" will register "kendoMobileFoo".
         * @example
         * function TextBox(element, options);
         * kendo.ui.plugin(TextBox);
         *
         * // initialize a new TextBox for each input, with the given options object.
         * $("input").kendoTextBox({ });
         * // get the TextBox object and call the value API method
         * $("input").data("kendoTextBox").value();
         */
        plugin: function(widget, register, prefix) {
            var name = widget.fn.options.name;

            register = register || kendo.ui;
            prefix = prefix || "";

            register[name] = widget;

            name = "kendo" + prefix + name;
            // expose a jQuery plugin
            $.fn[name] = function(options) {
                $(this).each(function() {
                    var comp = new widget(this, options);
                    $(this).data(name, comp)
                        .data("kendoWidget", comp);
                });
                return this;
            }
        }
    });
})(jQuery);

(function($, undefined) {
    var kendo = window.kendo,
        fx = kendo.fx,
        each = $.each,
        extend = $.extend,
        size = kendo.size,
        browser = $.browser,
        support = kendo.support,
        transitions = support.transitions,
        scaleProperties = { scale: 0, scaleX: 0, scaleY: 0, scale3d: 0 },
        translateProperties = { translate: 0, translateX: 0, translateY: 0, translate3d: 0 },
        matrix3d = [ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1 ],
        matrix3dRegExp = /matrix3?d?\s*\(.*,\s*([\d\w\.\-]+),\s*([\d\w\.\-]+),\s*([\d\w\.\-]+)/,
        cssParamsRegExp = /^(-?[\d\.\-]+)?[\w\s]*,?\s*(-?[\d\.\-]+)?[\w\s]*/i,
        translateXRegExp = /translatex?$/i,
        transformProps = ["perspective", "rotate", "rotateX", "rotateY", "rotateZ", "rotate3d", "scale", "scaleX", "scaleY", "scaleZ", "scale3d", "skew", "skewX", "skewY", "translate", "translateX", "translateY", "translateZ", "translate3d", "matrix", "matrix3d"],
        cssPrefix = transitions.css,
        round = Math.round,
        BLANK = "",
        PX = "px",
        NONE = "none",
        AUTO = "auto",
        SCALE = "scale",
        WIDTH = "width",
        HEIGHT = "height",
        HIDDEN = "hidden",
        ORIGIN = "origin",
        ABORT_ID = "abortId",
        OVERFLOW = "overflow",
        TRANSLATE = "translate",
        TRANSITION = cssPrefix + "transition",
        TRANSFORM = cssPrefix + "transform";

    kendo.directions = {
        left: {
            reverse: "right",
            property: "left",
            transition: "translateX",
            vertical: false,
            modifier: -1
        },
        right: {
            reverse: "left",
            property: "left",
            transition: "translateX",
            vertical: false,
            modifier: 1
        },
        down: {
            reverse: "up",
            property: "top",
            transition: "translateY",
            vertical: true,
            modifier: 1
        },
        up: {
            reverse: "down",
            property: "top",
            transition: "translateY",
            vertical: true,
            modifier: -1
        },
        top: {
            reverse: "bottom"
        },
        bottom: {
            reverse: "top"
        },
        "in": {
            reverse: "out",
            modifier: -1
        },
        out: {
            reverse: "in",
            modifier: 1
        }
    };

    extend($.fn, {
        kendoStop: function(clearQueue, gotoEnd) {
            if (transitions) {
                return kendo.fx.stopQueue(this, clearQueue || false, gotoEnd || false);
            } else {
                return this.stop(clearQueue, gotoEnd);
            }
        }
    });

    kendo.toggleClass = function(element, classes, options, add) {
        if (classes) {
            classes = classes.split(" ");

            if (transitions) {
                options = extend({
                    exclusive: "all",
                    duration: 400,
                    ease: "ease-out"
                }, options);

                element.css(TRANSITION, options.exclusive + " " + options.duration + "ms " + options.ease);
                setTimeout(function() {
                    element.css(TRANSITION, NONE).css(HEIGHT);
                }, options.duration); // TODO: this should fire a kendoAnimate session instead.
            }

            each(classes, function(idx, value) {
                element.toggleClass(value, add);
            });
        }

        return element;
    };

    kendo.parseEffects = function(input, mirror) {
        var effects = {};

        if (typeof input === "string") {
            each(input.split(" "), function() {
                var effect = this.split(":"),
                    direction = effect[1],
                    effectBody = {};

                effect.length > 1 && (effectBody["direction"] = mirror ? kendo.directions[direction].reverse : direction);

                effects[effect[0]] = effectBody;
            });
        } else {
            each(input, function(idx) {
                var direction = this.direction;

                if (direction && mirror)
                    direction = kendo.directions[direction].reverse;

                effects[idx] = this;
            });
        }

        return effects;
    };

    function parseInteger(value) {
        return parseInt(value, 10);
    }

    function parseCSS(element, property) {
        return parseInteger(element.css(property));
    }

    function getComputedStyles(element, properties) {
        var styles = {};

        if (properties) {
            if (document.defaultView && document.defaultView.getComputedStyle) {
                var computedStyle = document.defaultView.getComputedStyle(element, "");

                each(properties, function(idx, value) {
                    styles[value] = computedStyle.getPropertyValue(value);
                });
            } else
                if (element.currentStyle) { // Not really needed
                    var style = element.currentStyle;

                    each(properties, function(idx, value) {
                        styles[value] = style[value.replace(/\-(\w)/g, function (strMatch, g1) { return g1.toUpperCase() })];
                    });
                }
        } else {
            styles = document.defaultView.getComputedStyle(element, "");
        }

        return styles;
    }

    function slideToSlideIn(options) {
      options.effects.slideIn = options.effects.slide;
      delete options.effects.slide;
      return options;
    }

    function parseTransitionEffects(options) {
        var effects = options.effects,
            mirror;

        if (effects === "zoom") {
            effects = "zoomIn fadeIn";
        }
        if (effects === "slide") {
            effects = "slide:left";
        }
        if (effects === "fade") {
            effects = "fadeIn";
        }
        if (effects === "overlay") {
            effects = "slideIn:left";
        }
        if (/^overlay:(.+)$/.test(effects)) {
            effects = "slideIn:" + RegExp.$1;
        }

        mirror = options.reverse && /^(slide:)/.test(effects);

        if (mirror) {
            delete options.reverse;
        }

        options.effects = $.extend(kendo.parseEffects(effects, mirror), {show: true});

        return options;
    }

    if (transitions) {

        function keys(obj) {
            var acc = [];
            for (var propertyName in obj)
                acc.push(propertyName);
            return acc;
        }

        function removeTransitionStyles(element) {
            element.css(TRANSITION, NONE);

            if (!browser.safari) {
                element.css(HEIGHT);
            }
        }

        function activateTask(currentTransition) {
            var element = currentTransition.object;

            if (!currentTransition) return;

            element.css(currentTransition.setup);
            element.css(TRANSITION);
            element.data(ABORT_ID, setTimeout(function() {

                removeTransitionStyles(element);
                element.dequeue();
                currentTransition.complete.call(element);

            }, currentTransition.duration));

            element.css(currentTransition.CSS);
        }

        extend(kendo.fx, {
            transition: function(element, properties, options) {

                options = extend({
                        duration: 200,
                        ease: "ease-out",
                        complete: null,
                        exclusive: "all"
                    },
                    options
                );

                options.duration = $.fx ? $.fx.speeds[options.duration] || options.duration : options.duration;

                var transforms = [],
                    cssValues = {},
                    key;

                for (key in properties)
                    if (transformProps.indexOf(key) != -1)
                        transforms.push(key + "(" + properties[key] + ")");
                    else
                        cssValues[key] = properties[key];

                if (transforms.length)
                    cssValues[TRANSFORM] = transforms.join(" ");

                var currentTask = {
                    keys: keys(cssValues),
                    CSS: cssValues,
                    object: element,
                    setup: {},
                    duration: options.duration,
                    complete: options.complete
                };
                currentTask.setup[TRANSITION] = options.exclusive + " " + options.duration + "ms " + options.ease;

                var oldKeys = element.data("keys") || [];
                $.merge(oldKeys, currentTask.keys);
                element.data("keys", $.unique(oldKeys));

                activateTask(currentTask);
            },

            stopQueue: function(element, clearQueue, gotoEnd) {

                if (element.data(ABORT_ID)) {
                    clearTimeout(element.data(ABORT_ID));
                    element.removeData(ABORT_ID);
                }

                var that = this,
                    taskKeys = element.data("keys"),
                    retainPosition = (gotoEnd === false && taskKeys);

                if (retainPosition) {
                    var cssValues = getComputedStyles(element[0], taskKeys);
                }

                removeTransitionStyles(element);

                if (retainPosition) {
                    element.css(cssValues);
                }

                element.removeData("keys");

                if (that.complete) {
                    that.complete.call(element);
                }

                element.stop(clearQueue);
                return element;
            }

        });
    }

    function animationProperty(element, property) {
        if (transitions) {
            var transform = element.css(TRANSFORM);
            if (transform == "none") return property == "scale" ? 1 : 0;

            var match = transform.match(new RegExp(property + "\\s*\\(([\\d\\w\\.]+)")),
                computed = 0;

            if (match)
                computed = parseInteger(match[1]);
            else {
                match = transform.match(matrix3dRegExp) || [0, 0, 0, 0];

                if (translateXRegExp.test(property)) {
                    computed = parseInteger(match[2]);
                } else if (property.toLowerCase() == "translatey") {
                    computed = parseInteger(match[3]);
                } else if (property.toLowerCase() == "scale") {
                    computed = parseFloat(match[1]);
                }
            }

            return computed;
        } else
            return element.css(property);
    }

    kendo.fx.promise = function(element, options) {
        var promises = [], effects = options.effects;

        if (typeof effects === "string") {
            effects = kendo.parseEffects(options.effects);
        }

        element.data("animating", true);
        element.data("reverse", options.reverse);

        var props = { keep: [], restore: [] }, css = {},
            methods = { setup: [], teardown: [] }, properties = {},

            // create a promise for each effect
            promise = $.Deferred(function(deferred) {
                if (size(effects)) {
                    var opts = extend({}, options, { complete: deferred.resolve });

                    each(effects, function(effectName, settings) {
                        var effect = kendo.fx[effectName];

                        if (effect) {
                            opts = extend(true, opts, settings);

                            each(methods, function (idx) {
                                if (effect[idx])
                                    methods[idx].push(effect[idx]);
                            });

                            each(props, function(idx) {
                                if (effect[idx])
                                    $.merge(props[idx], effect[idx]);
                            });

                            if (effect["css"])
                                css = extend(css, effect.css);
                        }
                    });

                    if (methods.setup.length) {
                        each ($.unique(props.keep), function(idx, value) {
                            if (!element.data(value))
                                element.data(value, element.css(value));
                        });

                        if (options.show) {
                            css = extend(css, { display: element.data("olddisplay") || "block" }); // Add show to the set
                        }

                        if (css.transform) {
                            css[support.transitions.prefix + "Transform"] = css.transform;
                            delete css.transform;
                        }

                        element.css(css);
                        element.css("overflow"); // Nudge Chrome

                        each (methods.setup, function() { properties = extend(properties, this(element, opts)) });

                        if (kendo.fx["animate"]) {
                            options.init();
                            kendo.fx.animate(element, properties, opts);
                        }

                        return;
                    }
                }

                if (options.show) {
                    element.css({ display: element.data("olddisplay") || "block" }).css("display");
                }

                deferred.resolve();
            }).promise();

        promises.push(promise);

        //wait for all effects to complete
        $.when.apply(null, promises).then(function() {
            element
                .removeData("animating")
                .removeData("reverse")
                .dequeue(); // call next animation from the queue

            if (options.hide) {
                element.data("olddisplay", element.css("display")).hide();
            }

            if (size(effects)) {
                var restore = function() {
                    each ($.unique(props.restore), function(idx, value) {
                        element.css(value, element.data(value));
                    });
                };

                if ($.browser.msie) {
                    setTimeout(restore, 0); // Again jQuery callback in IE.
                }
                else {
                    restore();
                }

                each(methods.teardown, function() { this(element, options.reverse); }); // call the internal completion callbacks
            }

            if (options.completeCallback) {
                options.completeCallback(element); // call the external complete callback with the element
            }
        });
    };

    kendo.fx.transitionPromise = function(element, destination, options) {
        kendo.fx.animateTo(element, destination, options);
        return element;
    };

    extend(kendo.fx, {
        animate: function(elements, properties, options) {
            var useTransition = options.transition !== false;
            delete options.transition;

            if (transitions && "transition" in fx && useTransition) {
                fx.transition(elements, properties, options);
            } else {
                each(transformProps, function(idx, value) { // remove transforms to avoid IE and older browsers confusion
                    var params,
                        currentValue = properties ? properties[value]+ " " : null; // We need to match

                    elements.each(function() {
                        if (currentValue) {
                            var element = $(this),
                                single = properties;

                            if (value in scaleProperties && properties[value] !== undefined) {
                                !element.data(SCALE) && element.data(SCALE, {
                                            top: parseCSS(element, "top") || 0,
                                            left: parseCSS(element, "left") || 0,
                                            width: element.width(),
                                            height: element.height()
                                        });

                                element.data(WIDTH, element[0].style.width);
                                element.data(HEIGHT, element[0].style.height);
                                var originalScale = element.data(SCALE);

                                params = currentValue.match(cssParamsRegExp);
                                if (params) {
                                    var scaleX = value == SCALE + "Y" ? +null : +params[1],
                                        scaleY = value == SCALE + "Y" ? +params[1] : +params[2] || +params[1];

                                    !isNaN(scaleX) && extend(single, {
                                                left: originalScale.left + originalScale.width * (1-scaleX) / 2,
                                                width: originalScale.width * scaleX
                                    });

                                    !isNaN(scaleY) && extend(single, {
                                                top: originalScale.top + originalScale.height * (1-scaleY) / 2,
                                                height: originalScale.height * scaleY
                                            });
                                }
                            } else
                                if (value in translateProperties && properties[value] !== undefined) {
                                    var position = element.css("position"),
                                        isFixed = (position == "absolute" || position == "fixed");

                                    if (!element.data(TRANSLATE)) {
                                        if (isFixed) {
                                            element.data(TRANSLATE, {
                                                top: parseCSS(element, "top") || 0,
                                                left: parseCSS(element, "left") || 0,
                                                bottom: parseCSS(element, "bottom"),
                                                right: parseCSS(element, "right")
                                            });
                                        } else
                                            element.data(TRANSLATE, {
                                                top: parseCSS(element, "marginTop") || 0,
                                                left: parseCSS(element, "marginLeft") || 0
                                            });
                                    }

                                    var originalPosition = element.data(TRANSLATE);

                                    params = currentValue.match(cssParamsRegExp);
                                    if (params) {

                                        var dX = value == TRANSLATE + "Y" ? +null : +params[1],
                                            dY = value == TRANSLATE + "Y" ? +params[1] : +params[2];

                                        if (isFixed) {
                                            if (!isNaN(originalPosition.right))
                                                !isNaN(dX) && extend(single, { right: originalPosition.right - dX });
                                            else
                                                !isNaN(dX) && extend(single, { left: originalPosition.left + dX });

                                            if (!isNaN(originalPosition.bottom))
                                                !isNaN(dY) && extend(single, { bottom: originalPosition.bottom - dY });
                                            else
                                                !isNaN(dY) && extend(single, { top: originalPosition.top + dY });
                                        } else {
                                            !isNaN(dX) && extend(single, { marginLeft: originalPosition.left + dX });
                                            !isNaN(dY) && extend(single, { marginTop: originalPosition.top + dY });
                                        }
                                    }
                                }

                            value in single && delete single[value];
                            element.animate(single, extend({ queue: false }, options, { show: false, hide: false })); // Stop animate from showing/hiding the element to be able to hide it later on.
                        }
                    });
                });
            }
        },

        animateTo: function(element, destination, options) {
            var direction,
                commonParent = element.parents().filter(destination.parents()).first(),
                originalOverflow = commonParent.css(OVERFLOW);

            options = parseTransitionEffects(options);
            commonParent.css("overflow", "hidden");

            $.each(options.effects, function(name, definition) {
                direction = direction || definition.direction;
            });

            function complete() {
                destination[0].style.cssText = "";
                element[0].style.cssText = ""; // Removing the whole style attribute breaks Android.
                commonParent.css(OVERFLOW, originalOverflow);
                options.completeCallback && options.completeCallback();
            }

            options.complete = $.browser.msie ? function() { setTimeout(complete) } : complete;

            if ("slide" in options.effects) {
              element.kendoAnimate(options);
              destination.kendoAnimate(slideToSlideIn(options));
            } else {
              (options.reverse ? element : destination).kendoAnimate(options);
            }
        },

        fadeOut: {
            css: {
                opacity: function() {
                    return $(this).data("reverse") && !this.style.opacity ? 0 : undefined;
                }
            },
            setup: function(element, options) {
                return extend({ opacity: options.reverse ? 1 : 0 }, options.properties)
            }
        },
        fadeIn: {
            css: {
                opacity: function() {
                    return !$(this).data("reverse") && !this.style.opacity ? 0 : undefined;
                }
            },
            setup: function(element, options) {
                return extend({ opacity: options.reverse ? 0 : 1 }, options.properties)
            }
        },
        zoomIn: {
            css: {
                transform: function() {
                    return !$(this).data("reverse") && transitions ? "scale(.01)" : undefined;
                }
            },
            setup: function(element, options) {
                return extend({ scale: options.reverse ? .01 : 1 }, options.properties)
            },
            teardown: function(element) {
                if (element.data(SCALE)) { // Remove IE "zoom"
                    setTimeout(function() { element.css(HEIGHT, AUTO).css(HEIGHT); }, 0);
                    element.removeData(SCALE);
                }
            }
        },
        zoomOut: {
            css: {
                transform: function() {
                    return $(this).data("reverse") && transitions ? "scale(.01)" : undefined;
                }
            },
            setup: function(element, options) {
                return extend({ scale: options.reverse ? 1 : .01 }, options.properties)
            }
        },
        slide: {
            setup: function(element, options) {
                var direction = kendo.directions[options.direction],
                    extender = {}, offset, reverse = options.reverse,
                    property = transitions && options.transition !== false ? direction.transition : direction.property,
                    divisor = options.divisor || 1;

                if (!reverse) {
                    var origin = element.data(ORIGIN);
                    offset = (direction.modifier * (direction.vertical ? element.outerHeight() : element.outerWidth()) / divisor);
                    !origin && origin !== 0  && element.data(ORIGIN, parseFloat(animationProperty(element, property)));
                }

                extender[property] = reverse ? (element.data(ORIGIN) || 0) : (element.data(ORIGIN) || 0) + offset + PX;

                return extend(extender, options.properties);
            }
        },
        slideMargin: {
            setup: function(element, options) {
                var origin = element.data(ORIGIN),
                    offset = options.offset, margin,
                    extender = {}, reverse = options.reverse;

                !reverse && !origin && origin !== 0 && element.data(ORIGIN, parseInt(element.css("margin-" + options.axis), 10));

                margin = (element.data(ORIGIN) || 0);
                extender["margin-" + options.axis] = !reverse ? margin + offset : margin;
                return extend(extender, options.properties);
            }
        },
        slideTo: {
            setup: function(element, options) {
                var offset = (options.offset+"").split(","),
                    extender = {}, reverse = options.reverse;

                if (transitions && options.transition !== false) {
                    extender["translate"] = !reverse ? offset + PX : 0;
                } else {
                    extender["left"] = !reverse ? offset[0] : 0;
                    extender["top"] = !reverse ? offset[1] : 0;
                }
                element.css("left");

                return extend(extender, options.properties);
            }
        },
        slideIn: {
            setup: function(element, options) {
                var direction = kendo.directions[options.direction],
                    offset = -direction.modifier * (direction.vertical ? element.outerHeight() : element.outerWidth()),
                    extender = {}, reverse = options.reverse;

                if (transitions && options.transition !== false) {
                    element.css(TRANSFORM, direction.transition + "(" + (!reverse ? offset : 0) + "px)");
                    extender[direction.transition] = reverse ? offset + PX : 0;
                    element.css(TRANSFORM);
                } else {
                    !reverse && element.css(direction.property, offset + PX);
                    extender[direction.property] = reverse ? offset + PX : 0;
                    element.css(direction.property); // Read a style to force Chrome to apply the change.
                }

                return extend(extender, options.properties);
            }
        },
        expand: {
            keep: [ OVERFLOW ],
            css: { overflow: HIDDEN },
            restore: [ OVERFLOW ],
            setup: function(element, options) {
                var reverse = options.reverse,
                    property = (options.direction ? options.direction == "vertical" : true) ? HEIGHT : WIDTH,
                    setLength = element[0].style[property],
                    oldLength = element.data(property),
                    length = parseInteger(oldLength || setLength) || round(element.css(property, AUTO )[property]()),
                    completion = {};

                completion[property] = (reverse ? 0 : length) + PX;
                element.css(property, reverse ? length : 0).css(property);
                if (oldLength === undefined) {
                    element.data(property, setLength);
                }

                return extend(completion, options.properties);
            },
            teardown: function(element, options) {
                var property = (options.direction ? options.direction == "vertical" : true) ? HEIGHT : WIDTH,
                    length = element.data(property);
                if (length == AUTO || length === BLANK) {
                    setTimeout(function() { element.css(property, AUTO).css(property); }, 0); // jQuery animate complete callback in IE is called before the last animation step!
                }
            }
        },
        simple: {
            setup: function(element, options) {
                return options.properties;
            }
        }
    });

    kendo.fx.expandVertical = kendo.fx.expand; // expandVertical is deprecated.

})(jQuery);
(function($, undefined) {
    var kendo = window.kendo,
        extend = $.extend,
        odataFilters = {
            eq: "eq",
            neq: "ne",
            gt: "gt",
            gte: "ge",
            lt: "lt",
            lte: "le",
            contains : "substringof",
            endswith: "endswith",
            startswith: "startswith"
        },
        mappers = {
            pageSize: $.noop,
            page: $.noop,
            filter: function(params, filter) {
                params.$filter = toOdataFilter(filter);
            },
            sort: function(params, orderby) {
                params.$orderby = $.map(orderby, function(value) {
                    var order = value.field.replace(/\./g, "/");

                    if (value.dir === "desc") {
                        order += " desc";
                    }

                    return order;
                }).join(",");
            },
            skip: function(params, skip) {
                if (skip) {
                    params.$skip = skip;
                }
            },
            take: function(params, take) {
                if (take) {
                    params.$top = take;
                }
            }
        },
        defaultDataType = {
            read: {
                dataType: "jsonp"
            }
        };

    function toOdataFilter(filter) {
        var result = [],
            logic = filter.logic || "and",
            idx,
            length,
            field,
            type,
            format,
            operator,
            value,
            filters = filter.filters;

        for (idx = 0, length = filters.length; idx < length; idx++) {
            filter = filters[idx];
            field = filter.field;
            value = filter.value;
            operator = filter.operator;

            if (filter.filters) {
                filter = toOdataFilter(filter);
            } else {
                field = field.replace(/\./g, "/"),

                filter = odataFilters[operator];

                if (filter && value !== undefined) {
                    type = $.type(value);
                    if (type === "string") {
                        format = "'{1}'";
                        value = value.replace(/'/g, "''");
                    } else if (type === "date") {
                        format = "datetime'{1:yyyy-MM-ddTHH:mm:ss}'";
                    } else {
                        format = "{1}";
                    }

                    if (filter.length > 3) {
                        if (filter !== "substringof") {
                            format = "{0}({2}," + format + ")";
                        } else {
                            format = "{0}(" + format + ",{2})";
                        }
                    } else {
                        format = "{2} {0} " + format;
                    }

                    filter = kendo.format(format, filter, value, field);
                }
            }

            result.push(filter);
        }

        filter = result.join(" " + logic + " ");

        if (result.length > 1) {
            filter = "(" + filter + ")";
        }

        return filter;
    }

    extend(true, kendo.data, {
        schemas: {
            odata: {
                type: "json",
                data: "d.results",
                total: "d.__count"
            }
        },
        transports: {
            odata: {
                read: {
                    cache: true, // to prevent jQuery from adding cache buster
                    dataType: "jsonp",
                    jsonp: "$callback"
                },
                parameterMap: function(options, type) {
                    type = type || "read";

                    var params = {
                            $format: "json",
                            $inlinecount: "allpages"
                        },
                        option,
                        dataType = (this.options || defaultDataType)[type].dataType;

                    options = options || {};

                    for (option in options) {
                        if (mappers[option]) {
                            mappers[option](params, options[option]);
                        } else {
                            params[option] = options[option];
                        }
                    }
                    return params;
                }
            }
        }
    });
})(jQuery);
(function($, undefined) {
    var kendo = window.kendo,
        isArray = $.isArray,
        isPlainObject = $.isPlainObject,
        map = $.map,
        each = $.each,
        extend = $.extend,
        getter = kendo.getter,
        Class = kendo.Class;

    var XmlDataReader = Class.extend({ init: function(options) {
            var that = this,
                total = options.total,
                model = options.model,
                data = options.data;

            if (model) {
                if (isPlainObject(model)) {
                    if (model.fields) {
                        each(model.fields, function(field, value) {
                            if (isPlainObject(value) && value.field) {
                                value = extend(value, { field: that.getter(value.field) });
                            } else {
                                value = { field: that.getter(value) };
                            }
                            model.fields[field] = value;
                        });
                    }
                    var id = model.id;
                    if (id) {
                        var idField = {};

                        idField[that.xpathToMember(id, true)] = { field : that.getter(id) };
                        model.fields = extend(model.fields, idField);
                        model.id = that.xpathToMember(id);
                    }
                    model = kendo.data.Model.define(model);
                }

                that.model = model;
            }

            if (total) {
                total = that.getter(total);
                that.total = function(data) {
                    return parseInt(total(data));
                };
            }

            if (data) {
                data = that.xpathToMember(data);
                that.data = function(value) {
                    var record, field, result = that.evaluate(value, data),
                        idField,
                        modelInstance;

                    result = isArray(result) ? result : [result];

                    if (that.model && model.fields) {
                        modelInstance = new that.model();

                        return map(result, function(value) {
                            if (value) {
                                record = {};
                                for (field in model.fields) {
                                    record[field] = modelInstance._parse(field, model.fields[field].field(value));
                                }
                                return record;
                            }
                        });
                    }

                    return result;
                };
            }
        },
        total: function(result) {
            return this.data(result).length;
        },
        parseDOM: function(element) {
            var result = {},
                parsedNode,
                node,
                nodeType,
                nodeName,
                member,
                attribute,
                attributes = element.attributes,
                attributeCount = attributes.length,
                idx;

            for (idx = 0; idx < attributeCount; idx++) {
                attribute = attributes[idx];
                result["@" + attribute.nodeName] = attribute.nodeValue;
            }

            for (node = element.firstChild; node; node = node.nextSibling) {
                nodeType = node.nodeType;

                if (nodeType === 3 || nodeType === 4) {
                    // text nodes or CDATA are stored as #text field
                    result["#text"] = node.nodeValue;
                } else if (nodeType === 1) {
                    // elements are stored as fields
                    parsedNode = this.parseDOM(node);

                    nodeName = node.nodeName;

                    member = result[nodeName];

                    if (isArray(member)) {
                        // elements of same nodeName are stored as array
                        member.push(parsedNode);
                    } else if (member !== undefined) {
                        member = [member, parsedNode];
                    } else {
                        member = parsedNode;
                    }

                    result[nodeName] = member;
                }
            }
            return result;
        },

        evaluate: function(value, expression) {
            var members = expression.split("."),
                member,
                result,
                length,
                intermediateResult,
                idx;

            while (member = members.shift()) {
                value = value[member];

                if (isArray(value)) {
                    result = [];
                    expression = members.join(".");

                    for (idx = 0, length = value.length; idx < length; idx++) {
                        intermediateResult = this.evaluate(value[idx], expression);

                        intermediateResult = isArray(intermediateResult) ? intermediateResult : [intermediateResult];

                        result.push.apply(result, intermediateResult);
                    }

                    return result;
                }
            }

            return value;
        },

        parse: function(xml) {
            var documentElement,
                tree,
                result = {};

            documentElement = xml.documentElement || $.parseXML(xml).documentElement;

            tree = this.parseDOM(documentElement);

            result[documentElement.nodeName] = tree;

            return result;
        },

        xpathToMember: function(member, raw) {
            if (!member) {
                return "";
            }

            member = member.replace(/^\//, "") // remove the first "/"
                           .replace(/\//g, "."); // replace all "/" with "."

            if (member.indexOf("@") >= 0) {
                // replace @attribute with '["@attribute"]'
                return member.replace(/\.?(@.*)/, raw? '$1':'["$1"]');
            }

            if (member.indexOf("text()") >= 0) {
                // replace ".text()" with '["#text"]'
                return member.replace(/(\.?text\(\))/, raw? '#text':'["#text"]');
            }

            return member;
        },
        getter: function(member) {
            return getter(this.xpathToMember(member), true);
        }
    });

    $.extend(true, kendo.data, {
        XmlDataReader: XmlDataReader,
        readers: {
            xml: XmlDataReader
        }
    });
})(jQuery);
(function($, undefined) {
    /**
     * @name kendo.data
     * @namespace
     */

    /**
     * @name kendo.data.DataSource.Description
     *
     * @section
     *  <p>
     *      The DataSource component is an abstraction for using local (arrays of JavaScript objects) or
     *      remote (XML, JSON, JSONP) data. It fully supports CRUD (Create, Read, Update, Destroy) data
     *      operations and provides both local and server-side support for Sorting, Paging, Filtering, Grouping, and Aggregates.
     *  </p>
     *  <p>
     *      It is a powerful piece of the Kendo UI Framework, dramatically simplifying data binding and data operations.
     *  </p>
     *  <h3>Getting Started</h3>
     *
     * @exampleTitle Creating a DataSource bound to local data
     * @example
     * var movies = [ {
     *       title: "Star Wars: A New Hope",
     *       year: 1977
     *    }, {
     *      title: "Star Wars: The Empire Strikes Back",
     *      year: 1980
     *    }, {
     *      title: "Star Wars: Return of the Jedi",
     *      year: 1983
     *    }
     * ];
     * var localDataSource = new kendo.data.DataSource({data: movies});
     * @exampleTitle Creating a DataSource bound to a remote data service (Twitter)
     * @example
     * var dataSource = new kendo.data.DataSource({
     *     transport: {
     *         read: {
     *             // the remote service url
     *             url: "http://search.twitter.com/search.json",
     *
     *             // JSONP is required for cross-domain AJAX
     *             dataType: "jsonp",
     *
     *             // additional parameters sent to the remote service
     *             data: {
     *                 q: "html5"
     *             }
     *         }
     *     },
     *     // describe the result format
     *     schema: {
     *         // the data which the data source will be bound to is in the "results" field
     *         data: "results"
     *     }
     * });
     * @section
     *  <h3>Binding UI widgets to DataSource</h3>
     *  <p>
     *      Many Kendo UI widgets support data binding, and the Kendo UI DataSource is an ideal
     *      binding source for both local and remote data. A DataSource can be created in-line
     *      with other UI widget configuration settings, or a shared DataSource can be created
     *      to enable multiple UI widgets to bind to the same, observable data collection.
     *  </p>
     * @exampleTitle Creating a local DataSource in-line with UI widget configuration
     * @example
     * $("#chart").kendoChart({
     *     title: {
     *         text: "Employee Sales"
     *     },
     *     dataSource: new kendo.data.DataSource({
     *         data: [
     *         {
     *             employee: "Joe Smith",
     *             sales: 2000
     *         },
     *         {
     *             employee: "Jane Smith",
     *             sales: 2250
     *         },
     *         {
     *             employee: "Will Roberts",
     *             sales: 1550
     *         }]
     *     }),
     *     series: [{
     *         type: "line",
     *         field: "sales",
     *         name: "Sales in Units"
     *     }],
     *     categoryAxis: {
     *         field: "employee"
     *     }
     * });
     * @exampleTitle Creating and binding to a sharable remote DataSource
     * @example
     * var sharableDataSource = new kendo.data.DataSource({
     *     transport: {
     *         read: {
     *             url: "data-service.json",
     *             dataType: "json"
     *         }
     *     }
     * });
     *
     * // Bind two UI widgets to same DataSource
     * $("#chart").kendoChart({
     *     title: {
     *         text: "Employee Sales"
     *     },
     *     dataSource: sharableDataSource,
     *     series: [{
     *         field: "sales",
     *         name: "Sales in Units"
     *     }],
     *     categoryAxis: {
     *         field: "employee"
     *     }
     * });
     *
     * $("#grid").kendoGrid({
     *     dataSource: sharableDataSource,
     *         columns: [
     *         {
     *             field: "employee",
     *             title: "Employee"
     *         },
     *         {
     *             field: "sales",
     *             title: "Sales",
     *             template: '#= kendo.toString(sales, "N0") #'
     *     }]
     * });
     */
    var extend = $.extend,
        proxy = $.proxy,
        isFunction = $.isFunction,
        isPlainObject = $.isPlainObject,
        isEmptyObject = $.isEmptyObject,
        isArray = $.isArray,
        grep = $.grep,
        ajax = $.ajax,
        map,
        each = $.each,
        noop = $.noop,
        kendo = window.kendo,
        Observable = kendo.Observable,
        Class = kendo.Class,
        STRING = "string",
        CREATE = "create",
        READ = "read",
        UPDATE = "update",
        DESTROY = "destroy",
        CHANGE = "change",
        GET = "get",
        MULTIPLE = "multiple",
        SINGLE = "single",
        ERROR = "error",
        REQUESTSTART = "requestStart",
        crud = [CREATE, READ, UPDATE, DESTROY],
        identity = function(o) { return o; },
        getter = kendo.getter,
        stringify = kendo.stringify,
        math = Math,
        push = [].push,
        join = [].join,
        pop = [].pop,
        splice = [].splice,
        slice = [].slice,
        unshift = [].unshift,
        toString = {}.toString,
        dateRegExp = /^\/Date\((.*?)\)\/$/,
        quoteRegExp = /(?=['\\])/g;

    function set(object, field, value) {
        return kendo.setter(field)(object, value);
    }

    function get(object, field, call) {
        var result;

        if (field === "this") {
            result = object;
        } else {
            result = kendo.getter(field, true)(object);

            if (call && typeof result === "function") {
                result = result.call(object);
            }
        }

        return result;
    }

    var ObservableArray = Observable.extend({
        init: function(array, type) {
            var that = this,
                member,
                idx;

            type = type || ObservableObject;

            Observable.fn.init.call(that);

            that.length = array.length;

            for (idx = 0; idx < that.length; idx++) {
                member = array[idx];

                if ($.isPlainObject(member)) {
                    member = new type(member);

                    member.bind(CHANGE, function(e) {
                        that.trigger(CHANGE, { field: e.field, items: [this], action: "itemchange" });
                    });
                }

                that[idx] = member;
            }
        },

        push: function() {
            var index = this.length,
                items = arguments,
                result;

            result = push.apply(this, items);

            this.trigger(CHANGE, {
                action: "add",
                index: index,
                items: items
            });

            return result;
        },

        slice: slice,

        join: join,

        pop: pop,

        splice: function(index, howMany, item) {
            var result = splice.apply(this, arguments);

            if (result.length) {
                this.trigger(CHANGE, {
                    action: "remove",
                    index: index,
                    items: result
                });
            }

            if (item) {
                this.trigger(CHANGE, {
                    action: "add",
                    index: index,
                    items: slice.call(arguments, 2)
                });
            }
            return result;
        },

        unshift: function() {
            var index = this.length,
                items = arguments,
                result;

            result = unshift.apply(this, items);

            this.trigger(CHANGE, {
                action: "add",
                index: 0,
                items: items
            });

            return result;
        }
    });

    var ObservableObject = Observable.extend({
        init: function(value) {
            var that = this,
                member,
                field,
                type;

            Observable.fn.init.call(this);

            for (field in value) {
                member = value[field];
                type = toString.call(member);

                if (type === "[object Object]") {
                    member = new ObservableObject(member);

                    (function(field) {
                        member.bind(GET, function(e) {
                            e.field = field + "." + e.field;
                            that.trigger(GET, e);
                        });

                        member.bind(CHANGE, function(e) {
                            e.field = field + "." + e.field;
                            that.trigger(CHANGE, e);
                        });
                    })(field);
                } else if (type === "[object Array]") {
                    member = new ObservableArray(member);

                    (function(field) {
                        member.bind(CHANGE, function(e) {
                            that.trigger(CHANGE, { field: field, index: e.index, items: e.items, action: e.action});
                        });
                    })(field);
                }

                that[field] = member;
            }
        },

        shouldSerialize: function(field) {
            return this.hasOwnProperty(field) && field !== "_events" && typeof this[field] !== "function";
        },

        toJSON: function() {
            var result = {}, field;

            for (field in this) {
                if (this.shouldSerialize(field)) {
                    result[field] = this[field];
                }
            }

            return result;
        },

        get: function(field) {
            this.trigger(GET, { field: field });

            return get(this, field);
        },

        set: function(field, value, initiator) {
            var current = this[field];

            if (current != value) {
                if (!this.trigger("set", { field: field, value: value })) {
                    set(this, field, value);

                    this.trigger(CHANGE, {
                        field: field,
                        initiator: initiator
                    });
                }
            }
        }
    });

    function equal(x, y) {
        if (x === y) {
            return true;
        }

        var xtype = $.type(x), ytype = $.type(y), field;

        if (xtype !== ytype) {
            return false;
        }

        if (xtype === "date") {
            return x.getTime() === y.getTime();
        }

        if (xtype !== "object" && xtype !== "array") {
            return false;
        }

        for (field in x) {
            if (!equal(x[field], y[field])) {
                return false;
            }
        }

        return true;
    }

    var parsers = {
        "number": function(value) {
            return kendo.parseFloat(value);
        },

        "date": function(value) {
            if (typeof value === "string") {
                var date = dateRegExp.exec(value);
                if (date) {
                    return new Date(parseInt(date[1]));
                }
            }
            return kendo.parseDate(value);
        },

        "boolean": function(value) {
            if (typeof value === "string") {
                return value.toLowerCase() === "true";
            }
            return !!value;
        },

        "string": function(value) {
            return value + "";
        },

        "default": function(value) {
            return value;
        }
    };

    var defaultValues = {
        "string": "",
        "number": 0,
        "date": new Date(),
        "boolean": false,
        "default": ""
    }

    var Model = ObservableObject.extend({
        init: function(data) {
            var that = this;

            if (!data || $.isEmptyObject(data)) {
                data = $.extend({}, that.defaults, data);
            }

            ObservableObject.fn.init.call(that, data);

            that.uid = kendo.guid();

            that.dirty = false;

            if (that.idField) {
                that.id = that.get(that.idField);
            }

        },

        shouldSerialize: function(field) {
            return ObservableObject.fn.shouldSerialize.call(this, field)
                && field !== "uid"
                && !(this.idField !== "id" && field === "id")
                && field !== "dirty" && field !== "_accessors";
        },

        _parse: function(field, value) {
            var that = this,
                parse;

            field = (that.fields || {})[field];
            if (field) {
                parse = field.parse;
                if (!parse && field.type) {
                    parse = parsers[field.type.toLowerCase()];
                }
            }

            return parse ? parse(value) : value;
        },

        editable: function(field) {
            field = (this.fields || {})[field];
            return field ? field.editable !== false : true;
        },

        set: function(field, value) {
            var that = this;

            if (that.editable(field)) {
                value = that._parse(field, value);

                if (!equal(value, that.get(field))) {
                    ObservableObject.fn.set.call(that, field, value);
                    that.dirty = true;
                }
            }
        },

        accept: function(data) {
            var that = this;

            extend(that, data);

            if (that.idField) {
                that.id = that.get(that.idField);
            }
            that.dirty = false;
        },

        isNew: function() {
            return this.id === this._defaultId;
        }
    });

    Model.define = function(options) {
        var model,
            proto = extend({}, { defaults: {} }, options),
            id = proto.id;

        if (id) {
            proto.idField = id;
        }

        if (proto.id) {
            delete proto.id;
        }

        proto.defaults[id] = proto._defaultId = "";

        for (var name in proto.fields) {
            var field = proto.fields[name],
                type = field.type || "default",
                value = null;

            name = field.field || name;

            if (!field.nullable) {
                value = proto.defaults[name] = field.defaultValue !== undefined ? field.defaultValue : defaultValues[type.toLowerCase()];
            }

            if (options.id === name) {
                proto._defaultId = value;
            }

            proto.defaults[name] = value;

            field.parse = field.parse || parsers[type];
        }

        model = Model.extend(proto);

        if (proto.fields) {
            model.fields = proto.fields;
            model.idField = proto.idField;
        }

        return model;
    }

    var Comparer = {
        selector: function(field) {
            return isFunction(field) ? field : getter(field);
        },

        asc: function(field) {
            var selector = this.selector(field);
            return function (a, b) {
                a = selector(a);
                b = selector(b);

                return a > b ? 1 : (a < b ? -1 : 0);
            };
        },

        desc: function(field) {
            var selector = this.selector(field);
            return function (a, b) {
                a = selector(a);
                b = selector(b);

                return a < b ? 1 : (a > b ? -1 : 0);
            };
        },

        create: function(descriptor) {
            return Comparer[descriptor.dir.toLowerCase()](descriptor.field);
        },

        combine: function(comparers) {
             return function(a, b) {
                 var result = comparers[0](a, b),
                     idx,
                     length;

                 for (idx = 1, length = comparers.length; idx < length; idx ++) {
                     result = result || comparers[idx](a, b);
                 }

                 return result;
             }
        }
    };

    map = function (array, callback) {
        var idx, length = array.length, result = new Array(length);

        for (idx = 0; idx < length; idx++) {
            result[idx] = callback(array[idx], idx, array);
        }

        return result;
    };

    var operators = (function(){

        function quote(value) {
            return value.replace(quoteRegExp, "\\");
        }

        function operator(op, a, b, ignore) {
            var date;

            if (b != undefined) {
                if (typeof b === STRING) {
                    b = quote(b);
                    date = dateRegExp.exec(b);
                    if (date) {
                        b = new Date(+date[1]);
                    } else if (ignore) {
                        b = "'" + b.toLowerCase() + "'";
                        a = a + ".toLowerCase()";
                    } else {
                        b = "'" + b + "'";
                    }
                }

                if (b.getTime) {
                    //b looks like a Date
                    a = "(" + a + "?" + a + ".getTime():" + a + ")";
                    b = b.getTime();
                }
            }

            return a + " " + op + " " + b;
        }

        return {
            eq: function(a, b, ignore) {
                return operator("==", a, b, ignore);
            },
            neq: function(a, b, ignore) {
                return operator("!=", a, b, ignore);
            },
            gt: function(a, b, ignore) {
                return operator(">", a, b, ignore);
            },
            gte: function(a, b, ignore) {
                return operator(">=", a, b, ignore);
            },
            lt: function(a, b, ignore) {
                return operator("<", a, b, ignore);
            },
            lte: function(a, b, ignore) {
                return operator("<=", a, b, ignore);
            },
            startswith: function(a, b, ignore) {
                if (ignore) {
                    a = a + ".toLowerCase()";
                    if (b) {
                        b = b.toLowerCase();
                    }
                }

                if (b) {
                    b = quote(b);
                }

                return a + ".lastIndexOf('" + b + "', 0) == 0";
            },
            endswith: function(a, b, ignore) {
                if (ignore) {
                    a = a + ".toLowerCase()";
                    if (b) {
                        b = b.toLowerCase();
                    }
                }

                if (b) {
                    b = quote(b);
                }

                return a + ".lastIndexOf('" + b + "') == " + a + ".length - " + (b || "").length;
            },
            contains: function(a, b, ignore) {
                if (ignore) {
                    a = a + ".toLowerCase()";
                    if (b) {
                        b = b.toLowerCase();
                    }
                }

                if (b) {
                    b = quote(b);
                }

                return a + ".indexOf('" + b + "') >= 0"
            }
        };
    })();

    function Query(data) {
        this.data = data || [];
    }

    Query.normalizeFilter = normalizeFilter;

    Query.filterExpr = function(expression) {
        var expressions = [],
            logic = { and: " && ", or: " || " },
            idx,
            length,
            filter,
            expr,
            fieldFunctions = [],
            operatorFunctions = [],
            field,
            operator,
            filters = expression.filters;

        for (idx = 0, length = filters.length; idx < length; idx++) {
            filter = filters[idx];
            field = filter.field;
            operator = filter.operator;

            if (filter.filters) {
                expr = Query.filterExpr(filter);
                //Nested function fields or operators - update their index e.g. __o[0] -> __o[1]
                filter = expr.expression
                             .replace(/__o\[(\d+)\]/g, function(match, index) {
                                index = +index;
                                return "__o[" + (operatorFunctions.length + index) + "]";
                             })
                             .replace(/__f\[(\d+)\]/g, function(match, index) {
                                index = +index;
                                return "__f[" + (fieldFunctions.length + index) + "]";
                             });

                operatorFunctions.push.apply(operatorFunctions, expr.operators);
                fieldFunctions.push.apply(fieldFunctions, expr.fields);
            } else {
                if (typeof field === "function") {
                    expr = "__f[" + fieldFunctions.length +"](d)";
                    fieldFunctions.push(field);
                } else {
                    expr = kendo.expr(field);
                }

                if (typeof operator === "function") {
                    filter = "__o[" + operatorFunctions.length + "](" + expr + ", " + filter.value + ")";
                    operatorFunctions.push(operator);
                } else {
                    filter = operators[(operator || "eq").toLowerCase()](expr, filter.value, filter.ignoreCase !== undefined? filter.ignoreCase : true);
                }
            }

            expressions.push(filter);
        }

        return  { expression: "(" + expressions.join(logic[expression.logic]) + ")", fields: fieldFunctions, operators: operatorFunctions };
    };

    function normalizeSort(field, dir) {
        if (field) {
            var descriptor = typeof field === STRING ? { field: field, dir: dir } : field,
                descriptors = isArray(descriptor) ? descriptor : (descriptor !== undefined ? [descriptor] : []);

            return grep(descriptors, function(d) { return !!d.dir; });
        }
    }

    var operatorMap = {
        "==": "eq",
        equals: "eq",
        isequalto: "eq",
        equalto: "eq",
        equal: "eq",
        "!=": "neq",
        ne: "neq",
        notequals: "neq",
        isnotequalto: "neq",
        notequalto: "neq",
        notequal: "neq",
        "<": "lt",
        islessthan: "lt",
        lessthan: "lt",
        less: "lt",
        "<=": "lte",
        le: "lte",
        islessthanorequalto: "lte",
        lessthanequal: "lte",
        ">": "gt",
        isgreaterthan: "gt",
        greaterthan: "gt",
        greater: "gt",
        ">=": "gte",
        isgreaterthanorequalto: "gte",
        greaterthanequal: "gte",
        ge: "gte"
    };

    function normalizeOperator(expression) {
        var idx,
            length,
            filter,
            operator,
            filters = expression.filters;

        if (filters) {
            for (idx = 0, length = filters.length; idx < length; idx++) {
                filter = filters[idx];
                operator = filter.operator;

                if (operator && typeof operator === STRING) {
                    filter.operator = operatorMap[operator.toLowerCase()] || operator;
                }

                normalizeOperator(filter);
            }
        }
    }

    function normalizeFilter(expression) {
        if (expression && !isEmptyObject(expression)) {
            if (isArray(expression) || !expression.filters) {
                expression = {
                    logic: "and",
                    filters: isArray(expression) ? expression : [expression]
                }
            }

            normalizeOperator(expression);

            return expression;
        }
    }

    function normalizeAggregate(expressions) {
        return expressions = isArray(expressions) ? expressions : [expressions];
    }

    function normalizeGroup(field, dir) {
       var descriptor = typeof field === STRING ? { field: field, dir: dir } : field,
           descriptors = isArray(descriptor) ? descriptor : (descriptor !== undefined ? [descriptor] : []);

        return map(descriptors, function(d) { return { field: d.field, dir: d.dir || "asc", aggregates: d.aggregates }; });
    }

    Query.prototype = {
        toArray: function () {
            return this.data;
        },
        range: function(index, count) {
            return new Query(this.data.slice(index, index + count));
        },
        skip: function (count) {
            return new Query(this.data.slice(count));
        },
        take: function (count) {
            return new Query(this.data.slice(0, count));
        },
        select: function (selector) {
            return new Query(map(this.data, selector));
        },
        orderBy: function (selector) {
            var result = this.data.slice(0),
                comparer = isFunction(selector) || !selector ? Comparer.asc(selector) : selector.compare;

            return new Query(result.sort(comparer));
        },
        orderByDescending: function (selector) {
            return new Query(this.data.slice(0).sort(Comparer.desc(selector)));
        },
        sort: function(field, dir) {
            var idx,
                length,
                descriptors = normalizeSort(field, dir),
                comparers = [];

            if (descriptors.length) {
                for (idx = 0, length = descriptors.length; idx < length; idx++) {
                    comparers.push(Comparer.create(descriptors[idx]));
                }

                return this.orderBy({ compare: Comparer.combine(comparers) });
            }

            return this;
        },

        filter: function(expressions) {
            var idx,
                current,
                length,
                compiled,
                predicate,
                data = this.data,
                fields,
                operators,
                result = [],
                filter;

            expressions = normalizeFilter(expressions);

            if (!expressions || expressions.filters.length === 0) {
                return this;
            }

            compiled = Query.filterExpr(expressions);
            fields = compiled.fields;
            operators = compiled.operators;

            predicate = filter = new Function("d, __f, __o", "return " + compiled.expression);

            if (fields.length || operators.length) {
                filter = function(d) {
                    return predicate(d, fields, operators);
                };
            }

            for (idx = 0, length = data.length; idx < length; idx++) {
                current = data[idx];

                if (filter(current)) {
                    result.push(current);
                }
            }
            return new Query(result);
        },

        group: function(descriptors, allData) {
            descriptors =  normalizeGroup(descriptors || []);
            allData = allData || this.data;

            var that = this,
                result = new Query(that.data),
                descriptor;

            if (descriptors.length > 0) {
                descriptor = descriptors[0];
                result = result.groupBy(descriptor).select(function(group) {
                    var data = new Query(allData).filter([ { field: group.field, operator: "eq", value: group.value } ]);
                    return {
                        field: group.field,
                        value: group.value,
                        items: descriptors.length > 1 ? new Query(group.items).group(descriptors.slice(1), data.toArray()).toArray() : group.items,
                        hasSubgroups: descriptors.length > 1,
                        aggregates: data.aggregate(descriptor.aggregates)
                    }
                });
            }
            return result;
        },
        groupBy: function(descriptor) {
            if (isEmptyObject(descriptor) || !this.data.length) {
                return new Query([]);
            }

            var field = descriptor.field,
                sorted = this.sort(field, descriptor.dir || "asc").toArray(),
                accessor = kendo.accessor(field),
                item,
                groupValue = accessor.get(sorted[0], field),
                group = {
                    field: field,
                    value: groupValue,
                    items: []
                },
                currentValue,
                idx,
                len,
                result = [group];

            for(idx = 0, len = sorted.length; idx < len; idx++) {
                item = sorted[idx];
                currentValue = accessor.get(item, field);
                if(!groupValueComparer(groupValue, currentValue)) {
                    groupValue = currentValue;
                    group = {
                        field: field,
                        value: groupValue,
                        items: []
                    };
                    result.push(group);
                }
                group.items.push(item);
            }
            return new Query(result);
        },
        aggregate: function (aggregates) {
            var idx,
                len,
                result = {};

            if (aggregates && aggregates.length) {
                for(idx = 0, len = this.data.length; idx < len; idx++) {
                   calculateAggregate(result, aggregates, this.data[idx], idx, len);
                }
            }
            return result;
        }
    }

    function groupValueComparer(a, b) {
        if (a && a.getTime && b && b.getTime) {
            return a.getTime() === b.getTime();
        }
        return a === b;
    }

    function calculateAggregate(accumulator, aggregates, item, index, length) {
            aggregates = aggregates || [];
            var idx,
                aggr,
                functionName,
                fieldAccumulator,
                len = aggregates.length;

            for (idx = 0; idx < len; idx++) {
                aggr = aggregates[idx];
                functionName = aggr.aggregate;
                var field = aggr.field;
                accumulator[field] = accumulator[field] || {};
                accumulator[field][functionName] = functions[functionName.toLowerCase()](accumulator[field][functionName], item, kendo.accessor(field), index, length);
            }
        }

    var functions = {
        sum: function(accumulator, item, accessor) {
            return accumulator = (accumulator || 0) + accessor.get(item);
        },
        count: function(accumulator, item, accessor) {
            return (accumulator || 0) + 1;
        },
        average: function(accumulator, item, accessor, index, length) {
            accumulator = (accumulator || 0) + accessor.get(item);
            if(index == length - 1) {
                accumulator = accumulator / length;
            }
            return accumulator;
        },
        max: function(accumulator, item, accessor) {
            var accumulator =  (accumulator || 0),
                value = accessor.get(item);
            if(accumulator < value) {
                accumulator = value;
            }
            return accumulator;
        },
        min: function(accumulator, item, accessor) {
            var value = accessor.get(item),
                accumulator = (accumulator || value)
            if(accumulator > value) {
                accumulator = value;
            }
            return accumulator;
        }
    };

    function toJSON(array) {
        var idx, length = array.length, result = new Array(length);

        for (idx = 0; idx < length; idx++) {
            result[idx] = array[idx].toJSON();
        }

        return result;
    }

    function process(data, options) {
        var query = new Query(data),
            options = options || {},
            group = options.group,
            sort = normalizeGroup(group || []).concat(normalizeSort(options.sort || [])),
            total,
            filter = options.filter,
            skip = options.skip,
            take = options.take;

        if (filter) {
            query = query.filter(filter);
            total = query.toArray().length;
        }

        if (sort) {
            query = query.sort(sort);

            if (group) {
                data = query.toArray();
            }
        }

        if (skip !== undefined && take !== undefined) {
            query = query.range(skip, take);
        }

        if (group) {
            query = query.group(group, data);
        }

        return {
            total: total,
            data: query.toArray()
        };
    }

    function calculateAggregates(data, options) {
        var query = new Query(data),
            options = options || {},
            aggregates = options.aggregate,
            filter = options.filter;

        if(filter) {
            query = query.filter(filter);
        }
        return query.aggregate(aggregates);
    }

    var LocalTransport = Class.extend({
        init: function(options) {
            this.data = options.data;
        },

        read: function(options) {
            options.success(this.data);
        },
        update: function(options) {
            options.success(options.data);
        },
        create: noop,
        destory: noop
    });

    var RemoteTransport = Class.extend( {
        init: function(options) {
            var that = this, parameterMap;

            options = that.options = extend({}, that.options, options);

            each(crud, function(index, type) {
                if (typeof options[type] === STRING) {
                    options[type] = {
                        url: options[type]
                    };
                }
            });

            that.cache = options.cache? Cache.create(options.cache) : {
                find: noop,
                add: noop
            }

            parameterMap = options.parameterMap;

            that.parameterMap = isFunction(parameterMap) ? parameterMap : function(options) {
                var result = {};

                each(options, function(option, value) {
                    if (option in parameterMap) {
                        option = parameterMap[option];
                        if (isPlainObject(option)) {
                            value = option.value(value);
                            option = option.key;
                        }
                    }

                    result[option] = value;
                });

                return result;
            };
        },

        options: {
            parameterMap: identity
        },

        create: function(options) {
            return ajax(this.setup(options, CREATE));
        },

        read: function(options) {
            var that = this,
                success,
                error,
                result,
                cache = that.cache;

            options = that.setup(options, READ);

            success = options.success || noop;
            error = options.error || noop;

            result = cache.find(options.data);

            if(result !== undefined) {
                success(result);
            } else {
                options.success = function(result) {
                    cache.add(options.data, result);

                    success(result);
                };

                $.ajax(options);
            }
        },

        update: function(options) {
            return ajax(this.setup(options, UPDATE));
        },

        destroy: function(options) {
            return ajax(this.setup(options, DESTROY));
        },

        setup: function(options, type) {
            options = options || {};

            var that = this,
                operation = that.options[type],
                data = isFunction(operation.data) ? operation.data() : operation.data;

            options = extend(true, {}, operation, options);
            options.data = that.parameterMap(extend(data, options.data), type);

            return options;
        }
    });

    Cache.create = function(options) {
        var store = {
            "inmemory": function() { return new Cache(); }
        };

        if (isPlainObject(options) && isFunction(options.find)) {
            return options;
        }

        if (options === true) {
            return new Cache();
        }

        return store[options]();
    }

    function Cache() {
        this._store = {};
    }

    Cache.prototype = /** @ignore */ {
        add: function(key, data) {
            if(key !== undefined) {
                this._store[stringify(key)] = data;
            }
        },
        find: function(key) {
            return this._store[stringify(key)];
        },
        clear: function() {
            this._store = {};
        },
        remove: function(key) {
            delete this._store[stringify(key)];
        }
    }

    var DataReader = Class.extend({
        init: function(schema) {
            var that = this, member, get, model;

            schema = schema || {};

            for (member in schema) {
                get = schema[member];

                that[member] = typeof get === STRING ? getter(get) : get;
            }

            if (isPlainObject(that.model)) {
                that.model = model = kendo.data.Model.define(that.model);

                var dataFunction = that.data,
                    getters = {};

                if (model.fields) {
                    each(model.fields, function(field, value) {
                        if (isPlainObject(value) && value.field) {
                            getters[value.field] = getter(value.field);
                        } else {
                            getters[field] = getter(field);
                        }
                    });
                }

                that.data = function(data) {
                    var record,
                        getter,
                        modelInstance = new that.model();

                    data = dataFunction(data);
                    if (!isEmptyObject(getters)) {
                       return map(data, function(value) {
                         record = value;
                         for (getter in getters) {
                             record[getter] = modelInstance._parse(getter, getters[getter](value));
                         }
                         return record;
                       });
                   }
                   return data;
                }
            }
        },
        parse: identity,
        data: identity,
        total: function(data) {
            return data.length;
        },
        groups: identity,
        status: function(data) {
            return data.status;
        },
        aggregates: function() {
            return {};
        }
    });


    var DataSource = Observable.extend(/** @lends kendo.data.DataSource.prototype */ {
        /**
         * @constructs
         * @extends kendo.Observable
         * @param {Object} options Configuration options.
         * @option {Array} [data] The data in the DataSource.
         * @option {Boolean} [serverPaging] <false> Determines if paging of the data should be handled on the server.
         * @option {Boolean} [serverSorting] <false> Determines if sorting of the data should be handled on the server.
         * @option {Boolean} [serverGrouping] <false> Determines if grouping of the data should be handled on the server.
         * @option {Boolean} [serverFiltering] <false> Determines if filtering of the data should be handled on the server.
         * @option {Boolean} [serverAggregates] <false> Determines if aggregates should be calculated on the server.
         * @option {Number} [pageSize] <undefined> Sets the number of records which contains a given page of data.
         * @option {Number} [page] <undefined> Sets the index of the displayed page of data.
         * @option {Array|Object} [sort] <undefined> Sets initial sort order
         * _example
         * // sorts data ascending by orderId field
         * sort: { field: "orderId", dir: "asc" }
         *
         * // sorts data ascending by orderId field and then descending by shipmentDate
         * sort: [ { field: "orderId", dir: "asc" }, { field: "shipmentDate", dir: "desc" } ]
         *
         * @option {Array|Object} [filter] <undefined> Sets initial filter
         * _example
         * // returns only data where orderId is equal to 10248
         * filter: { field: "orderId", operator: "eq", value: 10248 }
         *
         * // returns only data where orderId is equal to 10248 and customerName starts with Paul
         * filter: [ { field: "orderId", operator: "eq", value: 10248 },
         *           { field: "customerName", operator: "startswith", value: "Paul" } ]
         *
         * @option {Array|Object} [group] <undefined> Sets initial grouping
         * _example
         * // groups data by orderId field
         * group: { field: "orderId" }
         *
         * // groups data by orderId and customerName fields
         * group: [ { field: "orderId", dir: "desc" }, { field: "customerName", dir: "asc" } ]
         *
         * @option {Array|Object} [aggregate] <undefined> Sets fields on which initial aggregates should be calculated
         * _example
         * // calculates total sum of unitPrice field's values.
         * [{ field: "unitPrice", aggregate: "sum" }]
         *
         * @option {Object} [transport] Sets the object responsible for loading and saving of data.
         *  This can be a remote or local/in-memory data.
         *
         * @option {Object|String} [transport.read] Options for remote read data operation or the URL of the remote service
         * _example
         * // settings various options for remote data transport
         * var dataSource = new kendo.data.DataSource({
         *     transport: {
         *         read: {
         *             // the remote service URL
         *             url: "http://search.twitter.com/search.json",
         *
         *             // JSONP is required for cross-domain AJAX
         *             dataType: "jsonp",
         *
         *             // additional parameters sent to the remote service
         *             data: {
         *                 q: function() {
         *                     return $("#searchFor").val();
         *                 }
         *             }
         *         }
         *     }
         * });
         *
         *  // consuming odata feed without setting additional options
         *  var dataSource = new kendo.data.DataSource({
         *      type: "odata",
         *      transport: {
         *          read: "http://odata.netflix.com/Catalog/Titles"
         *      }
         *  });
         *
         * @option {String} [transport.read.url] The remote service URL
         * @option {String} [transport.read.dataType] The type of data that you're expecting back from the server
         * @option {Object|Function} [transport.read.data] Additional data to be send to the server
         *
         * @option {Function} [transport.parameterMap] Convert the request parameters from dataSource format to remote service specific format.
         * _example
         *  var dataSource = new kendo.data.DataSource({
         *      transport: {
         *        read: "Catalog/Titles",
         *        parameterMap: function(options) {
         *           return {
         *              pageIndex: options.page,
         *              size: options.pageSize,
         *              orderBy: convertSort(options.sort)
         *           }
         *        }
         *      }
         *  });
         *
         * @option {Object} [schema] Set the object responsible for describing the raw data format
         * _example
         *  var dataSource = new kendo.data.DataSource({
         *      transport: {
         *        read: "Catalog/Titles",
         *      },
         *      schema: {
         *          data: function(data) {
         *              return data.result;
         *          },
         *          total: function(data) {
         *              return data.totalCount;
         *          },
         *          parse: function(data) {
         *              return data;
         *          }
         *      }
         *  });
         * @option {String} [schema.type] Specify the type of schema { xml|json|odata }
         * @option {Function} [schema.parse] Executed before deserialized data is read.
         *  Appropriate for preprocessing of the raw data.
         *
         * @option {Function} [schema.data] Should return the deserialized data.
         * @option {Function} [schema.total] Should return the total number of records.
         * @option {Function} [schema.aggregates] Should return the calculated aggregates.
         * @option {Function} [schema.groups] Used instead of data function if remote grouping operation is executed.
         *  Returns the deserialized data.
         * @option {Object} [schema.model] Describes the Model
         * _example
         *    var dataSource = new kendo.data.DataSource({
         *        //..
         *         schema: {
         *             model: {
         *                 id: "ProductID",
         *                 fields: {
         *                      ProductID: {
         *                         //this field will not be editable (default value is true)
         *                         editable: false,
         *                         // a defaultValue will not be assigned (default value is false)
         *                         nullable: true
         *                      },
         *                      ProductName: {
         *                          validation: { //set validation rules
         *                              required: true
         *                          }
         *                      },
         *                      UnitPrice: {
         *                        //data type of the field {Number|String|Boolean|Date} default is String
         *                        type: "number",
         *                        // used when new model is created
         *                        defaultValue: 42,
         *                        validation: {
         *                            required: true,
         *                            min: 1
         *                        }
         *                    }
         *                }
         *            }
         *        }
         *    })
         * @option {Number|String} [schema.model.id] The field use to identify an unique Model instance
         * @option {Object} [schema.model.fields] Describes the model fields and their properties
         **/
        init: function(options) {
            var that = this, id, model, transport;

            options = that.options = extend({}, that.options, options);

            extend(that, {
                _map: {},
                _prefetch: {},
                _data: [],
                _ranges: [],
                _view: [],
                _pristine: [],
                _destroyed: [],
                _pageSize: options.pageSize,
                _page: options.page  || (options.pageSize ? 1 : undefined),
                _sort: normalizeSort(options.sort),
                _filter: normalizeFilter(options.filter),
                _group: normalizeGroup(options.group),
                _aggregate: options.aggregate
            });

            Observable.fn.init.call(that);

            transport = options.transport;

            if (transport) {
                transport.read = typeof transport.read === STRING ? { url: transport.read } : transport.read;

                if (options.type) {
                    transport = extend(true, {}, kendo.data.transports[options.type], transport);
                    options.schema = extend(true, {}, kendo.data.schemas[options.type], options.schema);
                }

                that.transport = isFunction(transport.read) ? transport: new RemoteTransport(transport);
            } else {
                that.transport = new LocalTransport({ data: options.data });
            }

            that.reader = new kendo.data.readers[options.schema.type || "json" ](options.schema);

            model = that.reader.model || {};

            id = model.id;

            if (id) {
                that.id = function(record) {
                    return id(record);
                };
            }


            that.bind([ /**
                         * Fires when an error occurs during data retrieval.
                         * @name kendo.data.DataSource#error
                         * @event
                         */
                        ERROR,
                        /**
                         * Fires when data is changed
                         * @name kendo.data.DataSource#change
                         * @event
                         */
                        CHANGE,
                        CREATE, DESTROY, UPDATE, REQUESTSTART], options);
        },

        options: {
            data: [],
            schema: {},
            serverSorting: false,
            serverPaging: false,
            serverFiltering: false,
            serverGrouping: false,
            serverAggregates: false,
            sendAllFields: true,
            batch: false
        },

        /**
         * Retrieves a Model instance by given id.
         * @param {Number} id The id of the model to be retrieved
         * @returns {Object} Model instance if found
         */
        get: function(id) {
            var idx, length, data = this._data;

            for (idx = 0, length = data.length; idx < length; idx++) {
                if (data[idx].id == id) {
                    return data[idx];
                }
            }
        },

        getByUid: function(id) {
            var idx, length, data = this._data;

            for (idx = 0, length = data.length; idx < length; idx++) {
                if (data[idx].uid == id) {
                    return data[idx];
                }
            }
        },
        /**
         * Synchronizes changes through the transport.
         */
        sync: function() {
            var that = this,
                idx,
                length,
                created = [],
                updated = [],
                destroyed = that._destroyed,
                data = that._data;

            for (idx = 0, length = data.length; idx < length; idx++) {
                if (data[idx].isNew()) {
                    created.push(data[idx]);
                } else if (data[idx].dirty) {
                    updated.push(data[idx]);
                }
            }

            var promises = that._send("create", created);

            promises.push.apply(promises ,that._send("update", updated));
            promises.push.apply(promises ,that._send("destroy", destroyed));

            $.when.apply(null, promises)
                .then(function() {
                    var idx,
                        length;

                    for (idx = 0, length = arguments.length; idx < length; idx++){
                        that._accept(arguments[idx]);
                    }

                    that._change();
                });

        },

        _accept: function(result) {
            var that = this,
                models = result.models,
                response = result.response || {},
                idx = 0,
                pristine = that.reader.data(that._pristine),
                type = result.type,
                length;

            response = that.reader.data(that.reader.parse(response));

            if (!$.isArray(response)) {
                response = [response];
            }

            if (type === "destroy") {
                that._destroyed = [];
            }

            for (idx = 0, length = models.length; idx < length; idx++) {
                if (type !== "destroy") {
                    models[idx].accept(response[idx]);

                    if (type === "create") {
                        pristine.push(models[idx]);
                    } else if (type === "update") {
                        extend(pristine[that._pristineIndex(models[idx])], response[idx]);
                    }
                } else {
                    pristine.splice(that._pristineIndex(models[idx]), 1);
                }
            }
        },

        _pristineIndex: function(model) {
            var that = this,
                idx,
                length,
                pristine = that.reader.data(that._pristine);

            for (idx = 0, length = pristine.length; idx < length; idx++) {
                if (pristine[idx][model.idField] === model.id) {
                   return idx;
                }
            }
            return -1;
        },

        _promise: function(data, models, type) {
            var that = this,
                transport = that.transport;

            return $.Deferred(function(deferred) {
                transport[type].call(transport, extend({
                        success: function(response) {
                            deferred.resolve({
                                response: response,
                                models: models,
                                type: type
                            });
                        },
                        error: function(response) {
                            deferred.reject(response);
                            that.trigger(ERROR, response);
                        }
                    }, data)
                );
            }).promise();
        },

        _send: function(method, data) {
            var that = this,
                idx,
                length,
                promises = [],
                transport = that.transport;

            if (that.options.batch) {
                if (data.length) {
                    promises.push(that._promise( { data: { models: toJSON(data) } }, data , method));
                }
            } else {
                for (idx = 0, length = data.length; idx < length; idx++) {
                    promises.push(that._promise( { data: data[idx].toJSON() }, [ data[idx] ], method));
                }
            }

            return promises;
        },

        /**
         * Adds a new Model instance to the DataSource
         * @param  {Object} model Either a Model instance or raw object from which the Model will be created
         * @returns {Object} The Model instance which has been added
         */
        add: function(model) {
            return this.insert(this._data.length, model);
        },

        /**
         * Inserts a new Model instance to the DataSource.
         * @param {Number} index Index at which the Model will be inserted
         * @param {Object} model Either a Model instance or raw object from which the Model will be created
         * @returns {Object} The Model instance which has been inserted
         */
        insert: function(index, model) {
            if (!model) {
                model = index;
                index = 0;
            }

            model = model instanceof kendo.data.Model ? model : new this.reader.model(model);

            this._data.splice(index, 0, model);

            return model;
        },

        /**
         * Cancel the changes made to the DataSource after the last sync.
         */
        cancelChanges : function() {
            var that = this;

            that._data = that._observe(that.reader.data(that._pristine));
            that._change();
        },

        /**
         * Populate the DataSource using the assign transport instance.
         */
        read: function(data) {
            var that = this, params = that._params(data);

            that._queueRequest(params, function() {
                that.trigger(REQUESTSTART);
                that._ranges = [];
                that.transport.read({
                    data: params,
                    success: proxy(that.success, that),
                    error: proxy(that.error, that)
                });
            });
        },

        indexOf: function(model) {
            var idx, length, data = this._data;

            for (idx = 0, length = data.length; idx < length; idx++) {
                if (data[idx].id == model.id) {
                    return idx;
                }
            }

            return -1;
        },

        _params: function(data) {
            var that = this;

            return extend({
                take: that.take(),
                skip: that.skip(),
                page: that.page(),
                pageSize: that.pageSize(),
                sort: that._sort,
                filter: that._filter,
                group: that._group,
                aggregate: that._aggregate
            }, data);
        },

        _queueRequest: function(options, callback) {
            var that = this;
            if (!that._requestInProgress) {
                that._requestInProgress = true;
                that._pending = undefined;
                callback();
            } else {
                that._pending = { callback: proxy(callback, that), options: options };
            }
        },

        _dequeueRequest: function() {
            var that = this;
            that._requestInProgress = false;
            if (that._pending) {
                that._queueRequest(that._pending.options, that._pending.callback);
            }
        },

        /**
         * Remove given Model instance from the DataSource.
         * @param {Object} model Model instance to be removed
         */
        remove: function(model) {
            var idx, length, data = this._data;

            for (idx = 0, length = data.length; idx < length; idx++) {
                if (data[idx].uid == model.uid) {
                    model = data[idx];
                    data.splice(idx, 1);
                    return model;
                }
            }
        },

        error: function() {
            this.trigger(ERROR, arguments);
        },

        success: function(data) {
            var that = this,
                options = {},
                result,
                hasGroups = that.options.serverGrouping === true && that._group && that._group.length > 0;

            data = that.reader.parse(data);

            that._pristine = isPlainObject(data) ? $.extend(true, {}, data) : data.slice(0);

            that._total = that.reader.total(data);

            if (that._aggregate && that.options.serverAggregates) {
                that._aggregateResult = that.reader.aggregates(data);
            }

            if (hasGroups) {
                data = that.reader.groups(data);
            } else {
                data = that.reader.data(data);
            }

            that._data = that._observe(data);

            var start = that._skip || 0,
                end = start + that._data.length;

            that._ranges.push({ start: start, end: end, data: that._data });
            that._ranges.sort( function(x, y) { return x.start - y.start; } );

            that._dequeueRequest();
            that._process(that._data);
        },

        _observe: function(data) {
            var that = this;

            data = data instanceof ObservableArray ? data : new ObservableArray(data, that.reader.model);

            return data.bind(CHANGE, proxy(that._change, that));
        },

        _change: function(e) {
            var that = this, idx, length, action = e ? e.action : "";

            if (action === "remove") {
                for (idx = 0, length = e.items.length; idx < length; idx++) {
                    if (!e.items[idx].isNew()) {
                        that._destroyed.push(e.items[idx]);
                    }
                }
            }

            if (that.options.autoSync && (action === "add" || action === "remove" || action === "itemchange")) {
                that.sync();
            } else {
                that._total = that.reader.total(that._pristine);
                that._process(that._data, e);
            }
        },

        _process: function (data, e) {
            var that = this,
                options = {},
                result,
                hasGroups = that.options.serverGrouping === true && that._group && that._group.length > 0;

            if (that.options.serverPaging !== true) {
                options.skip = that._skip;
                options.take = that._take || that._pageSize;

                if(options.skip === undefined && that._page !== undefined && that._pageSize !== undefined) {
                    options.skip = (that._page - 1) * that._pageSize;
                }
            }

            if (that.options.serverSorting !== true) {
                options.sort = that._sort;
            }

            if (that.options.serverFiltering !== true) {
                options.filter = that._filter;
            }

            if (that.options.serverGrouping !== true) {
                options.group = that._group;
            }

            if (that.options.serverAggregates !== true) {
                options.aggregate = that._aggregate;
                that._aggregateResult = calculateAggregates(data, options);
            }

            result = process(data, options);

            that._view = result.data;

            if (result.total !== undefined && !that.options.serverFiltering) {
                that._total = result.total;
            }

            that.trigger(CHANGE, e);
        },

        /**
         * Returns the raw data record at the specified index
         * @param {Number} index The zero-based index of the data record
         * @returns {Object}
         */
        at: function(index) {
            return this._data[index];
        },

        /**
         * Get data return from the transport
         * @returns {Array} Array of items
         */
        data: function(value) {
            var that = this;
            if (value !== undefined) {
                that._data = this._observe(value);

                that._process(that._data);
            } else {
                return that._data;
            }
        },

        /**
         * Returns a view of the data with operation such as in-memory sorting, paring, grouping and filtering are applied.
         * To ensure that data is available this method should be use from within change event of the dataSource.
         * @example
         * dataSource.bind("change", function() {
         *   renderView(dataSource.view());
         * });
         * @returns {Array} Array of items
         */
        view: function() {
            return this._view;
        },

        /**
         * Executes a query over the data. Available operations are paging, sorting, filtering, grouping.
         * If data is not available or remote operations are enabled data is requested through the transport,
         * otherwise operations are executed over the available data.
         * @param {Object} [options] Contains the settings for the operations. Note: If setting for previous operation is omitted, this operation is not applied to the resulting view
         * @example
         *
         * // create a view containing at most 20 records, taken from the
         * // 5th page and sorted ascending by orderId field.
         * dataSource.query({ page: 5, pageSize: 20, sort: { field: "orderId", dir: "asc" } });
         *
         * // moves the view to the first page returning at most 20 records
         * // but without particular ordering.
         * dataSource.query({ page: 1, pageSize: 20 });
         *
         */
        query: function(options) {
            var that = this,
                result,
                remote = that.options.serverSorting || that.options.serverPaging || that.options.serverFiltering || that.options.serverGrouping || that.options.serverAggregates;

            if (options !== undefined) {
                that._pageSize = options.pageSize;
                that._page = options.page;
                that._sort = options.sort;
                that._filter = options.filter;
                that._group = options.group;
                that._aggregate = options.aggregate;
                that._skip = options.skip;
                that._take = options.take;

                if(that._skip === undefined) {
                    that._skip = that.skip();
                    options.skip = that.skip();
                }

                if(that._take === undefined && that._pageSize !== undefined) {
                    that._take = that._pageSize;
                    options.take = that._take;
                }

                if (options.sort) {
                    that._sort = options.sort = normalizeSort(options.sort);
                }

                if (options.filter) {
                    that._filter = options.filter = normalizeFilter(options.filter);
                }

                if (options.group) {
                    that._group = options.group = normalizeGroup(options.group);
                }
                if (options.aggregate) {
                    that._aggregate = options.aggregate = normalizeAggregate(options.aggregate);
                }
            }

            if (remote || (that._data === undefined || that._data.length == 0)) {
                that.read(options);
            } else {
                that.trigger(REQUESTSTART);
                result = process(that._data, options);

                if (!that.options.serverFiltering) {
                    if (result.total !== undefined) {
                        that._total = result.total;
                    } else {
                        that._total = that.reader.total(that._pristine);
                    }
                }

                that._view = result.data;
                that._aggregateResult = calculateAggregates(that._data, options);
                that.trigger(CHANGE);
            }
        },

        /**
         * Fetches data using the current filter/sort/group/paging information.
         * If data is not available or remote operations are enabled data is requested through the transport,
         * otherwise operations are executed over the available data.
         */
        fetch: function(callback) {
            var that = this;

            if (callback && isFunction(callback)) {
                that.one(CHANGE, callback);
            }

            that._query();
        },

        _query: function(options) {
            var that = this;

            that.query(extend({}, {
                page: that.page(),
                pageSize: that.pageSize(),
                sort: that.sort(),
                filter: that.filter(),
                group: that.group(),
                aggregate: that.aggregate()
            }, options));
        },

        /**
         * Get current page index or request a page with specified index.
         * @param {Number} [val] <undefined> The index of the page to be retrieved
         * @example
         * dataSource.page(2);
         * @returns {Number} Current page index
         */
        page: function(val) {
            var that = this,
                skip;

            if(val !== undefined) {
                val = math.max(math.min(math.max(val, 1), that.totalPages()), 1);
                that._query({ page: val });
                return;
            }
            skip = that.skip();

            return skip !== undefined ? math.round((skip || 0) / (that.take() || 1)) + 1 : undefined;
        },

        /**
         * Get current pageSize or request a page with specified number of records.
         * @param {Number} [val] <undefined> The of number of records to be retrieved.
         * @example
         * dataSource.pageSiza(25);
         * @returns {Number} Current page size
         */
        pageSize: function(val) {
            var that = this;

            if(val !== undefined) {
                that._query({ pageSize: val });
                return;
            }

            return that.take();
        },

        /**
         * Get current sort descriptors or sorts the data.
         * @param {Object|Array} [val] <undefined> Sort options to be applied to the data
         * @example
         * dataSource.sort({ field: "orderId", dir: "desc" });
         * dataSource.sort([
         *      { field: "orderId", dir: "desc" },
         *      { field: "unitPrice", dir: "asc" }
         * ]);
         * @returns {Array} Current sort descriptors
         */
        sort: function(val) {
            var that = this;

            if(val !== undefined) {
                that._query({ sort: val });
                return;
            }

            return that._sort;
        },

        /**
         * Get current filters or filter the data.
         *<p>
         * <i>Supported filter operators/aliases are</i>:
         * <ul>
         * <li><strong>Equal To</strong>: "eq", "==", "isequalto", "equals", "equalto", "equal"</li>
         * <li><strong>Not Equal To</strong>: "neq", "!=", "isnotequalto", "notequals", "notequalto", "notequal", "ne"</li>
         * <li><strong>Less Then</strong>: "lt", "<", "islessthan", "lessthan", "less"</li>
         * <li><strong>Less Then or Equal To</strong>: "lte", "<=", "islessthanorequalto", "lessthanequal", "le"</li>
         * <li><strong>Greater Then</strong>: "gt", ">", "isgreaterthan", "greaterthan", "greater"</li>
         * <li><strong>Greater Then or Equal To</strong>: "gte", ">=", "isgreaterthanorequalto", "greaterthanequal", "ge"</li>
         * <li><strong>Starts With</strong>: "startswith"</li>
         * <li><strong>Ends With</strong>: "endswith"</li>
         * <li><strong>Contains</strong>: "contains", "substringof"</li>
         * </ul>
         * </p>
         * @param {Object|Array} [val] <undefined> Filter(s) to be applied to the data.
         * @example
         * dataSource.filter({ field: "orderId", operator: "eq", value: 10428 });
         * dataSource.filter([
         *      { field: "orderId", operator: "neq", value: 42 },
         *      { field: "unitPrice", operator: "ge", value: 3.14 }
         * ]);
         * @returns {Array} Current filter descriptors
         */
        filter: function(val) {
            var that = this;

            if (val === undefined) {
                return that._filter;
            }

            that._query({ filter: val, page: 1 });
        },

        /**
         * Get current group descriptors or group the data.
         * @param {Object|Array} [val] <undefined> Group(s) to be applied to the data.
         * @example
         * dataSource.group({ field: "orderId" });
         * @returns {Array} Current grouping descriptors
         */
        group: function(val) {
            var that = this;

            if(val !== undefined) {
                that._query({ group: val });
                return;
            }

            return that._group;
        },

        /**
         * Get the total number of records
         */
        total: function() {
            return this._total;
        },

        /**
         * Get current aggregate descriptors or applies aggregates to the data.
         * @param {Object|Array} [val] <undefined> Aggregate(s) to be applied to the data.
         * @example
         * dataSource.aggregate({ field: "orderId", aggregate: "sum" });
         * @returns {Array} Current aggregate descriptors
         */
        aggregate: function(val) {
            var that = this;

            if(val !== undefined) {
                that._query({ aggregate: val });
                return;
            }

            return that._aggregate;
        },

        /**
         * Get result of aggregates calculation
         * @returns {Array} Aggregates result
         */
        aggregates: function() {
            return this._aggregateResult;
        },

        /**
         * Get the number of available pages.
         * @returns {Number} Number of available pages.
         */
        totalPages: function() {
            var that = this,
                pageSize = that.pageSize() || that.total();

            return math.ceil((that.total() || 0) / pageSize);
        },

        inRange: function(skip, take) {
            var that = this,
                end = math.min(skip + take, that.total());

            if (!that.options.serverPaging && that.data.length > 0) {
                return true;
            }

            return that._findRange(skip, end).length > 0;
        },

        range: function(skip, take) {
            skip = math.min(skip || 0, this.total());
            var that = this,
                pageSkip = math.max(math.floor(skip / take), 0) * take,
                size = math.min(pageSkip + take, that.total()),
                data;

            data = that._findRange(skip, math.min(skip + take, that.total()));
            if (data.length) {
                that._skip = skip > that.skip() ? math.min(size, (that.totalPages() - 1) * that.take()) : pageSkip;

                that._take = take;

                var paging = that.options.serverPaging;
                var sorting = that.options.serverSorting;
                try {
                    that.options.serverPaging = true;
                    that.options.serverSorting = true;
                    that._process(data);
                } finally {
                    that.options.serverPaging = paging;
                    that.options.serverSorting = sorting;
                }

                return;
            }

            if (take !== undefined) {
                if (!that._rangeExists(pageSkip, size)) {
                    that.prefetch(pageSkip, take, function() {
                        if (skip > pageSkip && size < that.total() && !that._rangeExists(size, math.min(size + take, that.total()))) {
                            that.prefetch(size, take, function() {
                                that.range(skip, take);
                            });
                        } else {
                            that.range(skip, take);
                        }
                    });
                } else if (pageSkip < skip) {
                    that.prefetch(size, take, function() {
                        that.range(skip, take);
                    });
                }
            }
        },

        _findRange: function(start, end) {
            var that = this,
                length,
                ranges = that._ranges,
                range,
                data = [],
                skipIdx,
                takeIdx,
                startIndex,
                endIndex,
                rangeData,
                rangeEnd,
                processed,
                options = that.options,
                remote = options.serverSorting || options.serverPaging || options.serverFiltering || options.serverGrouping || options.serverAggregates;
                length;

            for (skipIdx = 0, length = ranges.length; skipIdx < length; skipIdx++) {
                range = ranges[skipIdx];
                if (start >= range.start && start <= range.end) {
                    var count = 0;

                    for (takeIdx = skipIdx; takeIdx < length; takeIdx++) {
                        range = ranges[takeIdx];

                        if (range.data.length && start + count >= range.start && count + count <= range.end) {
                            rangeData = range.data;
                            rangeEnd = range.end;

                            if (!remote) {
                                processed = process(range.data, { sort: that.sort(), filter: that.filter() });
                                rangeData = processed.data;

                                if (processed.total !== undefined) {
                                    rangeEnd = processed.total;
                                }
                            }

                            startIndex = 0;
                            if (start + count > range.start) {
                                startIndex = (start + count) - range.start;
                            }
                            endIndex = rangeData.length;
                            if (rangeEnd > end) {
                                endIndex = endIndex - (rangeEnd - end);
                            }
                            count += endIndex - startIndex;
                            data = data.concat(rangeData.slice(startIndex, endIndex));

                            if (end <= range.end && count == end - start) {
                                return data;
                            }
                        }
                    }
                    break;
                }
            }
            return [];
        },

        skip: function() {
            var that = this;

            if (that._skip === undefined) {
                return (that._page !== undefined ? (that._page  - 1) * (that.take() || 1) : undefined);
            }
            return that._skip;
        },

        take: function() {
            var that = this;
            return that._take || that._pageSize;
        },

        prefetch: function(skip, take, callback) {
            var that = this,
                size = math.min(skip + take, that.total()),
                range = { start: skip, end: size, data: [] },
                options = {
                    take: take,
                    skip: skip,
                    page: skip / take + 1,
                    pageSize: take,
                    sort: that._sort,
                    filter: that._filter,
                    group: that._group,
                    aggregate: that._aggregate
                };

            if (!that._rangeExists(skip, size)) {
                clearTimeout(that._timeout);

                that._timeout = setTimeout(function() {
                    that._queueRequest(options, function() {
                        that.transport.read({
                            data: options,
                            success: function (data) {
                                that._dequeueRequest();
                                var found = false;
                                for (var i = 0, len = that._ranges.length; i < len; i++) {
                                    if (that._ranges[i].start === skip) {
                                        found = true;
                                        range = that._ranges[i];
                                        break;
                                    }
                                }
                                if (!found) {
                                    that._ranges.push(range);
                                }
                                data = that.reader.parse(data);
                                range.data = that.reader.data(data);
                                range.end = range.start + range.data.length;
                                that._ranges.sort( function(x, y) { return x.start - y.start; } );
                                if (callback) {
                                    callback();
                                }
                            }
                        });
                    });
               }, 100);
            } else if (callback) {
                callback();
            }
        },

        _rangeExists: function(start, end) {
            var that = this,
                ranges = that._ranges,
                idx,
                length;

            for (idx = 0, length = ranges.length; idx < length; idx++) {
                if (ranges[idx].start <= start && ranges[idx].end >= end) {
                    return true;
                }
            }
            return false;
        }
    });

    /** @ignore */
    DataSource.create = function(options) {
        options = options && options.push ? { data: options } : options;

        var dataSource = options || {},
            data = dataSource.data,
            fields = dataSource.fields,
            table = dataSource.table,
            select = dataSource.select,
            idx,
            length,
            model = {},
            field;

        if (!data && fields && !dataSource.transport) {
            if (table) {
                data = inferTable(table, fields);
            } else if (select) {
                data = inferSelect(select, fields);
            }
        }

        if (kendo.data.Model && fields && (!dataSource.schema || !dataSource.schema.model)) {
            for (idx = 0, length = fields.length; idx < length; idx++) {
                field = fields[idx];
                if (field.type) {
                    model[field.field] = field;
                }
            }

            if (!isEmptyObject(model)) {
                dataSource.schema = extend(true, dataSource.schema, { model:  { fields: model } });
            }
        }

        dataSource.data = data;

        return dataSource instanceof DataSource ? dataSource : new DataSource(dataSource);
    }

    function inferSelect(select, fields) {
        var options = $(select)[0].children,
            idx,
            length,
            data = [],
            record,
            firstField = fields[0],
            secondField = fields[1],
            option;

        for (idx = 0, length = options.length; idx < length; idx++) {
            record = {};
            option = options[idx];

            record[firstField.field] = option.text;
            record[secondField.field] = option.value;

            data.push(record);
        }

        return data;
    }

    function inferTable(table, fields) {
        var tbody = $(table)[0].tBodies[0],
        rows = tbody ? tbody.rows : [],
        idx,
        length,
        fieldIndex,
        fieldCount = fields.length,
        data = [],
        cells,
        record,
        cell,
        empty;

        for (idx = 0, length = rows.length; idx < length; idx++) {
            record = {};
            empty = true;
            cells = rows[idx].cells;

            for (fieldIndex = 0; fieldIndex < fieldCount; fieldIndex++) {
                cell = cells[fieldIndex];
                if(cell.nodeName.toLowerCase() !== "th") {
                    empty = false;
                    record[fields[fieldIndex].field] = cell.innerHTML;
                }
            }
            if(!empty) {
                data.push(record);
            }
        }

        return data;
    }

    extend(true, kendo.data, /** @lends kendo.data */ {
        readers: {
            json: DataReader
        },
        Query: Query,
        DataSource: DataSource,
        ObservableObject: ObservableObject,
        ObservableArray: ObservableArray,
        LocalTransport: LocalTransport,
        RemoteTransport: RemoteTransport,
        Cache: Cache,
        DataReader: DataReader,
        Model: Model
    });
})(jQuery);
(function($, undefined) {
    var location            = window.location,
        history             = window.history,
        _checkUrlInterval    = 50,
        hashStrip           = /^#*/,
        documentMode        = window.document.documentMode,
        oldIE               = $.browser.msie && (!documentMode || documentMode <= 8),
        hashChangeSupported = ("onhashchange" in window) && !oldIE,
        document            = window.document;

    var History = kendo.Observable.extend({

        start: function(options) {
            options = options || {};

            var that = this;

            that._pushStateRequested = !!options.pushState;
            that._pushState = that._pushStateRequested && that._pushStateSupported();
            that.root = options.root || "/";
            that._interval = 0;

            this.bind(["change", "ready"], options);
            if (that._normalizeUrl()) {
                return true;
            }

            that.current = that._currentLocation();
            that._listenToLocationChange();
            that.trigger("ready", this.url());
        },

        stop: function() {
            $(window).unbind(".kendo");
            this.unbind("change");
            this.unbind("ready");
            clearInterval(this._interval);
        },

        _normalizeUrl: function() {
            var that = this,
                pushStateUrl,
                atRoot = that.root == location.pathname,
                pushStateUrlNeedsTransform = that._pushStateRequested && !that._pushStateSupported() && !atRoot,
                hashUrlNeedsTransform = that._pushState && atRoot && location.hash;

            if (pushStateUrlNeedsTransform) {
                location.replace(that.root + '#' + that._stripRoot(location.pathname));
                return true;
            } else if (hashUrlNeedsTransform) {
                pushStateUrl = that._makePushStateUrl(location.hash.replace(hashStrip, ''));
                history.replaceState({}, document.title, pushStateUrl);
                return false;
            }
            return false;
        },

        _listenToLocationChange: function() {
            var that = this, _checkUrlProxy = $.proxy(that._checkUrl, that);

            if (this._pushState) {
                $(window).bind("popstate.kendo", _checkUrlProxy);
            } else if (hashChangeSupported) {
                $(window).bind("hashchange.kendo", _checkUrlProxy);
            } else {
                that._interval = setInterval(_checkUrlProxy, _checkUrlInterval);
            }
        },

        _pushStateSupported: function() {
            return window.history && window.history.pushState;
        },

        _checkUrl: function(e) {
            var that = this, current = that._currentLocation();

            if (current != that.current) {
                that.navigate(current);
            }
        },

        _stripRoot: function(url) {
            var that = this;

            if (url.indexOf(that.root) === 0) {
                return ('/' + url.substr(that.root.length)).replace(/\/\//g, '/');
            } else {
                return url;
            }
        },


        _makePushStateUrl: function(address) {
            var that = this;

            if (address.indexOf(that.root) != 0) {
                address = (that.root + address).replace(/\/\//g, '/');
            }

            return location.protocol + '//' + location.host + address;
        },

        _currentLocation: function() {
            var that = this, current;

            if (that._pushState) {
                current = location.pathname;

                if (location.search) {
                    current += location.search;
                }

                return that._stripRoot(current);
            } else {
                return location.hash.replace(hashStrip, '') || '/';
            }
        },

        change: function(callback) {
            this.bind('change', callback);
        },

        navigate: function(to, silent) {
            var that = this;

            if (to === ':back') {
                history.back();
                return;
            }

            to = to.replace(hashStrip, '');

            if (that.current === to || that.current === decodeURIComponent(to)) {
                return;
            }

            if (that._pushState) {
                history.pushState({}, document.title, that._makePushStateUrl(to));
                that.current = to;
            } else {
                location.hash = that.current = to;
            }

            if (!silent) {
                that.trigger("change", that.url());
            }
        },

        url: function() {
            var parts = this.current.split('?'),
                url = {location: parts[0], params: {}, string: this.current},
                paramParts = (parts[1] || "").split(/&|=/),
                length = paramParts.length,
                idx = 0,
                params = {};

            for (; idx < length; idx += 2) {
                url.params[paramParts[idx]] = paramParts[idx + 1];
            }

            return url;
        }
    });

    kendo.history = new History();
})(jQuery);
(function($, undefined) {
    var kendo = window.kendo,
        ui = kendo.ui,
        support = kendo.support,
        extend = $.extend,
        proxy = $.proxy,
        Observable = kendo.Observable,
        mobile;

    var Widget = ui.Widget.extend(/** @lends kendo.mobile.ui.Widget.prototype */{
        /**
         * Initializes mobile widget. Sets `element` and `options` properties.
         * @constructs
         * @class Represents a mobile UI widget. Base class for all Kendo mobile widgets.
         * @extends kendo.ui.Widget
         */
        init: function(element, options) {
            var that = this,
                option,
                value;

            ui.Widget.fn.init.call(that, element, options);

            for (option in that.options) {
                value = that.element.data(kendo.ns + option);

                if (value !== undefined) {
                    that.options[option] = value;
                }
            }
        },

        options: {},

        viewShow: $.noop,

        enhance: function(element) {
            var options = this.options,
                pluginMethod = "kendoMobile" + options.name,
                selector = kendo.roleSelector(options.name.toLowerCase());

                element.find(selector)
                       .add(element.filter(selector))
                       .attr("data-" + kendo.ns + "widget", options.name)[pluginMethod]();
        }
    });

    // Mobile Swipe
    var SwipeAxis = kendo.Class.extend({
        init: function(horizontal) {
            var that = this;

            if (horizontal) {
                that.size = "width";
                that.axis = "x";
            } else {
                that.size = "height";
                that.axis = "y";
            }
        },

        start: function(location) {
            var that = this;
            that.location = location;
        },

        move: function(location) {
            var that = this,
                direction;

            that.delta = location - that.location;
            direction = that.delta > 0;

            if (that.direction != direction) {
                that._resetDirection();
                that.direction = direction;
            }

            that.location = location;
        },

        end: function(location) {
            var that = this,
                timePassed = (+new Date()) -that.startTime;

            // console.log(location + "-" + that.startLocation + "/" + timePassed);

            that.velocity = (location - that.startLocation) / timePassed;
            that.move(location);
            delete that.direction;
        },

        _resetDirection: function() {
            var that = this;
            that.startTime = +new Date();
            that.startLocation = that.location;
        }
    });

    var START = "start",
        MOVE = "move",
        END = "end";

    var Swipe = Observable.extend({
        init: function(element, options) {
            var that = this,
                options = options || {};

            that.x = new SwipeAxis(true);
            that.y = new SwipeAxis(false);

            Observable.fn.init.call(that);
            element.bind("mousedown", proxy(that._mouseDown, that));
            element.bind("mousemove", proxy(that._mouseMove, that));
            element.bind("mouseup mouseleave", proxy(that._mouseUp, that));
            element.bind("touchstart", proxy(that._touchStart, that));
            element.bind("touchmove", proxy(that._touchMove, that));
            element.bind("touchend", proxy(that._touchEnd, that));

            that.bind([START, MOVE, END], options);
        },

        _mouseDown: function(e) {
            var that = this;

            if (!that.pressed) {
                e.preventDefault();
                that.pressed = true;
                that._perAxis(START, e);
            }
        },

        _touchStart: function(e) {
            var that = this;

            if (!that.pressed) {
                var originalEvent = e.originalEvent;
                touch = originalEvent.changedTouches[0];
                that.touchID = touch.identifier;
                that.pressed = true;
                that._perAxis(START, touch);
            }
        },

        _touchMove: function(e) {
            var that = this;

            if (that.pressed) {
                that._withTouchEvent(e, function(touch) {
                    e.preventDefault();
                    that._perAxis(MOVE, touch);
                });
            }
        },

        _touchEnd: function(e) {
            var that = this;

            that._withTouchEvent(e, function(touch) {
                that._mouseUp(touch);
            });
        },

        _mouseMove: function(e) {
            var that = this;

            if (that.pressed) {
                e.preventDefault(e);
                that._perAxis(MOVE, e);
            }
        },

        _mouseUp: function(e) {
            var that = this;
            if (that.pressed) {
                that.pressed = false;
                that._perAxis(END, e);
            }
        },

        _perAxis: function(method, e) {
            var that = this;

            that.x[method](e.pageX);
            that.y[method](e.pageY);
            that.trigger(method, that);
        },

        _withTouchEvent: function(e, callback) {
            var that = this,
            touches = e.originalEvent.changedTouches,
            idx = touches.length;

            while (idx) {
                idx --;
                if (touches[idx].identifier === that.touchID) {
                    return callback(touches[idx]);
                }
            }
        }
    });

    var TRANSFORM_STYLE = kendo.support.transitions.prefix + "Transform";
    var Move = kendo.Class.extend({
        init: function(element) {
            var that = this;
            that.element = $(element);
            that.domElement = that.element[0];
            that.x = 0;
            that.y = 0;
        },

        moveBy: function(x, y) {
            var that = this;
            if (x) { that.x += x; }
            if (y) { that.y += y; }
            that._redraw();
        },

        moveTo: function(x, y) {
            var that = this;
            that.x = x;
            that.y = y;
            that._redraw();
        },

        _redraw: function() {
            var that = this, translate;
            if (support.hasHW3D) {
                translate = "translate3d(" + that.x + "px," + that.y +"px,0)";
            } else {
                translate = "translate(" + that.x + "px," + that.y +"px)";
            }
            that.domElement.style[TRANSFORM_STYLE] = translate;
        }
    });

    var Draggable = kendo.Class.extend({
        init: function(options) {
            var that = this;

            that.options = options;

            options.swipe.bind("move", proxy(that._move, that));
        },

        _move: function(e) {
            var that = this,
                options = that.options,
                move = options.move,
                deltaX = options.ignoreX ? 0 : e.x.delta,
                deltaY = options.ignoreY ? 0 : e.y.delta,
                x = move.x + deltaX,
                y = move.y + deltaY;

            if (x > 0 || x < options.minX) { deltaX *= 0.5; }
            if (y > 0 || y < options.minY) { deltaY *= 0.5; }
            move.moveBy(deltaX, deltaY);
        }
    });

    /**
     * @name kendo.mobile
     * @namespace This object contains all code introduced by the Kendo mobile suite, plus helper functions that are used across all mobile widgets.
     */
    extend(kendo.mobile, {
        enhance: function(element) {
            var widget, prototype, ui = kendo.mobile.ui;

            element = $(element);

            for (widget in ui) {
                widget = ui[widget];
                prototype = widget.prototype;

                if (prototype.enhance && prototype.options.name) {
                    prototype.enhance(element);
                }
            }
        },

        /**
         * @name kendo.mobile.ui
         * @namespace Contains all classes for the Kendo Mobile UI widgets.
         */
        ui: {
            plugin: function(widget) {
                kendo.ui.plugin(widget, kendo.mobile.ui, "Mobile");
            },

            Widget: Widget,
        },

        Swipe: Swipe,
        Move: Move,
        Draggable: Draggable
    });
})(jQuery);
(function($, undefined) {
    var kendo = window.kendo,
        mobile = kendo.mobile,
        os = kendo.support.mobileOS,
        attr = kendo.attr,
        Class = kendo.Class,
        roleSelector = kendo.roleSelector;

    // TODO: refactor this to a singleton
    function hideAddressBarOnBack() {
        if (os.android) {
            window.scrollBy(0,56);
        }
    }

    var View = Class.extend({
        init: function(element, options) {
            var that = this,
                initCallback = element.data(kendo.ns + "init"),
                contentSelector = roleSelector("content");

            that.layout = options.layout;
            that.element = element.data("kendoView", that).addClass("km-view");

            that.header = element.find(roleSelector("header")).addClass("km-header");
            that.footer = element.find(roleSelector("footer")).addClass("km-footer");
            if (!element.has(contentSelector)[0]) {
              element.wrapInner("<div " + attr("role") + '="content"></div>');
            }

            that.content = element.find(roleSelector("content"))
                                .addClass("km-content")
                                .kendoMobileScroller({useOnDesktop: true});

            that.title = element.data(kendo.ns + "title");

            that.element.prepend(that.header).append(that.footer);
            if (that.layout) {
                that.layout.setup(that);
            }

            kendo.mobile.enhance(element);

            if (initCallback) {
                window[initCallback].call(this);
            }
        },

        onHideStart: function() {
            var that = this;
            if (that.layout) {
                that.layout.detach(that);
            }
        },

        onShowStart: function () {
            var that = this;
            that.element.css("display", "");

            if (that.layout) {
                that.layout.attach(that);
            }

            that.element.find("[data-" + kendo.ns + "widget]").each(function(){
                $(this).data("kendoWidget").viewShow(that);
            });
        }
    });

    var ViewSwitcher = Class.extend({
        init: function (application) {
            this.application = application;
        },

        replace: function(previous, view) {
            var that = this,
                callback = function() { previous.element.hide(); },
                animationType;

            that.back = view.nextView === previous && JSON.stringify(view.params) === JSON.stringify(kendo.history.url().params);

            animationType = that.application.dataOrDefault((that.back ? previous : view).element, "transition");

            that.parallax = animationType === "slide";

            previous.onHideStart();
            view.onShowStart();

            if (that.back && !that.parallax) {
                view.element.css("z-index", 0);
                  previous.element.css("z-index", 1);
              } else {
            view.element.css("z-index", 1);
                previous.element.css("z-index", 0);
            }

            if (that.back) {
                hideAddressBarOnBack();
            }

            that.switchWith(previous.footer, view.footer);
            that.switchWith(previous.header, view.header);
            that.contents(previous, view).kendoAnimateTo(that.contents(view, previous), {effects: animationType, reverse: that.back, complete: callback});

            if (!that.back) {
                previous.nextView = view;
            }
        },

        contents: function(source, destination) {
            var contents;

            if (this.parallax) {
                contents = source.content;
                if (!destination.header[0]) {
                    contents = contents.add(source.header);
                }

                if (!destination.footer[0]) {
                    contents = contents.add(source.footer);
                }
            } else {
                contents = source.element;
            }

            return contents;
        },

        switchWith: function(source, destination) {
            if (source[0] && destination[0] && source[0] != destination[0] && this.parallax) {
                source.kendoAnimateTo(destination, {effects: "fade"});
            }
        }
    });

    var Layout = Class.extend({
        init: function(element) {
            var that = this;
            that.header = element.find(roleSelector("header")).addClass("km-header");
            that.footer = element.find(roleSelector("footer")).addClass("km-footer");
            that.elements = that.header.add(that.footer);
            kendo.mobile.enhance(element);
            element.detach();
        },

        setup: function (view) {
            if (!view.header[0]) { view.header = this.header; }
            if (!view.footer[0]) { view.footer = this.footer; }
        },

        detach: function (view) {
            var that = this;
            if (view.header === that.header) {
                view.element.prepend(that.header.detach().clone(true));
            }

            if (view.footer === that.footer) {
                view.element.append(that.footer.detach().clone(true));
            }
        },

        attach: function(view) {
            var that = this;
            if (view.header === that.header) {
                that.header.detach();
                view.element.find(roleSelector("header")).remove();
                view.element.prepend(that.header);
            }

            if (view.footer === that.footer) {
                that.footer.detach();
                view.element.find(roleSelector("footer")).remove();
                view.element.append(that.footer);
            }
        }
    });

    mobile.Layout = Layout;
    mobile.View = View;
    mobile.ViewSwitcher = ViewSwitcher;
})(jQuery);
(function($, undefined) {
    var kendo = window.kendo,
        mobile = kendo.mobile,
        history = kendo.history,
        support = kendo.support,
        attr = kendo.attr,
        os = support.mobileOS,
        div = $("<div/>"),
        meta = '<meta name="apple-mobile-web-app-capable" content="yes" /> \
                <meta name="apple-mobile-web-app-status-bar-style" content="black" /> \
                <meta content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no, width=device-width" name="viewport" />',
        iconMeta = kendo.template('<link rel="apple-touch-icon" href="${icon}" />'),
        buttonRolesSelector = toRoleSelector("button listview-link"),
        linkRolesSelector = toRoleSelector("tab"),
        initialHeight = {},
        TRANSFORM = support.transitions.css + "transform",
        ORIENTATIONEVENT = "onorientationchange" in window ? "orientationchange" : "resize",
        View = mobile.View,
        ViewSwitcher = mobile.ViewSwitcher,
        Layout = mobile.Layout,
        VIEW_INIT = "viewInit",
        VIEW_SHOW = "viewShow",
        lastOrientation = -1,
        roleSelector = kendo.roleSelector;

    function toRoleSelector(string) {
        return string.replace(/(\S+)/g, "[" + attr("role") + "*=$1],")
    }

    function toDom(html) {
        if (/<body[^>]*>(([\u000a\u000d\u2028\u2029]|.)*)<\/body>/i.test(html)) {
            html = RegExp.$1;
        }
        div[0].innerHTML = html;
        return div;
    }

    function hideBar(element) {
        var compensation = 0, newHeight,
            orientation = window.orientation + "";

        if (lastOrientation != orientation) {
            element = $(this);

            if (!initialHeight[orientation])
                initialHeight[orientation] = $(window).height();

            if (os.device == "iphone" || os.device == "ipod" || os.android) {
                if (os.android) {
                    compensation = 56;
                } else {
                    compensation = 60;
                }

                newHeight = initialHeight[orientation] + compensation;
                if (newHeight != element.height()) {
                    element.height(newHeight);

                    setTimeout(function () {
                        window.scrollTo(0, 1);
                    }, 0);
                }
            }

            lastOrientation = orientation;
        }
    }

    function hideAddressBar(element) {
        if (os.appMode) {
            return;
        }

        if (os.android) {
            $(window).scroll(function() {
                element.height(window.innerHeight);
            });
        }

        $(window).load($.proxy(hideBar, element));
        $(window).bind(ORIENTATIONEVENT, $.proxy(hideBar, element));
    }

    function isInternal(link) {
        return link.data(kendo.ns + "rel") != "external";
    }

    function appLinkMouseUp(e) {
        var link = $(e.currentTarget),
            href = link.attr("href");

        if (!e.isDefaultPrevented() && isInternal(link)) {
            // Prevent iOS address bar progress display for in app navigation
            if (href) {
                link.attr("href", "#!");
                setTimeout(function() { link.attr("href", href) });
                history.navigate(href);
            }

            e.preventDefault();
        }
    }

    function appLinkClick(e) {
        if(isInternal($(e.currentTarget))) {
            e.preventDefault();
        }
    }

    function getOrientationClass() {
        return Math.abs(window.orientation) / 90 ? "km-horizontal" : "km-vertical";
    }

    /**
     * @name kendo.mobile.Application.Description
     * @section
     *
     * <p>The Kendo mobile <strong>Application</strong> provides the necessary tools for building native-looking web based mobile applications.</p>
     *
     * <h3>Getting Started</h3>
     * <p>The simplest mobile <strong>Application</strong> consists of a single mobile <strong>View</strong>. </p>
     *
     * @exampleTitle Hello World mobile Application
     * @example
     * <body>
     *    <div data-role="view">
     *      <div data-role="header">Header</div>
     *      Hello world!
     *      <div data-role="footer">Footer</div>
     *    </div>
     *
     *    <script>
     *    var app = new kendo.mobile.Application(); //document.body is used by default
     *    </script>
     * </body>
     *
     * @section
     * <h3>View Structure</h3>
     *
     * <p>The mobile <strong>Application</strong> consists of a single HTML page with one or more mobile Views, linked with navigational widgets (Buttons, TabStrip, etc.).
     * A mobile <strong>View</strong> is considered each child of the application element (<code>&lt;body&gt;</code> by default) that is decorated with <code>data-role="view"</code>.
     *
     * @exampleTitle Define mobile View
     * @example
     * <div data-role="view">Foo</div>
     *
     * @section
     * <h3>Headers and Footers</h3>
     * <p>By default, the mobile <strong>View</strong> contents stretch to fit the application element. The mobile <strong>View</strong> can also have a header and a footer.
     * In order to mark header and footer elements, add elements with attribute <code>data-role="header"</code> and <code>data-role="footer"</code>. </p>
     *
     * @exampleTitle Mobile View with Header and Footer
     * @example
     * <div data-role="view">
     *   <div data-role="header">Header</div>
     *   Hello world!
     *   <div data-role="footer">Footer</div>
     * </div>
     *
     * @section
     * <strong>Important:</strong>
     * <p>Because of the OS UI design conventions, the header and the footer switch positions when an Android device is detected. Usually the footer hosts a MobileTabstrip widget, which is located at the bottom of the screen on iOS, and at the top of the screen in Android applications.  </p>
     *
     * @section
     * <h3>Layout</h3>
     * <p>A mobile <strong>Layout</strong> is used to share headers and footers between multiple <strong>Views</strong>. The header and/or footer element of the <strong>Layout</strong> are applied to any <strong>View</strong> that uses it.
     * To define a <strong>Layout</strong> set <code>data-role="layout"</code> to an element. To associate a <strong>View</strong> to a <strong>Layout</strong> set <code>data-layout</code> attribute.
     * A <strong>View</strong> is associated with a <strong>Layout</strong> by setting its <code>data-layout</code> attribute value
     * to the value of the layout's <code>data-id</code> attribute:</p>
     *
     * @exampleTitle Views with Layout
     * @example
     * <div data-role="view" data-layout="foo">Foo</div>
     * <div data-role="view" data-layout="foo">Bar</div>
     *
     * <div data-role="layout" data-id="foo">
     *   <div data-role="header">Header</div>
     *   <div data-role="footer">Footer</div>
     * </div>
     *
     * @section
     * <p>A default <strong>Application</strong> layout can be set by passing the layout id in the <code>options</code> parameter of the <strong>Application</strong>'s constructor.
     * A mobile <strong>View</strong> can remove the default application <strong>Layout</strong> by setting <code>data-layout=""</code>.</p>
     *
     * @exampleTitle Default Application Layout
     * @example
     * <div data-role="view">Bar</div>
     *
     * <div data-role="layout" data-id="foo">
     *   <div data-role="header">Header</div>
     * </div>
     *
     * <script>
     *      new kendo.mobile.Application($(document.body), { layout: "foo" });
     * </script>
     *
     * @section
     *
     * <h3>Navigation</h3>
     * <p>When initialized, the mobile <strong>Application</strong> modifies the kendo mobile widgets' behavior so that they navigate between <strong>Views</strong> when pressed.
     * The navigation <strong>Widget</strong>'s <code>href</code> attribute specifies the <strong>View</strong> id to navigate to.</p>
     *
     * @exampleTitle Views linked with mobile Buttons
     * @example
     * <div data-role="view" id="foo">Foo <a href="#bar" data-role="button">Go to Bar</a></div>
     * <div data-role="view" id="bar">Bar <a href="#foo" data-role="button">Go to Foo</a></div>
     *
     * @section
     *
     * <h3>View Transitions</h3>
     * <p><strong>View</strong> transitions are defined by setting a <code>data-transition</code> attribute to the <strong>View</strong> DOM element.
     * A default <strong>View</strong> transition may be set using the <code>transition</code> parameter in the options parameter of the <strong>Application</strong> constructor.
     * The following transitions are supported:</p>
     *
     * <h4>slide</h4>
     * <p> This is the default iOS <strong>View</strong> transition. Old <strong>View</strong> content slides to the left and the new <strong>View</strong> content slides in its place.
     * Headers and footers (if present) use the <strong>fade</strong> transition. </p>
     *
     * <h4>zoom</h4>
     * <p>The new <strong>View</strong> (along with its header and footer) content zooms over the previous <strong>View</strong>. The old <strong>View</strong> content fades out. Suitable for displaying dialogs.</p>
     *
     * <h4>fade</h4>
     * <p>The new <strong>View</strong> (along with its header and footer) content fades from the center of the screen, on top of the previous <strong>View</strong> content.</p>
     *
     * <h4>overlay</h4>
     * <p>The new <strong>View</strong> content slides on top of the previous <strong>View</strong>. Unlike the <code>slide</code> transition,
     * the previous <strong>View</strong> stays "under" the new one, and the headers / footers do not transition separately. </p>
     * <p>The transition direction can be specified by using <code>overlay:(direction)</code>.
     * Supported directions are <code>down</code>, <code>left</code>, <code>up</code> and <code>right</code>. By default, the direction is <code>left</code>.</p>
     *
     * @exampleTitle Views with Transitions
     * @example
     * <div data-role="view" id="foo" data-transition="slide">Foo <a href="#bar" data-role="button">Go to Bar</a></div>
     * <div data-role="view" id="bar" data-transition="overlay:up">Bar <a href="#foo" data-role="button">Go to Foo</a></div>
     *
     * @section
     *
     * <p>When a <strong>View</strong> transitions to the <strong>View</strong> displayed before it (foo → bar → foo), this is considered a <strong>back</strong> navigation.
     * In this case, the animation of the current <strong>View</strong> is applied in reverse.
     * For instance, navigating with slide animation from <code>foo</code> to <code>bar</code>, then back to <code>foo</code>
     * would cause the <code>foo</code> <strong>View</strong> to slide from the right side of the screen. </p>
     *
     * @section
     *
     * <h3>Remote Views</h3>
     *
     * <p>The Kendo mobile <strong>Application</strong> can load <strong>Views</strong> remotely by using AJAX. If the navigational widget URL does not start with a hash (#),
     * the application considers the <strong>View</strong> to be remote, and issues an AJAX request to the provided URL.
     * The <strong>View</strong> content (the first element with <code>data-role="view"</code>) are extracted from the AJAX response and appended into the <strong>Application</strong> element.
     * Once the remote <strong>View</strong> is fetched, no additional roundtrips to the server occur when the <strong>View</strong> is displayed. </p>
     *
     * @exampleTitle Remote View
     * @example
     * <!-- foo.html -->
     * <div data-role="view">Foo <a href="bar.html" data-role="button">Go to Bar</a></div>
     *
     * <!-- bar.html -->
     * <div data-role="view">Bar</div>
     *
     * @section
     *
     * <h3>View Parameters</h3>
     *
     * <p>Navigational widgets can pass additional URL parameters when navigating to <strong>Views</strong>. The parameters will be available in the <code>viewShow</code> <strong>Application</strong> event.</p>
     *
     * @exampleTitle Button with additional URL parameters
     * @example
     * <a data-role="button" href="#foo?bar=baz">Link to FOO <strong>View</strong> with bar parameter set to baz</a>
     */
    var Application = kendo.Observable.extend(/** @lends kendo.mobile.Application.prototype */{
        /**
         * @constructs
         * @extends kendo.Observable
         * @param {DomElement} element DOM element.
         * @param {Object} options Configuration options.
         * @option {String} [layout] <> The id of the default Application layout.
         * _example
         * <div data-role="view">Bar</div>
         *
         * <div data-role="layout" data-id="foo">
         *   <div data-role="header">Header</div>
         * </div>
         *
         * <script>
         *      new kendo.mobile.Application($(document.body), { layout: "foo" });
         * </script>
         * @option {String} [transition] <> The default View transition.
         * _example
         * <script>
         *      new kendo.mobile.Application($(document.body), { transition: "slide" });
         * </script>
         */
        init: function(element, options) {
            var that = this;

            that.options = options || {};
            that.layouts = {};
            kendo.Observable.fn.init.call(that, that.options);
            that.element = element ? $(element) : $(document.body);

            that.bind([
            /**
             * Fires the first time when a View is displayed.
             * @name kendo.mobile.Application#viewInit
             * @event
             * @param {Event} e
             * @param {kendo.mobile.View} e.view The displayed View.
             */
              VIEW_INIT,
            /**
             * Fires when a View is displayed.
             * @name kendo.mobile.Application#viewShow
             * @event
             * @param {Event} e
             * @param {kendo.mobile.View} e.view The displayed View.
             * @param {Object} e.params The URL params passed.
             *
             * @exampleTitle Display View with URL parameters
             * @example
             * <div id="foo" data-role="view"><a href="#bar?baz=qux">Go to bar</a></div>
             * <div id="bar" data-role="view">Bar</div>
             *
             * <script>
             *      // ...
             *      application.bind("viewShow", function(e) {
             *          console.log(e.view); // kendo.mobile.View instance
             *          console.log(e.params); // {"baz": "qux"}
             *      });
             * </script>
             */
              VIEW_SHOW
            ], that.options);

            $(function(){
                hideAddressBar(that.element);
                that._attachOrientationChange();
                that._attachMeta();
                that._setupAppLinks();
                that._setupLayouts(that.element);
                that._startHistory();
            });
        },

        navigate: function(url) {
            var that = this;

            that._findView(url, function(view) {
                history.navigate(url, true);

                that.trigger("viewHide", { view: that.view });

                new ViewSwitcher(that).replace(that.view, view);
                that._setCurrentView(view);
            });
        },

        scroller: function() {
            return this.view.content.data("kendoScroller");
        },

        _setupAppLinks: function() {
            this.element
                .delegate(linkRolesSelector, support.mousedown, appLinkMouseUp)
                .delegate(buttonRolesSelector, support.mouseup, appLinkMouseUp)
                .delegate(linkRolesSelector + buttonRolesSelector, "click", appLinkClick);
        },

        _setupLayouts: function(element) {
            var that = this;
            element.find(kendo.roleSelector("layout")).each(function() {
                var layout = $(this);
                that.layouts[layout.data("id")] = new Layout(layout);
            });
        },

        _startHistory: function() {
            var that = this, views, historyEvents;

            views = that.element.find(roleSelector("view"));
            views.first().attr(attr("url"), "/");

            historyEvents = {
                change: function(e) {
                    that.navigate(e.string);
                },

                ready: function(e) {
                    that._findView(e.string, function(view) {
                        views.not(view.element).hide();
                        view.onShowStart();
                        that._setCurrentView(view);
                    });
                }
            };

            history.start($.extend(that.options, historyEvents));
        },

        _setCurrentView: function(view) {
            var that = this, params = history.url().params;
            that.view = view;
            view.params = params;
            that.trigger(VIEW_SHOW, {view: view, params: params});
        },

        _createView: function(element) {
            var that = this,
                layout = that.dataOrDefault(element, "layout");

            if (layout) {
                layout = that.layouts[layout];
            }

            var view = new View(element, {layout: layout});

            that.trigger(VIEW_INIT, {view: view});

            return view;
        },

        _createRemoteView: function(url, html) {
            var that = this,
                dom = $(toDom(html)),
                views = dom.find(roleSelector("view")).hide(),
                layouts = dom.find(roleSelector("layout")),
                scriptsAndStyles = dom.find("script, style"),
                element = views.first(),
                view;

            element.hide().attr(attr("url"), url);

            that._setupLayouts(dom);
            that.element.append(layouts);
            that.element.append(scriptsAndStyles);
            that.element.append(views);

            view = that._createView(element);
            return view;
        },

        _findView: function(url, callback) {
            var that = this,
                view,
                firstChar = url.charAt(0),
                local = firstChar === "#",
                remote = firstChar === "/",
                element;

            element = that.element.find("[" + attr("url") + "='" + url + "']");

            if (!element[0] && !remote) {
                element = that.element.find(local ? url : "#" + url);
            }

            view = element.data("kendoView");

            if (view) {
                callback(view);
            } else if (element[0]) {
                callback(that._createView(element));
            } else {
                $.get(url, function(html) {
                    callback(that._createRemoteView(url, html));
                });
            }
        },

        _attachOrientationChange: function() {
            var that = this, element = that.element;
            element.parent().addClass("km-root");
            element.addClass("km-" + (!os ? "ios" : os.name) + " " + getOrientationClass());

            $(window).bind(ORIENTATIONEVENT, function(e) {
                element.removeClass("km-horizontal km-vertical")
                    .addClass(getOrientationClass());

                // Reset the visible scrollbar,
                // TODO: make a scrollIntoView scroller method.
                $(".km-scroll-container:visible").css(TRANSFORM, "none");
            });
        },

        _attachMeta: function() {
            var icon = this.options.icon;

            $("head").prepend(meta);

            if (icon) {
                $("head").prepend(iconMeta({icon: icon}));
            }
        },

        dataOrDefault: function(element, option) {
            return typeof element.data(kendo.ns + option) !== "undefined" ? element.data(option) : this.options[option];
        }
    });

    kendo.mobile.Application = Application;
})(jQuery);
(function($, undefined) {
    var kendo = window.kendo,
        mobile = kendo.mobile,
        ui = mobile.ui,
        Widget = ui.Widget,
        support = kendo.support,
        touch = support.touch,
        os = support.mobileOS,
        MOUSECANCEL = support.mousecancel,
        MOUSEDOWN = support.mousedown,
        MOUSEUP = support.mouseup,
        CLICK = "click",
        proxy = $.proxy;

    /**
    * @name kendo.mobile.ui.Button.Description
    * @section The Button widget navigates between mobile Application views when pressed.
    *
    * <h3>Getting Started</h3>
    * <p>The Kendo mobile Application will automatically initialize a mobile Button for every element with <code>role</code> data attribute set to <code>button</code> present in the views/layouts' markup.
    * Alternatively, it can be initialized using a jQuery selector. The button element may be either <code>A</code> or <code>BUTTON</code>. </p>
    *
    * @exampleTitle Initialize Kendo mobile Button based on role data attribute
    * @example
    * <a href="#foo" data-role="button">Foo</a>
    *
    * @exampleTitle Initialize Kendo mobile Button using a jQuery selector
    * @example
    * var button = $("#button").kendoMobileButton();
    *
    * @section
    *
    * <h3>Customizing Mobile Button Appearance</h3>
    * <p>The Kendo mobile Button color can be customized by setting its <code>background-color</code> CSS property inline or by using a CSS selector with specificity of 20+.
    * You can target platforms separately with their respective root CSS classes.</p>
    *
    * @exampleTitle Green Button
    * @example
    * <a href="#foo" data-role="button" style="background-color: green">Foo</a>
    *
    * @section
    *
    * @exampleTitle Green Kendo mobile Button in iOS and a red one in Android
    * @example
    * <style>
    *     .km-ios .checkout { background-color: green; }
    *     .km-android .checkout { background-color: red; }
    * </style>
    *
    * <a href="#foo" data-role="button" class="checkout">Foo</a>
    *
    * @section
    * <h3>Button icons</h3>
    * <p>A Button icon can be set in two ways - either by adding an <code>img</code> element inside the Button element,
    * or by setting an <code>icon</code> data attribute to the Button element.</p>
    * <p>KendoUI Mobile comes out of the box with several ready to use icons:</p>
    *
    * <ul id="icon-list">
    *   <li title=".km-about"><span class="km-icon km-about"></span>about</li>
    *   <li title=".km-action"><span class="km-icon km-action"></span>action</li>
    *   <li title=".km-add"><span class="km-icon km-add"></span>add</li>
    *   <li title=".km-bookmarks"><span class="km-icon km-bookmarks"></span>bookmarks</li>
    *   <li title=".km-camera"><span class="km-icon km-camera"></span>camera</li>
    *   <li title=".km-cart"><span class="km-icon km-cart"></span>cart</li>
    *   <li title=".km-compose"><span class="km-icon km-compose"></span>compose</li>
    *   <li title=".km-contacts"><span class="km-icon km-contacts"></span>contacts</li>
    *   <li title=".km-details"><span class="km-icon km-details"></span>details</li>
    *   <li title=".km-downloads"><span class="km-icon km-downloads"></span>downloads</li>
    *   <li title=".km-fastforward"><span class="km-icon km-fastforward"></span>fastforward</li>
    *   <li title=".km-favorites"><span class="km-icon km-favorites"></span>favorites</li>
    *   <li title=".km-featured"><span class="km-icon km-featured"></span>featured</li>
    *   <li title=".km-featured"><span class="km-icon km-toprated"></span>toprated</li>
    *   <li title=".km-globe"><span class="km-icon km-globe"></span>globe</li>
    *   <li title=".km-history"><span class="km-icon km-history"></span>history</li>
    *   <li title=".km-home"><span class="km-icon km-home"></span>home</li>
    *   <li title=".km-info"><span class="km-icon km-info"></span>info</li>
    *   <li title=".km-more"><span class="km-icon km-more"></span>more</li>
    *   <li title=".km-mostrecent"><span class="km-icon km-mostrecent"></span>mostrecent</li>
    *   <li title=".km-mostviewed"><span class="km-icon km-mostviewed"></span>mostviewed</li>
    *   <li title=".km-organize"><span class="km-icon km-organize"></span>organize</li>
    *   <li title=".km-pause"><span class="km-icon km-pause"></span>pause</li>
    *   <li title=".km-play"><span class="km-icon km-play"></span>play</li>
    *   <li title=".km-recents"><span class="km-icon km-recents"></span>recents</li>
    *   <li title=".km-refresh"><span class="km-icon km-refresh"></span>refresh</li>
    *   <li title=".km-reply"><span class="km-icon km-reply"></span>reply</li>
    *   <li title=".km-rewind"><span class="km-icon km-rewind"></span>rewind</li>
    *   <li title=".km-search"><span class="km-icon km-search"></span>search</li>
    *   <li title=".km-settings"><span class="km-icon km-settings"></span>settings</li>
    *   <li title=".km-share"><span class="km-icon km-share"></span>share</li>
    *   <li title=".km-stop"><span class="km-icon km-stop"></span>stop</li>
    *   <li title=".km-trash"><span class="km-icon km-trash"></span>trash</li>
    * </ul>
    *
    * <p>Additional icons may be added by defining the respective CSS class.
    * If the <code>icon</code> data attribute is set to <code>custom</code>, the tab will receive <code>km-custom</code> CSS class.</p>
    *
    * @exampleTitle Define custom button icon
    * @example
    * <style>
    * .km-custom {
    *   background-image: url("foo.jpg");
    * }
    * </style>
    *
    * <div data-role="button">
    *   <a href="#index" data-icon="custom">Home</a>
    * </div>
    */
    var Button = Widget.extend(/** @lends kendo.mobile.ui.Button.prototype */{
        /**
        * @constructs
        * @extends kendo.mobile.ui.Widget
        * @param {DomElement} element DOM element.
        * @param {Object} options Configuration options.
        */
        init: function(element, options) {
            var that = this;

            Widget.fn.init.call(that, element, options);

            options = that.options;

            that._wrap();

            that._releaseProxy = proxy(that._release, that);

            that.element.bind(MOUSEUP, that._releaseProxy);

            that.element.bind(MOUSEDOWN + " " + MOUSECANCEL + " " + MOUSEUP, function (e) {
                $(e.target).closest(".km-button,.km-detail").toggleClass("km-state-active", e.type == MOUSEDOWN);
            });

            that.bind([
                /**
                 * Fires when button is clicked
                 * @name kendo.mobile.ui.Button#click
                 * @event
                 * @param {Event} e
                 * @param {jQueryObject} e.target The clicked DOM element
                 */
                 CLICK
            ], options);
        },

        options: {
            name: "Button",
            style: ""
        },

        _release: function(e) {
            if (this.trigger(CLICK, {target: $(e.target)})) {
                e.preventDefault();
            }
        },

        _style: function () {
            var style = this.options.style,
                element = this.element;

            if (style) {
                var styles = style.split(" ");
                $.each(styles, function () {
                    element.addClass("km-" + this);
                });
            }
        },

        _wrap: function() {
            var that = this,
                element = that.element,
                icon = element.data(kendo.ns + "icon"),
                iconSpan = $('<span class="km-icon"/>'),
                span;

            span = element.addClass("km-button")
                          .children("span");

            that._style();

            if (!span[0]) {
                span = element.wrapInner("<span/>").children("span");
            }

            var image = span.addClass("km-text")
                            .find("img")
                            .addClass("km-image");

            if (!image[0] && icon) {
                element.prepend(iconSpan);
                iconSpan.addClass("km-" + icon);
            }
        }
    });

    /**
    * @name kendo.mobile.ui.BackButton.Description
    * @section The BackButton widget navigates to the previous mobile View when pressed.
    *
    * @exampleTitle Initialize Kendo mobile BackButton based on role data attribute
    * @example
    * <a data-role="back-button">Foo</a>
    *
    * @exampleTitle Initialize Kendo mobile BackButton using a jQuery selector
    * @example
    * var button = $("#button").kendoMobileBackButton();
    */
    var BackButton = Button.extend(/** @lends kendo.mobile.ui.BackButton.prototype */{
        options: {
            name: "BackButton",
            style: "back"
        },

        /**
        * @constructs
        * @extends kendo.mobile.ui.Button
        * @param {DomElement} element DOM element.
        * @param {Object} options Configuration options.
        */
        init: function(element, options) {
            Button.fn.init.call(this, element, options);
            this.element.attr("href", ":back");
        }
    });

    /**
    * @name kendo.mobile.ui.DetailButton.Description
    * @section The DetailButton widget navigates to a mobile View when pressed.
    *
    * @exampleTitle Initialize Kendo mobile DetailButton based on role data attribute
    * @example
    * <a data-role="detail-button">Foo</a>
    *
    * @exampleTitle Initialize Kendo mobile DetailButton using a jQuery selector
    * @example
    * var button = $("#button").kendoMobileDetailButton();
    */
    var DetailButton = Button.extend(/** @lends kendo.mobile.ui.DetailButton.prototype */{
        options: {
            name: "DetailButton",
            style: ""
        },

        /**
        * @constructs
        * @extends kendo.mobile.ui.Button
        * @param {DomElement} element DOM element.
        * @param {Object} options Configuration options.
        */
        init: function(element, options) {
            Button.fn.init.call(this, element, options);
        },

        _style: function () {
            var style = this.options.style + " detail",
                element = this.element;

            if (style) {
                var styles = style.split(" ");
                $.each(styles, function () {
                    element.addClass("km-" + this);
                });
                element.removeClass("km-button");
            }
        }

    });

    ui.plugin(Button);
    ui.plugin(BackButton);
    ui.plugin(DetailButton);
})(jQuery);
(function($, undefined) {
    var kendo = window.kendo,
        ui = kendo.mobile.ui,
        support = kendo.support,
        DataSource = kendo.data.DataSource,
        Widget = ui.Widget,
        ITEM_SELECTOR = ".km-list > li",
        proxy = $.proxy,
        GROUP_TEMPLATE = kendo.template("<li><div class=\"km-group-title\">#= this.headerTemplate(data) #</div><ul>#= kendo.render(this.template, data.items)#</ul></li>"),
        FUNCTION = "function",
        MOUSEDOWN = support.mousedown,
        MOUSEUP = support.mouseup,
        CLICK = "click";

    function toggleItemActiveClass(e) {
        var item = $(e.currentTarget);
            clickedLink = $(e.target).closest("a"),
            role = clickedLink.data(kendo.ns + "role") || "";

        if (clickedLink[0] && (!role.match(/button/))) {
            item.toggleClass("km-state-active", e.type === MOUSEDOWN);
        }
    }

    function enhanceLinkItem(i, item) {
        item = $(item);
        var parent = item.parent();

        if (parent.contents().not(item)[0]) {
            return;
        }

        var icon = parent.data(kendo.ns + "icon"),
            iconSpan = $('<span class="km-icon"/>');

        item.addClass("km-listview-link")
            .attr(kendo.attr("role"), "listview-link");

        if (icon) {
            item.prepend(iconSpan);
            iconSpan.addClass("km-" + icon);
        }
    }

    /**
    * @name kendo.mobile.ui.ListView.Description
    * @section
    * <p>The Kendo Mobile ListView widget is used to display flat or grouped list of items.
    * It can be either used in unbound mode by enhancing an HTML <code>ul</code> element, or bound to a DataSource instance.</p>
    *
    * <h3>Getting Started</h3>
    * <p>The Kendo mobile Application automatically initializes the mobile ListView for every <code>ul</code> element with <code>role</code> data attribute set to
    * <code>listview</code> present in the views' markup.
    * Alternatively, it can be initialized using a jQuery selector. The mobile ListView element can contain one or more <code>li</code> elements.</p>
    * @exampleTitle Initialize mobile ListView using a role data attribute
    * @example
    * <ul data-role="listview">
    *   <li>Foo</li>
    *   <li>Bar</li>
    * </ul>
    *
    * @exampleTitle Initialize mobile ListView using a jQuery selector
    * @example
    * <ul id="listView"></ul>
    * <script>
    * var listView = $("#listView").kendoMobileListView();
    * </script>
    *
    * @section
    * <h3>Inset mobile ListView</h3>
    * <p>In iOS, the mobile ListView appearance can be changed to <strong>inset</strong>, to achieve an effect similar to iOS grouped table views,
    * where the list items are padded from the container, and have rounded corners.
    * This can be accomplished by setting the <code>style</code> data attribute to <code>inset</code>.
    * <strong>Note:</strong> This setting won't affect the appearance of the mobile ListView on Android devices.</p>
    *
    * @exampleTitle Create Inset mobile ListView
    * @example
    * <ul data-role="listview" data-style="inset">
    *   <li>Foo</li>
    *   <li>Bar</li>
    * </ul>
    *
    * @section
    * <h3>Grouped mobile ListView</h3>
    * <p>The mobile ListView can display items in groups, with optional headers. This can be achieved by nesting unordered lists in items,
    * and setting the widget's element <code>type</code> data attribute to <code>group</code>.</p>
    * @exampleTitle Create grouped mobile ListView
    * @example
    * <ul data-role="listview" data-type="group">
    *     <li>
    *         Foo
    *         <ul>
    *             <li>Bar</li>
    *             <li>Baz</li>
    *         </ul>
    *     </li>
    *     <li>
    *         Bar
    *         <ul>
    *             <li>Bar</li>
    *             <li>Qux</li>
    *         </ul>
    *     </li>
    * </ul>
    *
    * @section
    * <h3>Binding to Data</h3>
    *
    * <p>
    * The mobile ListView can be bound to both local JavaScript arrays and remote data via the
    * Kendo DataSource component. Local JavaScript arrays are appropriate for limited value
    * options, while remote data binding is better for larger data sets.
    * </p>
    *
    * @exampleTitle Bind mobile ListView to a local data source.
    * @example
    * $(document).ready(function() {
    *     $("#listview").kendoMobileListView({
    *         dataSource: kendo.data.DataSource.create(["foo", "bar", "baz"])
    *      });
    * });
    *
    * @section
    * <h3>Customizing Item Templates</h3>
    * <p>
    *     The mobile ListView leverages Kendo UI high-performance Templates to give you complete control
    *     over item rendering. For a complete overview of Kendo UI Template capabilities and syntax,
    *     please review the <a href="../templates/index.html" title="Kendo UI Template">Kendo UI Template</a> demos and documentation.
    * </p>
    * @exampleTitle Basic item template customization
    * @example
    * <ul id="listview"></ul>
    *
    * <script type="text/javascript">
    *     $(document).ready(function() {
    *         $("#listview").kendoMobileListView({
    *             template : "<strong>${data.foo}</strong>",
    *             dataSource: kendo.data.DataSource.create([{foo: "bar"}, {foo: "baz"}])
    *         });
    *     });
    * </script>
    *
    * @section
    * <h3>Item Icons</h3>
    * An icon can be set in two ways - either by adding an <code>img</code> element inside the <code>li</code> element, or by setting an <code>icon</code> data attribute to the <code>li</code> element.
    * if data attribute is used then an <code>a</code> element should be put in the <code>li</code> element. The icon class will be applied to the <code>a</code> element.
    * Kendo mobile comes out of the box with several ready to use icons:
    *
    * <ul id="icon-list">
    *   <li title=".km-about"><span class="km-icon km-about"></span>about</li>
    *   <li title=".km-action"><span class="km-icon km-action"></span>action</li>
    *   <li title=".km-add"><span class="km-icon km-add"></span>add</li>
    *   <li title=".km-bookmarks"><span class="km-icon km-bookmarks"></span>bookmarks</li>
    *   <li title=".km-camera"><span class="km-icon km-camera"></span>camera</li>
    *   <li title=".km-cart"><span class="km-icon km-cart"></span>cart</li>
    *   <li title=".km-compose"><span class="km-icon km-compose"></span>compose</li>
    *   <li title=".km-contacts"><span class="km-icon km-contacts"></span>contacts</li>
    *   <li title=".km-details"><span class="km-icon km-details"></span>details</li>
    *   <li title=".km-downloads"><span class="km-icon km-downloads"></span>downloads</li>
    *   <li title=".km-fastforward"><span class="km-icon km-fastforward"></span>fastforward</li>
    *   <li title=".km-favorites"><span class="km-icon km-favorites"></span>favorites</li>
    *   <li title=".km-featured"><span class="km-icon km-featured"></span>featured</li>
    *   <li title=".km-featured"><span class="km-icon km-toprated"></span>toprated</li>
    *   <li title=".km-globe"><span class="km-icon km-globe"></span>globe</li>
    *   <li title=".km-history"><span class="km-icon km-history"></span>history</li>
    *   <li title=".km-home"><span class="km-icon km-home"></span>home</li>
    *   <li title=".km-info"><span class="km-icon km-info"></span>info</li>
    *   <li title=".km-more"><span class="km-icon km-more"></span>more</li>
    *   <li title=".km-mostrecent"><span class="km-icon km-mostrecent"></span>mostrecent</li>
    *   <li title=".km-mostviewed"><span class="km-icon km-mostviewed"></span>mostviewed</li>
    *   <li title=".km-organize"><span class="km-icon km-organize"></span>organize</li>
    *   <li title=".km-pause"><span class="km-icon km-pause"></span>pause</li>
    *   <li title=".km-play"><span class="km-icon km-play"></span>play</li>
    *   <li title=".km-recents"><span class="km-icon km-recents"></span>recents</li>
    *   <li title=".km-refresh"><span class="km-icon km-refresh"></span>refresh</li>
    *   <li title=".km-reply"><span class="km-icon km-reply"></span>reply</li>
    *   <li title=".km-rewind"><span class="km-icon km-rewind"></span>rewind</li>
    *   <li title=".km-search"><span class="km-icon km-search"></span>search</li>
    *   <li title=".km-settings"><span class="km-icon km-settings"></span>settings</li>
    *   <li title=".km-share"><span class="km-icon km-share"></span>share</li>
    *   <li title=".km-stop"><span class="km-icon km-stop"></span>stop</li>
    *   <li title=".km-trash"><span class="km-icon km-trash"></span>trash</li>
    * </ul>
    *
    * <p>Additional icons may be added by defining the respective CSS class. If the <code>icon</code> data attribute is set to <code>custom</code>, the item will receive <code>km-custom</code> CSS class.  </p>
    *
    * @exampleTitle Define custom button icon.
    * @example
    * <style>
    * .km-custom {
    *   background-image: url("foo.jpg");
    * }
    * </style>
    *
    * <ul data-role="listview" data-style="inset">
    *   <li data-icon="custom">
    *      <a>Home</a>
    *   </li>
    *   <li>
    *      Bar
    *   </li>
    * </ul>
    */
    var ListView = Widget.extend(/** @lends kendo.mobile.ui.ListView.prototype */{
        /**
        * @constructs
        * @extends kendo.mobile.ui.Widget
        * @param {DomElement} element DOM element.
        * @param {Object} options Configuration options.
        * @option {kendo.data.DataSource|Object} [dataSource] Instance of DataSource or the data that the mobile ListView will be bound to.
        * @option {String} [type] The type of the control. Can be either <code>flat</code> (default) or <code>group</code>. Determined automatically in databound mode.
        * @option {String} [style] The style of the control. Can be either empty string(""), or <code>inset</code>.
        * @option {String} [template] <${data}> The item template.
        * @option {String} [headerTemplate] <${value}> The header item template (applies for grouped mode).
        */
        init: function(element, options) {
            var that = this;

            Widget.fn.init.call(that, element, options);

            options = that.options;

            that.element
                .delegate(ITEM_SELECTOR, MOUSEDOWN + " " + MOUSEUP, toggleItemActiveClass)
                .delegate(ITEM_SELECTOR, MOUSEUP, proxy(that._click, that));

            if (options.dataSource) {
                that.dataSource = DataSource.create(options.dataSource).bind("change", $.proxy(that._refresh, that));
                that._template();
                that.dataSource.fetch();
            } else {
                that._style();
            }

            that.bind([
            /**
             * Fires when item is clicked
             * @name kendo.mobile.ui.ListView#click
             * @event
             * @param {Event} e
             * @param {jQueryObject} e.item The selected list item.
             * @param {jQueryObject} e.target The clicked DOM element.
             * @param {Object} e.dataItem The corresponding dataItem associated with the item (available in databound mode only).
             * @param {String} e.buttonName The name of the clicked Kendo mobile Button. Specified by setting the <code>name</code> data attribute of the button widget element.
             * @param {kendo.ui.MobileButton} e.button The clicked Kendo mobile Button.
             *
             * @exampleTitle Handling button clicks
             * @example
             * <ul data-role="listview" id="foo">
             *     <li><a data-role="button" data-name="bar">Bar button</a> | <a data-role="button" data-name="baz">Baz button</a></li>
             * </ul>
             *
             * <script>
             *  $("#foo").data("kendoMobileListView").bind("click", function(e) {
             *      console.log(e.buttonName); // "foo" or "bar"
             *      console.log(e.button); // Kendo MobileButton instance
             *  }
             * </script>
             *
             * @exampleTitle Making dataItem available in events
             * @example
             * <ul id="foo"></ul>
             *
             * <script>
             *  // for the dataItem to be present in the click event, The datasource must have schema definition.
             *  $("#foo").kendoMobileListView({
             *     dataSource: new kendo.data.DataSource({
             *          data:   [{title: "foo"}, {title: "bar"}],
             *          schema: {model: {}}
             *     }),
             *
             *     click: function(e) {
             *          console.log(e.dataItem.title);
             *     }
             *  });
             * </script>
             */
            CLICK
            ], options);
        },

        options: {
            name: "ListView",
            type: "flat",
            template: "${data}",
            headerTemplate: "${value}",
            style: ""
        },

        _refresh: function() {
            var that = this,
                dataSource = that.dataSource,
                grouped,
                view = dataSource.view();

            if (dataSource.group()[0]) {
                that.options.type = "group";
                that.element.html(kendo.render(that.groupTemplate, view));
            } else {
                that.element.html(kendo.render(that.template, view));
            }

            kendo.mobile.enhance(that.element.children());

            that._style();
        },

        _template: function() {
            var that = this,
                template = that.options.template,
                headerTemplate = that.options.headerTemplate,
                model = that.dataSource.options.schema.model,
                dataIDAttribute = "",
                templateProxy = {},
                groupTemplateProxy = {};

            if (model) {
                dataIDAttribute = ' data-uid="#=uid#"';
            }

            if (typeof template === FUNCTION) {
                templateProxy.template = template;
                template = "#=this.template(data)#";
            }

            groupTemplateProxy.template = that.template = $.proxy(kendo.template("<li" + dataIDAttribute + ">" + template + "</li>"), templateProxy);

            if (typeof headerTemplate === FUNCTION) {
                groupTemplateProxy._headerTemplate = headerTemplate;
                headerTemplate = "#=this._headerTemplate(data)#";
            }

            groupTemplateProxy.headerTemplate = kendo.template(headerTemplate);

            that.groupTemplate = $.proxy(GROUP_TEMPLATE, groupTemplateProxy);
        },

        _click: function(e) {
            var that = this,
                dataItem,
                item = $(e.currentTarget),
                target = $(e.target),
                button = target.closest("[" + kendo.attr("name") + "]", item),
                buttonName = button.data(kendo.ns + "name"),
                id = item.attr(kendo.attr("uid"));

            if (id) {
                dataItem = that.dataSource.getByUid(id);
            }

            if (that.trigger(CLICK, {target: target, item: item, dataItem: dataItem, buttonName: buttonName, button: button.data("kendoMobileButton")})) {
                e.preventDefault();
            }
        },

        _style: function() {
            var that = this,
                options = that.options,
                grouped = options.type === "group",
                inset = options.style === "inset";

            that.element.addClass("km-listview")
                .toggleClass("km-list", !grouped)
                .toggleClass("km-listinset", !grouped && inset)
                .toggleClass("km-listgroup", grouped && !inset)
                .toggleClass("km-listgroupinset", grouped && inset)
                .find("a:only-child:not([data-" + kendo.ns + "role])").each(enhanceLinkItem);

            if (grouped) {
                that.element
                    .children()
                    .children("ul")
                    .addClass("km-list");
            }

            that.element.closest(".km-content").toggleClass("km-insetcontent", inset); // iOS has white background when the list is not inset.
        }
    });

    ui.plugin(ListView);
})(jQuery);
(function($, undefined) {
    var mobile = kendo.mobile,
        ui = mobile.ui,
        proxy = $.proxy,
        roleSelector = kendo.roleSelector,
        Widget = ui.Widget;

    var TICK_INTERVAL = 10;

    var Inertia = kendo.Class.extend({
        init: function(move, callback) {
            var that = this;
            that.move = move;
            that.timer = 0;
            that.tickProxy = proxy(that.tick, that);
            that.callback = callback;
        },

        animate: function() {
            this.intervalID = setInterval(this.tickProxy, TICK_INTERVAL);
        },

        stop: function() {
            clearInterval(this.intervalID);
            this.timer = 0;
        },

        moveTo: function(options) {
            var that = this,
                move = that.move;

            that.initialX = move.x;
            that.initialY = move.y;

            that.deltaX = options.x - that.initialX;
            that.deltaY = options.y - that.initialY;

            that.duration = options.duration || 300;

            that.ease = that.easeProxy(options.ease || Ease.easeOutQuad);

            that.animate();
        },

        easeProxy: function(ease) {
            var that = this;
            return function() {
                that.move.moveTo(
                    ease(that.timer, that.initialX, that.deltaX, that.duration),
                    ease(that.timer, that.initialY, that.deltaY, that.duration)
                );
            }
        },

        tick: function() {
            var that = this;
            that.timer += TICK_INTERVAL;
            that.ease();

            if (that.timer === that.duration) {
                that.stop();
                this.callback();
            }
        }
    });

    var Ease = {
        /*
        linearTween: function (t, b, c, d) {
            return c*t/d + b;
        },

        easeInQuad: function (t, b, c, d) {
            return c*(t/=d)*t + b;
        },

        easeOutQuad: function (t, b, c, d) {
            return -c *(t/=d)*(t-2) + b;
        },

        easeInCubic: function (t, b, c, d) {
            return c*(t/=d)*t*t + b;
        },

        easeOutCubic: function (t, b, c, d) {
            return c*((t=t/d-1)*t*t + 1) + b;
        },

        easeInQuart: function (t, b, c, d) {
            return c*(t/=d)*t*t*t + b;
        },

        easeOutQuart: function (t, b, c, d) {
            return -c * ((t=t/d-1)*t*t*t - 1) + b;
        },

        easeInQuint: function (t, b, c, d) {
            return c*(t/=d)*t*t*t*t + b;
        },

        easeOutQuint: function (t, b, c, d) {
            return c*((t=t/d-1)*t*t*t*t + 1) + b;
        },

        easeInExpo: function (t, b, c, d) {
            return (t==0) ? b : c * Math.pow(2, 10 * (t/d - 1)) + b;
        },
        */

        easeOutExpo: function (t, b, c, d) {
            return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
        },

        /*
        easeInBack: function (t, b, c, d, s) {
            if (s == undefined) s = 1.70158;
            return c*(t/=d)*t*((s+1)*t - s) + b;
        },
        */

        easeOutBack: function (t, b, c, d, s) {
            if (s == undefined) s = 1.70158;
            return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
        }
    };

    var CURRENT_PAGE_CLASS = "km-current-page";

    /**
    * @name kendo.mobile.ui.ScrollView.Description
    * @section The Kendo Mobile ScrollView widget is used to scroll content wider than the device screen.
    *
    * <h3>Getting Started</h3>
    * <p>The Kendo Mobile Application automatically initializes the Mobile ScrollView for every element with <code>role</code> data attribute set to <code>scrollview</code> present in the views' markup.
    * Alternatively, it can be initialized using a jQuery selector. </p>
    * @exampleTitle Initialize mobile ScrollView using a role data attribute.
    * @example
    * <div data-role="scrollview">
    *   Foo
    * </div>
    *
    * @exampleTitle Initialize mobile ScrollView using a jQuery selector.
    * @example
    * <div id="scrollView"></div>
    * <script>
    * var listView = $("#scrollView").kendoMobileScrollView();
    * </script>
    *
    */
    var ScrollView = Widget.extend(/** @lends kendo.mobile.ui.ScrollView.prototype */{
        /**
        * @constructs
        * @extends kendo.mobile.ui.Widget
        * @param {DomElement} element DOM element
        * @param {Object} options
        * @option {Number} [duration] <300> The milliseconds that take the ScrollView to snap to the current page after released.
        * @option {Number} [velocityThreshold] <1> The velocity threshold after which a swipe will navigate to the next page (as opposed to snapping back to the current view).
        * The swipe velocity equal the pixels per millisecond change for a swipe.
        * @option {Number} [bounceVelocityThreshold] <2.5> The velocity threshold after which a swipe will result in a bounce effect.
        */
        init: function(element, options) {
            var that = this;
            Widget.fn.init.call(that, element, options);
            element = that.element;

            element
                .wrapInner("<div/>")
                .addClass("km-scrollview")
                .append('<ol class="km-pages"/>');

            that.inner = element.children().first();
            that.pager = element.children().last();
            that.page = 0;

            that.move = new mobile.Move(that.inner);

            that.inertia = new Inertia(that.move, function() {
                that.page = -that.move.x / that.width;
                that._updatePage();
            });

            that.swipe = new mobile.Swipe(element, {
                start: function() {
                    that.inertia.stop();
                },
                end: $.proxy(that._swipeEnd, that)
            });

            that.draggable = new mobile.Draggable({
                ignoreY: true,
                minY: 0,
                swipe: that.swipe,
                move: that.move
            });

            that.calculateDimensions();
            $(window).bind("orientationchange", proxy(that.calculateDimensions, that));
        },

        options: {
            name: "ScrollView",
            duration: 300,
            velocityThreshold: 1,
            bounceVelocityThreshold: 2.5
        },

        viewShow: function(view) {
            this.calculateDimensions();
        },

        calculateDimensions: function() {
            var that = this,
                width = that.width = that.element.width(),
                pageHTML = "",
                scrollWidth,
                pages;

            that.page = -that.move.x / width;

            scrollWidth = that.element[0].scrollWidth + (that.page * width);
            pages = that.pages = Math.ceil(scrollWidth / width);

            that.minSnap = - (pages - 1) * width;
            that.maxSnap = 0;
            that.draggable.options.minX = width - scrollWidth;

            for (var idx = 0; idx < pages; idx ++) {
                pageHTML += "<li/>";
            }

            that.pager.html(pageHTML);
            that._updatePage();
        },

        _swipeEnd: function(e) {
            var that = this,
                velocity = e.x.velocity,
                options = that.options,
                velocityThreshold = options.velocityThreshold,
                snap,
                approx = Math.round,
                ease = Ease.easeOutExpo;

            if (velocity > velocityThreshold) {
                approx = Math.ceil;
            } else if(velocity < -velocityThreshold) {
                approx = Math.floor;
            }

            snap = Math.max(that.minSnap, Math.min(approx(that.move.x / that.width) * that.width, that.maxSnap));

            if (Math.abs(velocity) > options.bounceVelocityThreshold) {
                ease = Ease.easeOutBack;
            }

            that.inertia.moveTo({ x: snap, y: 0, duration: options.duration, ease: ease });
        },

        _updatePage: function() {
            var that = this,
                pager = that.pager;

            pager.children().removeClass(CURRENT_PAGE_CLASS);
            pager.find(":nth-child(" + (that.page + 1) +")").addClass(CURRENT_PAGE_CLASS);
        }
    });

    ui.plugin(ScrollView);
})(jQuery);
(function($, undefined) {
    /**
    * @name kendo.mobile.ui.NavBar.Description
    *
    * @section <p>The Kendo mobile NavBar widget is used inside a mobile View or Layout Header element to display an application navigation bar.
    * The mobile NavBar can show the current view title in the center, and optionally some additional left and right aligned widgets (back button, settings button, etc.).</p>
    *
    * <h3>Getting Started</h3>
    * The Kendo mobile Application will automatically initialize the mobile NavBar for every element with <code>role</code> data attribute set to <code>navbar</code> present in the views/layouts markup.
    * Alternatively, it can be initialized using a jQuery selector.
    * @exampleTitle Initialize Kendo mobile NavBar based on role data attribute
    * @example
    * <div data-role="navbar">My View Title</div>
    *
    * @exampleTitle Initialize Kendo mobile NavBar using a jQuery selector
    * @example
    * var navbar = $("#navbar").kendoMobileNavBar();
    * @section <h3>Aligning Widgets Inside the NavBar</h3>
    *
    * <p>After initialization, the mobile NavBar positions its child elements based on the specified <code>align</code> data attribute (either <code>left</code> or <code>right</code>).
    * By default, elements without any align are centered.</p>
    *
    * @exampleTitle Use the <code>align</code> data attribute to specify the elements position inside the NavBar
    * @example
    * <div data-role="navbar">
    *   <a data-role="back-button" data-align="left">Back</a>
    *   My View Title
    *   <a data-role="button" data-align="right">About</a>
    * </div>
    *
    * @section <h3>Automatically Update NavBar Title Based on Current View's Title</h3>
    *
    * <p>If an element with <code>role</code> data attribute set to <code>view-title</code> is present inside the mobile NavBar,
    * the Kendo mobile Application instance will update its text to the current View's title when changing views.
    * The View title is specified by setting the <code>title</code> data attribute of the View element. </p>
    *
    * <p>This feature is particularly useful if the mobile NavBar is inside a layout.</p>
    *
    * @exampleTitle Use the <code>view-title</code> data attribute to auto-update the mobile NavBar title
    * @example
    * <div data-role="layout" data-id="foo">
    *   <div data-role="header">
    *       <div data-role="navbar">
    *          <span data-role="view-title">My View Title</span>
    *       </div>
    *   </div>
    * </div>
    *
    * <div data-role="view" data-layout="foo" data-title="bar"> ... </div>
    * <div data-role="view" data-layout="foo" data-title="baz"> ... </div>
    *
    * @section <h3>Customizing Mobile NavBar Appearance</h3>
    * <p>The mobile NavBar background color can be customized by setting its background-color CSS property either inline or using a CSS selector with specificity of 20+.
    * Different platforms can be styled separately with their respective root classes. </p>
    *
    * @exampleTitle Green Kendo mobile NavBar
    * @example
    * <div data-role="navbar" style="background-color: green">My View Title</div>
    *
    * @exampleTitle Green Kendo mobile NavBar in iOS and a red one in Android
    * @example
    * <style>
    *     .km-ios .checkout { background-color: green; }
    *     .km-android .checkout { background-color: red; }
    * </style>
    * <div data-role="navbar" class="checkout">My View Title</div>
    */
    var ui = window.kendo.mobile.ui,
        roleSelector = kendo.roleSelector,
        Widget = ui.Widget;

    function createContainer(align, element) {

        var items = element.find("[" + kendo.attr("align") + "=" + align + "]");

        if (items[0]) {
            element.prepend($('<div class="km-' + align + 'item" />').append(items));
        }
    }

    var NavBar = Widget.extend(/** @lends kendo.mobile.ui.NavBar.prototype */{
        /**
        * @constructs
        * @extends kendo.mobile.ui.Widget
        * @param {DomElement} element DOM element
        */
        init: function(element, options) {
            Widget.fn.init.call(this, element, options);
            element = this.element;

            element.addClass("km-navbar").wrapInner($('<div class="km-view-title" />'));
            createContainer("left", element);
            createContainer("right", element);
        },

        options: {
            name: "NavBar"
        },

        /**
        * Update the title element text. The title element is specified by setting the <code>role</code> data attribute to <code>view-title</code>.
        * @param {String} value The text of title
        * @example
        * <div data-role="navbar" id="foo">
        *     <span data-role="view-title"></span>
        * </div>
        *
        * <script>
        *   $("#foo").data("kendoMobileNavBar").title("Foo");
        * </script>
        */
        title: function(value) {
            this.element.find(roleSelector("view-title")).text(value);
        },

        viewShow: function(view) {
            this.title(view.title);
        }
    });

    ui.plugin(NavBar);
})(jQuery);
(function($, undefined) {
    /**
    * @name kendo.mobile.ui.ButtonGroup.Description
    * @section The Kendo mobile ButtonGroup widget is a linear set of grouped buttons.
    *
    * <h3>Getting Started</h3>
    * <p>The Kendo mobile Application will automatically initialize a mobile ButtonGroup for every element with <code>role</code> data attribute set to <code>buttongroup</code>
    * present in the views/layouts markup.</p>
    *
    * <p>Alternatively, it can be initialized using a jQuery selector. The ButtonGroup element may be <code>UL</code> element.</p>
    *
    * @exampleTitle Initialize Kendo mobile ButtonGroup based on role data attribute.
    * @example
    * <ul id="buttongroup" data-role="buttongroup" />
    *   <li>Option 1</li>
    *   <li>Option 2</li>
    * </ul>
    *
    * @exampleTitle Initialize Kendo mobile ButtonGroup using a jQuery selector
    * @example
    * var buttongroup = $("#buttongroup").kendoMobileButtonGroup();
    *
    * @section
    *
    * <h3>Customizing mobile ButtonGroup appearance</h3>
    * Every Kendo Mobile ButtonGroup color can be customized by setting its <code>background-color</code> inline or using a CSS selector.
    * @exampleTitle Green Kendo mobile ButtonGroup
    * @example
    * <ul id="buttongroup" data-role="buttongroup" />
    *   <li style="background-color: green">Option1</li>
    *   <li style="beckground-color: red">Option2</li>
    * </ul>
    *
    * @section
    * <h3>Button icons</h3>
    * <p>A Button icon can be set in two ways - either by adding an <code>img</code> element inside the Button <code>a</code> element,
    * or by setting an <code>icon</code> data attribute to the Button <code>a</code> element.</p>
    * <p>Kendo mobile comes out of the box with several ready to use icons:</p>
    *
    * * <ul id="icon-list">
    *   <li title=".km-about"><span class="km-icon km-about"></span>about</li>
    *   <li title=".km-action"><span class="km-icon km-action"></span>action</li>
    *   <li title=".km-add"><span class="km-icon km-add"></span>add</li>
    *   <li title=".km-bookmarks"><span class="km-icon km-bookmarks"></span>bookmarks</li>
    *   <li title=".km-camera"><span class="km-icon km-camera"></span>camera</li>
    *   <li title=".km-cart"><span class="km-icon km-cart"></span>cart</li>
    *   <li title=".km-compose"><span class="km-icon km-compose"></span>compose</li>
    *   <li title=".km-contacts"><span class="km-icon km-contacts"></span>contacts</li>
    *   <li title=".km-details"><span class="km-icon km-details"></span>details</li>
    *   <li title=".km-downloads"><span class="km-icon km-downloads"></span>downloads</li>
    *   <li title=".km-fastforward"><span class="km-icon km-fastforward"></span>fastforward</li>
    *   <li title=".km-favorites"><span class="km-icon km-favorites"></span>favorites</li>
    *   <li title=".km-featured"><span class="km-icon km-featured"></span>featured</li>
    *   <li title=".km-featured"><span class="km-icon km-toprated"></span>toprated</li>
    *   <li title=".km-globe"><span class="km-icon km-globe"></span>globe</li>
    *   <li title=".km-history"><span class="km-icon km-history"></span>history</li>
    *   <li title=".km-home"><span class="km-icon km-home"></span>home</li>
    *   <li title=".km-info"><span class="km-icon km-info"></span>info</li>
    *   <li title=".km-more"><span class="km-icon km-more"></span>more</li>
    *   <li title=".km-mostrecent"><span class="km-icon km-mostrecent"></span>mostrecent</li>
    *   <li title=".km-mostviewed"><span class="km-icon km-mostviewed"></span>mostviewed</li>
    *   <li title=".km-organize"><span class="km-icon km-organize"></span>organize</li>
    *   <li title=".km-pause"><span class="km-icon km-pause"></span>pause</li>
    *   <li title=".km-play"><span class="km-icon km-play"></span>play</li>
    *   <li title=".km-recents"><span class="km-icon km-recents"></span>recents</li>
    *   <li title=".km-refresh"><span class="km-icon km-refresh"></span>refresh</li>
    *   <li title=".km-reply"><span class="km-icon km-reply"></span>reply</li>
    *   <li title=".km-rewind"><span class="km-icon km-rewind"></span>rewind</li>
    *   <li title=".km-search"><span class="km-icon km-search"></span>search</li>
    *   <li title=".km-settings"><span class="km-icon km-settings"></span>settings</li>
    *   <li title=".km-share"><span class="km-icon km-share"></span>share</li>
    *   <li title=".km-stop"><span class="km-icon km-stop"></span>stop</li>
    *   <li title=".km-trash"><span class="km-icon km-trash"></span>trash</li>
    * </ul>
    *
    * <p>Additional icons may be added by defining the respective CSS class.
    * If the <code>icon</code> data attribute is set to <code>custom</code>, the Button will receive <code>km-custom</code> CSS class.</p>
    * @exampleTitle Define custom button icon.
    * @example
    * <style>
    * .km-custom {
    *   background-image: url("foo.png");
    * }
    * </style>
    *
    * <ul id="buttongroup" data-role="buttongroup" />
    *   <li data-icon="custom">Option 1</li>
    *   <li>Option 2</li>
    * </ul>
    */

    var kendo = window.kendo,
        ui = kendo.mobile.ui,
        Widget = ui.Widget,
        ACTIVE = "km-state-active",
        SELECT = "select",
        SELECTOR = "li:not(." + ACTIVE +")",
        MOUSEDOWN = kendo.support.touch ? "touchstart" : "mousedown";

    var ButtonGroup = Widget.extend(/** @lends kendo.mobile.ui.ButtonGroup.prototype */{
        /**
        * @constructs
        * @extends kendo.mobile.ui.Widget
        * @param {DomElement} element DOM element.
        * @param {Object} options Configuration options.
        * @option {Number} [index] Defines the initially selected Button.
        */
        init: function(element, options) {
            var that = this;

            Widget.fn.init.call(that, element, options);

            that.element.addClass("km-buttongroup")
                .delegate(SELECTOR, MOUSEDOWN, $.proxy(that._mousedown, that))
                .find("li").each(that._button);

            that.bind([
                /**
                * Fires when different Button is selected.
                * @name kendo.mobile.ui.ButtonGroup#select
                * @event
                * @param {Event} e
                *
                * @exampleTitle Handle select event
                * @example
                * <ul id="buttongroup" data-role="buttongroup" />
                *   <li>Option 1</li>
                *   <li>Option 2</li>
                * </ul>
                *
                * <script>
                *  $("#buttongroup").data("kendoMobileButtonGroup").bind("select", function(e) {
                *      //handle select event
                *  }
                * </script>
                */
                SELECT
            ], that.options);

            that.select(that.options.index);
        },

        options: {
            name: "ButtonGroup",
            index: -1
        },

        /**
        * Get the currently selected Button.
        * @returns {jQueryObject} the currently selected Button.
        */
        current: function() {
            return this.element.find("." + ACTIVE);
        },

        /**
        * Select a Button.
        * @param {jQueryObject | Number} li LI element or index of the Button.
        * @example
        * var buttongroup = $("#buttongroup").data("kendoMobileButtonGroup");
        *
        * // selects by jQuery object
        * buttongroup.select(buttongroup.element.children().eq(0));
        *
        * // selects by index
        * buttongroup.select(1);
        */
        select: function (li) {
            var that = this,
                index = -1;

            if (li === undefined || li === -1) {
                return;
            }

            that.current().removeClass(ACTIVE);

            if (typeof li === "number") {
                index = li;
                li = $(that.element[0].children[li]);
            } else if (li.nodeType) {
                li = $(li);
                index = li.index();
            }

            li.addClass(ACTIVE);
            that.selectedIndex = index;
        },

        _button: function() {
            var button = $(this).addClass("km-button"),
                icon = button.data(kendo.ns + "icon"),
                span = button.children("span"),
                image = button.find("img").addClass("km-image");

            if (!span[0]) {
                span = button.wrapInner("<span/>").children("span");
            }

            span.addClass("km-text");

            if (!image[0] && icon) {
                button.prepend($('<span class="km-icon km-' + icon + '"/>'));
            }
        },

        _mousedown: function(e) {
            var that = this;
            that.select(e.currentTarget);
            that.trigger(SELECT);
        }
    });

    ui.plugin(ButtonGroup);
})(jQuery);
(function($, undefined) {
    var kendo = window.kendo,
        ui = kendo.mobile.ui,
        support = kendo.support,
        proxy = $.proxy,
        Widget = ui.Widget,
        touch = support.touch || support.pointers,
        touchLocation = kendo.touchLocation,
        min = Math.min,
        max = Math.max,
        abs = Math.abs,
        round = Math.round,
        to3DProperty,
        TRANSLATION_REGEXP = /(translate[3d]*\(|matrix\(([\s\w\d]*,){4,4})\s*(-?[\d\.]+)?[\w\s]*,?\s*(-?[\d\.]+)[\w\s]*.*?\)/i,
        SINGLE_TRANSLATION_REGEXP = /(translate([XY])\(\s*(-?[\d\.]+)?[\w\s]*\))/i,
        DEFAULT_MATRIX = [0, 0, 0, 0, 0],
        PX = "px",
        OPACITY = "opacity",
        VISIBLE = "visible",
        TRANSFORM = support.transitions.css + "transform",
        TRANSFORMSTYLE = support.transitions.prefix + "Transform",
        MOVEEVENT = support.mousemove,
        FRAMERATE = 1000 / 30,
        ACCELERATION = 20,
        VELOCITY = 0.5,
        BOUNCE_STOP = 100,
        SCROLLBAR_OPACITY = 0.7,
        BOUNCE_FRICTION = 0.8,
        BOUNCE_DECELERATION = 3,
        BOUNCE_PARALLAX = 0.5,
        BOUNCE_SNAP = 0.7,
        FRICTION = 0.96;

        if (support.hasHW3D) {
            to3DProperty = function(value) {
                return "translate3d(" + value + ", 0)";
            };
        } else {
            to3DProperty = function(value) {
                return "translate(" + value + ")";
            };
        }

    function limitValue(value, minLimit, maxLimit) {
        return max(minLimit, min(maxLimit, value));
    }

    function numericCssValue(element, property) {
        return parseInt(element.css(property), 10) || 0;
    }

    function getScrollOffsets(scrollElement) {
        scrollElement = $(scrollElement);

        var transformStyle = scrollElement[0].style[TRANSFORMSTYLE],
            transforms = (transformStyle ? transformStyle.match(TRANSLATION_REGEXP) || transformStyle.match(SINGLE_TRANSLATION_REGEXP) || DEFAULT_MATRIX : DEFAULT_MATRIX);

        if (transforms) {
            if (transforms[2] === "Y") {
                transforms[4] = transforms[3];
                transforms[3] = 0;
            } else {
                if (transforms[2] === "X") {
                    transforms[4] = 0;
                }
            }
        }

        if (support.transitions) {
            return {x: +transforms[3], y: +transforms[4]};
        } else {
            return {x: numericCssValue(scrollElement, "marginLeft"), y: numericCssValue(scrollElement, "marginTop")};
        }
    }

    function Axis(scrollElement, property, updateCallback) {
        var boxSizeName = "inner" + property,
            cssProperty = property.toLowerCase(),
            horizontal = property === "Width",
            scrollSizeName = "scroll" + property,
            element = scrollElement.parent(),
            scrollbar = $('<div class="km-touch-scrollbar km-' + (horizontal ? "horizontal" : "vertical") + '-scrollbar" />'),
            name = horizontal ? "x" : "y",
            dip10,
            enabled,
            minLimit,
            maxLimit,
            minStop,
            maxStop,
            ratio,
            decelerationVelocity,
            bounceLocation,
            direction,
            zoomLevel,
            directionChange,
            scrollOffset,
            boxSize,
            lastLocation,
            startLocation,
            idx,
            timeoutId,
            winding,
            dragCanceled,
            lastCall,
            dragged;

        element.append(scrollbar);

        function updateLastLocation(location) {
            lastLocation = location;
            directionChange =+ new Date();
        }

        function changeDirection(location) {
            var delta = lastLocation - location,
                newDirection = delta/abs(delta);

            if (newDirection !== direction) {
                direction = newDirection;
                updateLastLocation(location);
            }
        }

        function updateScrollOffset(location) {
            var offset = limitValue(startLocation - location, minStop, maxStop),
                offsetValue,
                delta = 0,
                size,
                limit = 0;

            scrollOffset = -(startLocation - location) / zoomLevel;

            var transformedLocation = -scrollOffset;

            if (transformedLocation > maxLimit) {
                transformedLocation = maxLimit + (transformedLocation - maxLimit) * BOUNCE_PARALLAX;
            } else if (transformedLocation < minLimit) {
                transformedLocation *= BOUNCE_PARALLAX;
            }

            scrollOffset = -transformedLocation;

            updateCallback(name, scrollOffset);

            if (offset > maxLimit) {
                limit = offset - maxLimit;
            } else if (offset < minLimit) {
                limit = offset;
            }

            delta = limitValue(limit, -BOUNCE_STOP, BOUNCE_STOP);

            size = max(ratio - abs(delta), 20);

            offsetValue = limitValue(offset * ratio / boxSize + delta, 0, boxSize - size);

            scrollbar
                .css(TRANSFORM, to3DProperty(horizontal ? offsetValue + "px,0" : "0," + offsetValue + PX))
                .css(cssProperty, size + PX);

        }

        function wait(e) {
            init();
            if (!enabled || scrollElement.data("disabled")) {
                return;
            }

            dragged = false;
            clearTimeout(timeoutId);

            var location = touchLocation(e),
                coordinate = location[name];

            scrollOffset  = getScrollOffsets(scrollElement)[name];

            idx = location.idx;

            startLocation = coordinate - scrollOffset;
            updateLastLocation(coordinate);

            $(document)
                .unbind(MOVEEVENT, start)
                .unbind(MOVEEVENT, drag)
                .bind(MOVEEVENT, start);

            scrollElement
                .unbind(support.mouseup, stop) // Make sure previous event is removed
                .bind(support.mouseup, stop);
        }

        function start(e) {
            var location = getTouchLocation(e, true);

            if (!location || abs(lastLocation - location) <= dip10) {
                return;
            }

            changeDirection(location);

            scrollbar.show()
                .css({opacity: SCROLLBAR_OPACITY, visibility: VISIBLE})
                .css(cssProperty, ratio);

            dragged = true;

            $(document).unbind(MOVEEVENT, start)
                .unbind(MOVEEVENT, drag)
                .bind(MOVEEVENT, drag);

        }

        function getTouchLocation(event, prevent) {
            if (prevent) {
                event.preventDefault();
                event.stopPropagation();
            }

            var location = touchLocation(event);
            if (location.idx === idx && !dragCanceled) {
                return location[name];
            }

            return false;
        }

        function drag(e) {
            var location = getTouchLocation(e, true);

            if (location) {
                changeDirection(location);
                updateScrollOffset(location);
            }
        }

        function stop(e) {
            if (dragCanceled) {
                return;
            }

            var location = getTouchLocation(e, dragged);

            $(document)
                .unbind(MOVEEVENT, start)
                .unbind(MOVEEVENT, drag);

            scrollElement.unbind(support.mouseup, stop);

            if (dragged) {
                dragged = false;
                bounceLocation = location;
                decelerationVelocity = abs((lastLocation - location) / ((+new Date() - directionChange) / ACCELERATION));
                winding = true;
                queueNextStep();
            } else {
                endKineticAnimation(true);
            }
       }

       function queueNextStep() {
           lastCall = +new Date();
           timeoutId = setTimeout(stepKineticAnimation, FRAMERATE);
       }

       function stepKineticAnimation() {
           var animationIterator = round((+new Date() - lastCall) / FRAMERATE - 1),
               offBounds = false,
               negativeVelocity;

           if (!winding) {
               return;
           }

           while (animationIterator-- >= 0) {
               offBounds = false;
               if (-scrollOffset < minLimit) {
                   offBounds = true;
                   negativeVelocity = -scrollOffset * BOUNCE_SNAP;
               } else if (-scrollOffset > maxLimit) {
                   offBounds = true;
                   negativeVelocity = -(-scrollOffset - maxLimit) * BOUNCE_SNAP;
               }

               if (offBounds) {
                   if (decelerationVelocity < 0) {
                       decelerationVelocity = negativeVelocity;
                       if (abs(decelerationVelocity) < VELOCITY) {
                           endKineticAnimation();
                           return;
                       }
                   } else {
                       decelerationVelocity *= BOUNCE_FRICTION;
                       decelerationVelocity -= BOUNCE_DECELERATION;
                   }
               } else {
                   decelerationVelocity *= FRICTION;
               }

               bounceLocation -= direction * decelerationVelocity;
               updateScrollOffset(bounceLocation);

               if (!offBounds && endKineticAnimation()) {
                   return;
               }
           }

           queueNextStep();
       }

       function endKineticAnimation(forceEnd) {
           if (!forceEnd && abs(decelerationVelocity) > VELOCITY) {
               return false;
           }

           winding = false;
           clearTimeout(timeoutId);

           scrollbar.css(OPACITY, 0);
           return true;
       }

       function gestureStart() {
           dragCanceled = true;
       }

       function gestureEnd() {
           dragCanceled = false;
       }

       function init() {
           var scrollSize = scrollElement[0][scrollSizeName],
           scroll;

           boxSize = element[boxSizeName]();
           scroll = scrollSize - boxSize;
           enabled = scroll > 0;
           zoomLevel = support.zoomLevel();
           dip10 = 5 * zoomLevel;
           minLimit = 0;
           maxLimit = scroll + minLimit;
           minStop = - BOUNCE_STOP;
           maxStop = scroll + BOUNCE_STOP;
           ratio = ~~(boxSize / scrollSize * boxSize);
           decelerationVelocity = 0;
           bounceLocation = 0;
           direction = 0;
           directionChange =+ new Date();
           scrollOffset = 0;
       }

       element
           .bind("gesturestart", gestureStart)
           .bind("gestureend", gestureEnd)
           .bind(support.mousedown, wait);
    }

    var Scroller = Widget.extend({
        init: function(element, options) {
            var that = this, scrollElement,
                transform = {x: 0, y: 0};

            Widget.fn.init.call(that, element, options);

            if ((!support.mobileOS && !that.options.useOnDesktop)) {
                that.element.bind("scroll", function() {
                    that.trigger("scroll", {x: that.element.scrollLeft(), y: that.element.scrollTop()});
                });

                return;
            }

            element = that.element;

            element
                .css("overflow", "hidden")
                .wrapInner('<div class="km-scroll-container"/>');

            scrollElement = element.children().first();
            that.scrollElement = scrollElement;

            function updateTransform(property, value) {
                value = round(value);
                if (value !== transform[property]) {
                    transform[property] = value;
                    scrollElement[0].style[TRANSFORMSTYLE] = to3DProperty(transform.x + PX + "," + transform.y + PX);
                    that.trigger("scroll", {x: -transform.x, y: -transform.y});
                }
            }

            Axis(scrollElement, "Width", updateTransform);
            Axis(scrollElement, "Height", updateTransform);

            if ($.browser.mozilla) {
                element.bind("mousedown", false);
            }
        },

        options: {
            name: "Scroller",
            useOnDesktop: true
        },

        disable: function () {
            this.element.children(".km-scroll-container").data("disabled", true);
        },

        enable: function () {
            this.element.children(".km-scroll-container").removeData("disabled");
        },

        scrollIntoView: function() {
            this.scrollElement.trigger("scrollIntoView"); // TODO
        }
    });

    ui.plugin(Scroller);
})(jQuery);
(function($, undefined) {
    /**
    * @name kendo.mobile.ui.Switch.Description
    *
    * @section The mobile Switch widget is used to display two exclusive choices.
    * <p>When initialized, it shows the currently selected value. User slides the control to reveal the second value.
    * The mobile Switch can be created from <code>input</code> element of type <code>checkbox</code>.</p>
    *
    * <h3>Getting Started</h3>
    *
    * <p> The Kendo Mobile Application will automatically initialize a mobile Switch for every element with <code>role</code> data attribute set to <code>swtich</code> present in the views/layouts markup.
    * Alternatively, it can be initialized using a jQuery selector.</p>
    * @exampleTitle Initialize mobile Switch based on role data attribute
    * @example
    * <input type="checkbox" data-role="switch" />
    *
    * @exampleTitle Initialize mobile Switch using a jQuery selector
    * @example
    * <input type="checkbox" id="switch" />
    * <script>
    * var switchWidget = $("#switch").kendoMobileSwitch();
    * </script>
    * @section <h3>Checking/Unchecking the Mobile Switch</h3>
    *
    * <p>The checked state of the mobile Switch depends on the <code>checked</code> property of the widget's constructor options
    * or the <code>checked</code> attribute of the widget's element.</p>
    *
    * @exampleTitle Initialize Kendo mobile Switch from checked <code>input</code>
    * @example
    * <input type="checkbox" id="switch" checked="checked" />
    * <script>
    * var switchWidget = $("#switch").kendoMobileSwitch();
    * </script>
    *
    * @exampleTitle Initialize checked mobile Switch using a jQuery selector
    * @example
    * <input type="checkbox" id="switch" />
    * <script>
    * var switchWidget = $("#switch").kendoMobileSwitch({ checked: true });
    * </script>
    *
    * @section <h3>Specifying the Text of the Labels</h3>
    *
    * @exampleTitle Customize Kendo mobile Switch on/off labels
    * @example
    * <input type="checkbox" id="switch" />
    * <script>
    * var switchWidget = $("#switch").kendoMobileSwitch({ onLabel: "YES", offLabel: "NO" });
    * </script>
    */
    var kendo = window.kendo,
        ui = kendo.mobile.ui,
        Widget = ui.Widget,
        support = kendo.support,
        CHANGE = "change",
        SWITCHON = "km-switch-on",
        SWITCHOFF = "km-switch-off",
        MARGINLEFT = "margin-left",
        MOUSEDOWN = support.mousedown,
        MOUSEUP = support.mouseup,
        MOUSEMOVE = support.mousemove,
        TRANSFORMSTYLE = support.transitions.css + "transform",
        DOCUMENT = $(document),
        extend = $.extend,
        proxy = $.proxy;

    function prevent(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function limitValue(value, minLimit, maxLimit) {
        return Math.max( minLimit, Math.min( maxLimit, value));
    }

    var Switch = Widget.extend(/** @lends kendo.mobile.ui.Switch.prototype */{
        /**
        * @constructs
        * @extends kendo.mobile.ui.Widget
        * @param {DomElement} element DOM element.
        * @param {Object} options Configuration options.
        * @option {Boolean} [checked] <false> The checked state of the widget.
        * @option {String} [onLabel] <ON> The ON label.
        * @option {String} [offLabel] <OFF> The OFF label.
        */
        init: function(element, options) {
            var that = this, width, checked, handleWidth;

            Widget.fn.init.call(that, element, options);

            that._wrapper();
            that._background();
            that._handle();

            options = that.options;
            element = that.element.data(kendo.attr("role"), "switch");
            element[0].type = "checkbox";

            handleWidth = that.handle.outerWidth();
            that.halfWidth = handleWidth / 2;
            that.width = width = that.wrapper.outerWidth();
            that.snapPart = width - handleWidth;
            that.constrain = width - that.halfWidth;
            that._visibleBack = true;

            that._moveProxy = proxy(that._move, that);
            that._stopProxy = proxy(that._stop, that);

            that.bind([
                /**
                * Fires when the state of the widget changes
                * @name kendo.mobile.ui.Switch#change
                * @event
                * @param {Event} e
                * @param {Object} e.checked The checked state of the widget.
                *
                * @exampleTitle Handle change event
                * @example
                * <input type="checkbox" id="switch" data-role="switch" />
                *
                * <script>
                *  $("#switch").data("kendoMobileSwitch").bind("change", function(e) {
                *      //handle change event
                *  }
                * </script>
                */
                CHANGE
            ], options);

            checked = options.checked;
            if (checked === undefined) {
                checked = element[0].checked;
            }

            that.toggle(checked);
        },

        options: {
            name: "Switch",
            onLabel: "ON",
            offLabel: "OFF"
        },

        /**
        * Toggle the checked state of the widget.
        * @param {Boolean} check Wether to turn the widget on or off.
        * @example
        * <input data-role="switch" id="foo" />;
        *
        * <script>;
        *   $("#foo").data("kendoMobileSwitch").toggle(true);
        * </script>;
        */
        toggle: function(check) {
            var that = this,
                element = that.element[0];

            if (check === undefined) {
                check = !element.checked;
            }

            element.checked = check;

            that._position(check * that.snapPart, check ? 0 : that.origin);

            that.handle
                .toggleClass(SWITCHON, check)
                .toggleClass(SWITCHOFF, !check);
        },

        _active: function (e) {
            this.handle.toggleClass("km-state-active", e.type == MOUSEDOWN);
        },

        _location: function(e) {
            return kendo.touchLocation(e).x - this.wrapper.offset().left;
        },

        _move: function(e) {
            var that = this,
                location = limitValue(that._location(e), that.halfWidth, that.constrain),
                position = location - that.halfWidth;

            that._position(position, that.origin + position);
        },

        _position: function(position, margin) {
            var that = this;

            that.handle.css(TRANSFORMSTYLE, "translatex(" + position + "px)");

            if (that._visibleBack) {
                that.background.css(MARGINLEFT, margin);
            }
        },

        _start: function(e) {
            var that = this;

            that._visibleBack = that.background.is(":visible");
            that._initial = that._location(e);

            DOCUMENT
                .bind(MOUSEMOVE, that._moveProxy)
                .bind(MOUSEUP + " mouseleave", that._stopProxy); // Stop if leaving the simulator/screen

            prevent(e);
        },

        _stop: function(e) {
            var that = this,
                location = that._location(e),
                check;

            if (Math.abs(that._initial - location) <= 2) {
                check = !that.element[0].checked;
            } else {
                check = location > (that.width / 2);
            }

            that._toggle(check);

            DOCUMENT
                .unbind(MOUSEMOVE, that._moveProxy)
                .unbind(MOUSEUP + " mouseleave", that._stopProxy);

            prevent(e);
        },

        _toggle: function (checked) {
            var that = this,
                handle = that.handle,
                element = that.element[0],
                value = element.checked,
                distance;

            handle
                .toggleClass(SWITCHON, checked)
                .toggleClass(SWITCHOFF, !checked);

            if (!handle.data("animating")) {
                distance = checked * that.snapPart;

                that.background
                    .kendoStop(true, true)
                    .kendoAnimate({ effects: "slideMargin", offset: distance, reverse: !checked, axis: "left", duration: 200 });

                handle
                    .kendoStop(true, true)
                    .kendoAnimate({
                        effects: "slideTo",
                        duration: 200,
                        offset: distance + "px,0",
                        complete: function () {
                            if (value !== checked) {
                                element.checked = checked;
                                that.trigger(CHANGE, { checked: checked });
                            }
                        }
                    });
            }
        },

        _background: function() {
            var that = this,
                background;

            background = $("<span class='km-switch-wrapper'><span class='km-switch-background'></span></span>")
                            .appendTo(that.wrapper)
                            .children(".km-switch-background");

            that.origin = parseInt(background.css(MARGINLEFT), 10);
            background.data("origin", that.origin);
            that.background = background;
        },

        _handle: function() {
            var that = this,
                options = that.options;

            that.handle = $("<span class='km-switch-container'><span class='km-switch-handle' /></span>")
                            .appendTo(that.wrapper)
                            .children(".km-switch-handle")
                            .bind(MOUSEDOWN + " " + MOUSEUP, proxy(that._active, that));

            that.handle.append('<span class="km-switch-label-on">' + options.onLabel + '</span><span class="km-switch-label-off">' + options.offLabel + '</span>');
        },

        _wrapper: function() {
            var that = this,
                element = that.element,
                wrapper = element.parent("label");

            if (!wrapper[0]) {
                wrapper = element.wrap("<label />").parent();
            }

            that.wrapper = wrapper.addClass("km-switch")
                                  .bind(MOUSEDOWN, proxy(that._start, that));
        }
    });

    ui.plugin(Switch);
})(jQuery);
(function($, undefined) {
    /**
    * @name kendo.mobile.ui.Tabstrip.Description
    * @section The mobile Tabstrip widget is used inside a mobile view or layout footer element to display an application-wide group of navigation buttons.
    * The looks of the mobile Tabstrip vary depending on the user mobile device and operating system.
    *
    * <h3>Getting Started</h3>
    * <p>The Kendo mobile Application will automatically initialize the mobile Tabstrip for every element with <code>role</code> data attribute set to <code>tabstrip</code> present in the views/layouts markup.
    * Alternatively, it can be initialized using a jQuery selector. The tabstrip element should contain one or more <code>a</code> elements.</p>
    *
    * <h3>Kendo Mobile Application Integration</h3>
    * <p>If a Kendo mobile Application is initialized, the tabs of the Tabstrip will automatically navigate within the application's views.
    * When the application navigates between views, it updates the Tabstrip's currently selected tab, based on the current view's URL.</p>
    *
    * @exampleTitle Initialize Kendo mobile Tabstrip based on role data attribute.
    * @example
    * <div data-role="tabstrip">
    *   <a href="#index">Home</a>
    *   <a href="#featured">Featured</a>
    * </div>
    *
    * @exampleTitle Initialize Kendo mobile Tabstrip using a jQuery selector
    * @example
    * var tabstrip = $("#tabstrip").kendoMobileTabStrip();
    *
    * @section
    * <h3>Tab icons</h3>
    * <p> A tab icon can be set in two ways - either by adding an <code>img</code> element inside the <code>a</code> element, or by setting an <code>icon</code> data attribute to the <code>a</code> element.
    * Kendo mobile Tabstrip comes out of the box with several ready to use icons:</p>
    *
    * <ul id="icon-list">
    *   <li title=".km-about"><span class="km-icon km-about"></span>about</li>
    *   <li title=".km-action"><span class="km-icon km-action"></span>action</li>
    *   <li title=".km-add"><span class="km-icon km-add"></span>add</li>
    *   <li title=".km-bookmarks"><span class="km-icon km-bookmarks"></span>bookmarks</li>
    *   <li title=".km-camera"><span class="km-icon km-camera"></span>camera</li>
    *   <li title=".km-cart"><span class="km-icon km-cart"></span>cart</li>
    *   <li title=".km-compose"><span class="km-icon km-compose"></span>compose</li>
    *   <li title=".km-contacts"><span class="km-icon km-contacts"></span>contacts</li>
    *   <li title=".km-details"><span class="km-icon km-details"></span>details</li>
    *   <li title=".km-downloads"><span class="km-icon km-downloads"></span>downloads</li>
    *   <li title=".km-fastforward"><span class="km-icon km-fastforward"></span>fastforward</li>
    *   <li title=".km-favorites"><span class="km-icon km-favorites"></span>favorites</li>
    *   <li title=".km-featured"><span class="km-icon km-featured"></span>featured</li>
    *   <li title=".km-featured"><span class="km-icon km-toprated"></span>toprated</li>
    *   <li title=".km-globe"><span class="km-icon km-globe"></span>globe</li>
    *   <li title=".km-history"><span class="km-icon km-history"></span>history</li>
    *   <li title=".km-home"><span class="km-icon km-home"></span>home</li>
    *   <li title=".km-info"><span class="km-icon km-info"></span>info</li>
    *   <li title=".km-more"><span class="km-icon km-more"></span>more</li>
    *   <li title=".km-mostrecent"><span class="km-icon km-mostrecent"></span>mostrecent</li>
    *   <li title=".km-mostviewed"><span class="km-icon km-mostviewed"></span>mostviewed</li>
    *   <li title=".km-organize"><span class="km-icon km-organize"></span>organize</li>
    *   <li title=".km-pause"><span class="km-icon km-pause"></span>pause</li>
    *   <li title=".km-play"><span class="km-icon km-play"></span>play</li>
    *   <li title=".km-recents"><span class="km-icon km-recents"></span>recents</li>
    *   <li title=".km-refresh"><span class="km-icon km-refresh"></span>refresh</li>
    *   <li title=".km-reply"><span class="km-icon km-reply"></span>reply</li>
    *   <li title=".km-rewind"><span class="km-icon km-rewind"></span>rewind</li>
    *   <li title=".km-search"><span class="km-icon km-search"></span>search</li>
    *   <li title=".km-settings"><span class="km-icon km-settings"></span>settings</li>
    *   <li title=".km-share"><span class="km-icon km-share"></span>share</li>
    *   <li title=".km-stop"><span class="km-icon km-stop"></span>stop</li>
    *   <li title=".km-trash"><span class="km-icon km-trash"></span>trash</li>
    * </ul>
    *
    * Additional icons may be added by defining the respective CSS tab class. If the <code>icon</code> data attribute is set to <code>custom</code>,
    * the tab will receive <code>km-custom</code> CSS class.
    * @exampleTitle Define custom tabstrip icon.
    * @example
    * <style>
    * .km-custom {
    *   background-image: url("foo.jpg");
    * }
    * </style>
    *
    * <div data-role="tabstrip">
    *   <a href="#index" data-icon="custom">Home</a>
    * </div>
    */
    var kendo = window.kendo,
        ui = kendo.mobile.ui,
        Widget = ui.Widget,
        mobile = kendo.mobile,
        support = kendo.support,
        touch = support.touch,
        os = support.mobileOS,
        ACTIVE_STATE_CLASS = "km-state-active",
        SELECT = "select",
        proxy = $.proxy;

    var Tabstrip = Widget.extend(/** @lends kendo.mobile.ui.Tabstrip.prototype */{
        /**
        * @constructs
        * @extends kendo.ui.Widget
        * @param {DomElement} element DOM element.
        * @param {Object} options Configuration options.
        * @option {Number} [selectedIndex] <0> The index of the initially selected tab.
        */
        init: function(element, options) {
            var that = this;

            Widget.fn.init.call(that, element, options);

            options = that.options;

            that.bind([
            /**
             * Fires when tab is selected.
             * @name kendo.mobile.ui.Tabstrip#select
             * @event
             * @param {Event} e
             * @param {jQueryObject} e.item The selected tab
             */
              SELECT
            ], options);

            that.element.addClass("km-tabstrip");

            that._releaseProxy = proxy(that._release, that);

            that.element.find("a")
                            .each(that._buildButton)
                            .bind(support.mousedown, that._releaseProxy)
                            .eq(options.selectedIndex).addClass(ACTIVE_STATE_CLASS);
        },

        /**
        * Set the mobile Tabstrip active tab to the tab with the specified url.
        * @param {String} url The url of the tab.
        *
        * @example
        * <div data-role="tabstrip" id="tabstrip"> <a href="#foo">Foo</a> </div>
        *
        * <script>
        *     $(function() {
        *         $("#tabstrip").data("kendoMobileTabstrip").switchTo("#foo");
        *     });
        * </script>
        */
        switchTo: function(url) {
            this._setActiveItem(this.element.find('a[href$="' + url + '"]'));
        },

        /**
        * Get the currently selected tab DOM element.
        * @returns {jQueryObject} the currently selected tab DOM element.
        */
        currentItem: function() {
            return this.element.children("." + ACTIVE_STATE_CLASS);
        },

        _release: function(e) {
            var that = this,
                item = $(e.currentTarget);

            if (item[0] === that.currentItem()[0]) {
                return;
            }

            that.trigger(SELECT, {item: item});
            that._setActiveItem(item);
        },

        _setActiveItem: function(item) {
            if (!item[0]) {
                return;
            }
            this.currentItem().removeClass(ACTIVE_STATE_CLASS);
            item.addClass(ACTIVE_STATE_CLASS);
        },

        _buildButton: function() {
            var button = $(this),
                icon = button.data(kendo.ns + "icon"),
                image = button.find("img"),
                iconSpan = $('<span class="km-icon"/>');

            button
                .addClass("km-button")
                .attr(kendo.attr("role"), "tab")
                    .contents().not(image)
                    .wrapAll('<span class="km-text"/>');

            if (image[0]) {
                image.addClass("km-image");
            } else {
                button.prepend(iconSpan);
                if (icon) {
                    iconSpan.addClass("km-" + icon);
                }
            }
        },

        viewShow: function(view) {
            var that = this;
            setTimeout(function() {
                that.switchTo(kendo.history.url().string);
            });
        },

        options: {
            name: "Tabstrip",
            selectedIndex: 0,
            enable: true
        }
    });

    ui.plugin(Tabstrip);
})(jQuery);
