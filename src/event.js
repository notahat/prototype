if (!window.Event) var Event = { };

Object.extend(Event, {
  KEY_BACKSPACE: 8,
  KEY_TAB:       9,
  KEY_RETURN:   13,
  KEY_ESC:      27,
  KEY_LEFT:     37,
  KEY_UP:       38,
  KEY_RIGHT:    39,
  KEY_DOWN:     40,
  KEY_DELETE:   46,
  KEY_HOME:     36,
  KEY_END:      35,
  KEY_PAGEUP:   33,
  KEY_PAGEDOWN: 34,
  KEY_INSERT:   45,
  
  cache: { },

  relatedTarget: function(event) {
    var element;
    switch(event.type) {
      case 'mouseover': element = event.fromElement; break;
      case 'mouseout':  element = event.toElement;   break;
      default: return null;
    }
    return Element.extend(element);
  }
});

Event.Methods = (function() {
  var isButton;

  if (Prototype.Browser.IE) {
    var buttonMap = { 0: 1, 1: 4, 2: 2 };
    isButton = function(event, code) {
      return event.button == buttonMap[code];
    };
    
  } else if (Prototype.Browser.WebKit) {
    isButton = function(event, code) {
      switch (code) {
        case 0: return event.which == 1 && !event.metaKey;
        case 1: return event.which == 1 && event.metaKey;
        default: return false;
      }
    };
    
  } else {
    isButton = function(event, code) {
      return event.which ? (event.which === code + 1) : (event.button === code);
    };
  }

  return {
    isLeftClick:   function(event) { return isButton(event, 0) },
    isMiddleClick: function(event) { return isButton(event, 1) },
    isRightClick:  function(event) { return isButton(event, 2) },
    
    element: function(event) {
      event = Event.extend(event);
      var node = event.target, currentTarget = event.currentTarget, type = event.type;
      
      if (currentTarget && currentTarget.tagName) {
        // Firefox screws up the "click" event when moving between radio buttons
        // via arrow keys. It also screws up the "load" and "error" events on images,
        // reporting the document as the target instead of the original image.
        if (['load', 'error'].include(type) ||
         (currentTarget.tagName.toUpperCase() === "INPUT" && currentTarget.type === "radio" && type === "click"))
          node = currentTarget;
      }
      
      return Element.extend(node && node.nodeType == Node.TEXT_NODE ?
       node.parentNode : node);
    },

    findElement: function(event, expression) {
      var element = Event.element(event);
      if (!expression) return element;
      var elements = [element].concat(element.ancestors());
      return Selector.findElement(elements, expression, 0);
    },

    pointer: function(event) {
      var docElement = document.documentElement,
      body = document.body || { scrollLeft: 0, scrollTop: 0 };
      return {
        x: event.pageX || (event.clientX + 
          (docElement.scrollLeft || body.scrollLeft) -
          (docElement.clientLeft || 0)),
        y: event.pageY || (event.clientY + 
          (docElement.scrollTop || body.scrollTop) -
          (docElement.clientTop || 0))
      };
    },

    pointerX: function(event) { return Event.pointer(event).x },
    pointerY: function(event) { return Event.pointer(event).y },

    stop: function(event) {
      Event.extend(event);
      event.preventDefault();
      event.stopPropagation();
      event.stopped = true;
    }
  };
})();

Event.extend = (function() {
  var methods = Object.keys(Event.Methods).inject({ }, function(m, name) {
    m[name] = Event.Methods[name].methodize();
    return m;
  });
  
  if (Prototype.Browser.IE) {
    Object.extend(methods, {
      stopPropagation: function() { this.cancelBubble = true },
      preventDefault:  function() { this.returnValue = false },
      inspect: function() { return "[object Event]" }
    });

    return function(event) {
      if (!event) return false;
      if (event._extendedByPrototype) return event;
      
      var pointer = Event.pointer(event);
      Object.extend(event, {
        _extendedByPrototype: Prototype.emptyFunction,
        target:        Element.extend(event.srcElement),
        relatedTarget: Event.relatedTarget(event),
        pageX:         pointer.x,
        pageY:         pointer.y
      });
      return Object.extend(event, methods);
    };
    
  } else {
    Event.prototype = Event.prototype || document.createEvent("HTMLEvents")['__proto__'];
    Object.extend(Event.prototype, methods);
    return Prototype.K;
  }
})();

