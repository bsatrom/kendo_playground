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
