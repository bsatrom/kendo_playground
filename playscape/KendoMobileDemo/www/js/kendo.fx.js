/*
* Kendo UI v2012.1.124 (http://kendoui.com)
* Copyright 2012 Telerik AD. All rights reserved.
*
* Kendo UI commercial licenses may be obtained at http://kendoui.com/license.
* If you do not own a commercial license, this file shall be governed by the
* GNU General Public License (GPL) version 3. For GPL requirements, please
* review: http://www.gnu.org/copyleft/gpl.html
*/

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