Object.extend(Event, (function() {
  var cache = Event.cache;

  function getEventID(element) {
    // Event ID is stored as the 0th index in a one-item array so that it
    // won't get copied to a new node when cloneNode is called.
    if (element === window) return 1;
    if (element._prototypeEventID) return element._prototypeEventID[0];
    return element._prototypeEventID = [arguments.callee.id++];
  }
  getEventID.id = 2;
  
  function getDOMEventName(eventName) {
    if (eventName && eventName.include(':')) return "dataavailable";
    return eventName;
  }
  
  function getCacheForID(id) {
    return cache[id] = cache[id] || { };
  }
  
  function addEventDispatcher(element, eventName, dispatchWrapper) {
    var id = getEventID(element), wrappers = getWrappersForEventName(id, eventName);
    if (wrappers.dispatcher) return;

    wrappers.dispatcher = function(event) {
      var w = getWrappersForEventName(id, eventName);
      for(var i = 0, l = w.length; i < l; i++) w[i](event); // execute wrappers
    };

    if(dispatchWrapper) wrappers.dispatcher = wrappers.dispatcher.wrap(dispatchWrapper);
    element.attachEvent("on" + getDOMEventName(eventName), wrappers.dispatcher);
  }
  
  function getWrappersForEventName(id, eventName) {
    var c = getCacheForID(id);
    return c[eventName] = c[eventName] || [];
  }
  
  function createWrapper(element, eventName, handler) {
    var id = getEventID(element), c = getCacheForID(id);

    // Attach the element itself onto its cache entry so we can retrieve it for
    // cleanup on page unload.
    if (!c.element) c.element = element;

    var w = getWrappersForEventName(id, eventName);
    if (w.pluck("handler").include(handler)) return false;
    
    var wrapper = function(event) {
      if (!Event || !Event.extend ||
        (event.eventName && event.eventName != eventName))
          return false;
      
      handler.call(element, Event.extend(event));
    };
    
    wrapper.handler = handler;
    w.push(wrapper);
    return wrapper;
  }
  
  function findWrapper(id, eventName, handler) {
    var w = getWrappersForEventName(id, eventName);
    return w.find(function(wrapper) { return wrapper.handler == handler });
  }
  
  function destroyWrapper(id, eventName, handler) {
    var c = getCacheForID(id);
    if (!c[eventName]) return false;
    var d = c[eventName].dispatcher;
    c[eventName] = c[eventName].without(findWrapper(id, eventName, handler));
    c[eventName].dispatcher = d;
  }
  
  // Loop through all elements and remove all handlers on page unload. IE
  // needs this in order to prevent memory leaks.
  function purgeListeners() {
    var element, entry;
    for (var i in Event.cache) {
      entry = Event.cache[i];
      Event.stopObserving(entry.element);
      entry.element = null;
    }
  }
  
  function onStop() {
    document.detachEvent("onstop", onStop);
    purgeListeners();
  }
  
  function onBeforeUnload() {
    if (document.readyState === "interactive") {
      document.attachEvent("onstop", onStop);
      (function() { document.detachEvent("onstop", onStop); }).defer();
    }
  }
  
  if (window.attachEvent && !window.addEventListener) {
    // Internet Explorer needs to remove event handlers on page unload
    // in order to avoid memory leaks.
    window.attachEvent("onunload", purgeListeners);

    // IE also doesn't fire the unload event if the page is navigated away
    // from before it's done loading. Workaround adapted from
    // http://blog.moxiecode.com/2008/04/08/unload-event-never-fires-in-ie/.
    window.attachEvent("onbeforeunload", onBeforeUnload);
    
    // Ensure window onload is fired after "dom:loaded"
    addEventDispatcher(window, 'load', function(proceed, event) {
    	if (document.loaded){
    	  proceed(event);
    	} else {
    	  arguments.callee.defer(proceed, event);
    	}
    });
    
    // Ensure window onresize is fired only once per resize
    addEventDispatcher(window, 'resize', function(proceed, event) {
      var callee = arguments.callee, dimensions = document.viewport.getDimensions();
      if (dimensions.width != callee.prevWidth || dimensions.height != callee.prevHeight){
        callee.prevWidth  = dimensions.width;
        callee.prevHeight = dimensions.height;
        proceed(event);
      }
    });
  }
  
  // Safari has a dummy event handler on page unload so that it won't
  // use its bfcache. Safari <= 3.1 has an issue with restoring the "document"
  // object when page is returned to via the back button using its bfcache.
  else if (Prototype.Browser.WebKit) {
    window.addEventListener("unload", Prototype.emptyFunction, false);
  }
    
  return {
    observe: function(element, eventName, handler) {
      element = $(element);
      var name = getDOMEventName(eventName);
      
      var wrapper = createWrapper(element, eventName, handler);
      if (!wrapper) return element;
      
      if (element.addEventListener) {
        element.addEventListener(name, wrapper, false);
      } else {
        addEventDispatcher(element, eventName);
      }
      
      return element;
    },
  
    stopObserving: function(element, eventName, handler) {
      element = $(element);
      eventName = Object.isString(eventName) ? eventName : null;
      var id = getEventID(element), c = cache[id];

      if (!c) {
        return element;
      } else if (!handler && eventName) {
        getWrappersForEventName(id, eventName).each(function(wrapper) {
          Event.stopObserving(element, eventName, wrapper.handler);
        });
        return element;
      } else if (!eventName) {
        Object.keys(c).without("element").each(function(eventName) {
          Event.stopObserving(element, eventName);
        });
        return element;
      }
      
      var wrapper = findWrapper(id, eventName, handler);
      if (!wrapper) return element;
      
      var name = getDOMEventName(eventName);
      if (element.removeEventListener) {
        element.removeEventListener(name, wrapper, false);
        destroyWrapper(id, eventName, handler); 
      } else {
        destroyWrapper(id, eventName, handler);
        var wrappers = getWrappersForEventName(id, eventName); 
        if (!wrappers.length) { 
          element.detachEvent("on" + name, wrappers.dispatcher); 
          wrappers.dispatcher = null; 
        } 
      }
      
      return element;
    },
  
    fire: function(element, eventName, memo) {
      element = $(element);
      if (element == document && document.createEvent && !element.dispatchEvent)
        element = document.documentElement;
        
      var event;
      if (document.createEvent) {
        event = document.createEvent("HTMLEvents");
        event.initEvent("dataavailable", true, true);
      } else {
        event = document.createEventObject();
        event.eventType = "ondataavailable";
      }

      event.eventName = eventName;
      event.memo = memo || { };

      if (document.createEvent) {
        element.dispatchEvent(event);
      } else {
        element.fireEvent(event.eventType, event);
      }

      return Event.extend(event);
    }
  };
})());

Object.extend(Event, Event.Methods);

Element.addMethods({
  fire:          Event.fire,
  observe:       Event.observe,
  stopObserving: Event.stopObserving
});

Object.extend(document, {
  fire:          Element.Methods.fire.methodize(),
  observe:       Element.Methods.observe.methodize(),
  stopObserving: Element.Methods.stopObserving.methodize(),
  loaded:        false
});

(function() {
  /* Support for the DOMContentLoaded event is based on work by Dan Webb, 
     Matthias Miller, Dean Edwards, John Resig and Diego Perini. */

  var timer;
  
  function fireContentLoadedEvent() {
    if (document.loaded) return;
    if (timer) window.clearInterval(timer);
    document.loaded = true;
    document.fire("dom:loaded");
  }
  
  if (document.addEventListener) {
    document.addEventListener("DOMContentLoaded", function() {
      // Ensure all stylesheets are loaded, solves Opera issue
      if (Prototype.Browser.Opera && 
          $A(document.styleSheets).any(function(s) { return s.disabled }))
        return arguments.callee.defer();
      fireContentLoadedEvent();
    }, false);
    
  } else {
    document.attachEvent("onreadystatechange", function() {
      if (document.readyState == "complete") {
        document.detachEvent("onreadystatechange", arguments.callee);
        fireContentLoadedEvent();
      }
    });
    
    if (window == top) {
      timer = setInterval(function() {
        try {
          document.documentElement.doScroll("left");
        } catch(e) { return }
        fireContentLoadedEvent();
      }, 10);
    }
  }
  
  // WebKit builds lower than 525.13 don't support DOMContentLoaded
  if (Prototype.Browser.WebKit && (navigator.userAgent.match(/AppleWebKit\/(\d+)/)[1] < 525)) {
    timer = setInterval(function() {
      if (/loaded|complete/.test(document.readyState) &&
          document.styleSheets.length == $$('style, link[rel="stylesheet"]').length)
        fireContentLoadedEvent();
    }, 10);
  }
  
  // Worst case fallback... 
  Event.observe(window, "load", fireContentLoadedEvent); 
})();
